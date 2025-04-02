import * as github from "@actions/github";
import * as core from "@actions/core";
import type {
	FileChange,
	ReviewComment,
	ReviewContext,
	StructuredReview,
} from "../types";
import type { FileAnalyzerService } from "./file-analyzer";

export class GitHubService {
	private octokit: ReturnType<typeof github.getOctokit>;
	private fileAnalyzer: FileAnalyzerService;
	private context = github.context;

	constructor(token: string, fileAnalyzer: FileAnalyzerService) {
		this.octokit = github.getOctokit(token);
		this.fileAnalyzer = fileAnalyzer;
	}

	async getPullRequestDetails(): Promise<{
		number: number;
		title: string;
		body: string | null;
		head: { ref: string; sha: string };
		base: { ref: string };
	}> {
		const { pull_request } = this.context.payload;

		if (!pull_request) {
			throw new Error("This action can only be run on pull request events");
		}

		return {
			number: pull_request.number,
			title: pull_request.title,
			body: pull_request.body ?? null,
			head: {
				ref: pull_request.head.ref,
				sha: pull_request.head.sha,
			},
			base: {
				ref: pull_request.base.ref,
			},
		};
	}

	async getChangedFiles(prNumber: number): Promise<FileChange[]> {
		const { owner, repo } = this.context.repo;
		core.info(`Fetching changed files for PR #${prNumber}...`);

		const changedFiles: FileChange[] = [];
		let page = 1;
		let hasMorePages = true;

		while (hasMorePages) {
			const response = await this.octokit.rest.pulls.listFiles({
				owner,
				repo,
				pull_number: prNumber,
				per_page: 100,
				page,
			});

			if (response.data.length === 0) {
				hasMorePages = false;
				break;
			}

			for (const file of response.data) {
				if (!this.fileAnalyzer.shouldAnalyzeFile(file.filename)) {
					continue;
				}

				const fileChange: FileChange = {
					filename: file.filename,
					status: file.status as "added" | "modified" | "removed" | "renamed",
					patch: file.patch,
				};

				changedFiles.push(fileChange);
			}

			page++;
		}

		core.info(`Found ${changedFiles.length} relevant changed files`);
		return changedFiles;
	}

	async getFileContent(filepath: string, ref: string): Promise<string> {
		const { owner, repo } = this.context.repo;

		try {
			const response = await this.octokit.rest.repos.getContent({
				owner,
				repo,
				path: filepath,
				ref,
			});

			// @ts-ignore - The type definitions don't account for the content property correctly
			if (response.data.content && response.data.encoding === "base64") {
				// @ts-ignore
				return Buffer.from(response.data.content, "base64").toString("utf-8");
			}

			throw new Error(`Unexpected response format for file: ${filepath}`);
		} catch (error) {
			if (error instanceof Error) {
				core.warning(
					`Error fetching file content for ${filepath}: ${error.message}`,
				);
			}
			return "";
		}
	}

	async createReviewComment(prNumber: number, review: string): Promise<void> {
		const { owner, repo } = this.context.repo;

		try {
			await this.octokit.rest.issues.createComment({
				owner,
				repo,
				issue_number: prNumber,
				body: `# Claude AI 코드 리뷰\n\n${review}`,
			});

			core.info("Successfully posted code review comment");
		} catch (error) {
			if (error instanceof Error) {
				core.error(`Error posting review comment: ${error.message}`);
			} else {
				core.error("Unknown error posting review comment");
			}
		}
	}

	async createReviewWithComments(
		prNumber: number,
		review: StructuredReview,
	): Promise<void> {
		const { owner, repo } = this.context.repo;
		const { summary, comments } = review;

		try {
			// Check if the summary is from an error in Claude service
			const isErrorSummary =
				summary.includes("코드 리뷰 응답 파싱에 실패했습니다") ||
				summary.includes("Claude 코드 리뷰 생성 중 오류가 발생했습니다") ||
				summary.includes("알 수 없는 오류로 코드 리뷰를 생성할 수 없습니다");

			// Only post regular comment if it's not an error summary
			if (!isErrorSummary) {
				// First post the overall review as a regular comment (like before)
				await this.octokit.rest.issues.createComment({
					owner,
					repo,
					issue_number: prNumber,
					body: `# AI 코드 리뷰\n\n${summary}`,
				});

				core.info("Successfully posted overall review comment");
			} else {
				core.info(
					"Skipping posting summary comment as it contains an error message",
				);
				return; // Exit early if there's an error summary
			}

			// Only continue with line comments if there are actual comments
			if (comments.length === 0) {
				core.info(
					"No line-specific comments to post, skipping review creation",
				);
				return;
			}

			// Get the latest commit SHA for the pull request
			const prResponse = await this.octokit.rest.pulls.get({
				owner,
				repo,
				pull_number: prNumber,
			});

			const headSha = prResponse.data.head.sha;

			// Format review comments in the GitHub expected format
			const reviewComments = comments.map((comment) => ({
				path: comment.path,
				line: comment.line,
				body: comment.body,
				position: undefined, // Use line instead of position for accurate line location
				side: "RIGHT", // Comment on the right side (new code)
			}));

			// Create the review with line-specific comments
			await this.octokit.rest.pulls.createReview({
				owner,
				repo,
				pull_number: prNumber,
				commit_id: headSha,
				body: "# AI 코드 리뷰 - 라인별 코멘트", // Just a title for the review itself
				event: "COMMENT", // Use 'APPROVE' or 'REQUEST_CHANGES' if appropriate
				comments: reviewComments,
			});

			core.info("Successfully posted code review with line-specific comments");
		} catch (error) {
			if (error instanceof Error) {
				core.error(`Error posting review: ${error.message}`);

				// Only fall back to a regular comment if we have real content to show
				// and it's not an error message from Claude
				try {
					core.info("Falling back to posting a regular comment");
					await this.createReviewComment(
						prNumber,
						`${summary}\n\n## 상세 코멘트\n\n${comments.map((c) => `- **${c.path}:${c.line}**: ${c.body}`).join("\n\n")}`,
					);
				} catch (fallbackError) {
					core.error("Fallback comment also failed");
				}
			} else {
				core.error("Unknown error posting review");
			}
		}
	}

	async prepareReviewContext(maxFiles: number): Promise<ReviewContext> {
		const pr = await this.getPullRequestDetails();
		let files = await this.getChangedFiles(pr.number);

		// Limit number of files to analyze
		if (files.length > maxFiles) {
			core.warning(
				`Limiting analysis to ${maxFiles} files out of ${files.length} changed files`,
			);
			files = files.slice(0, maxFiles);
		}

		// Fetch full content for each file
		for (const file of files) {
			if (file.status !== "removed") {
				file.fullContent = await this.getFileContent(
					file.filename,
					pr.head.sha,
				);
			}

			if (file.status === "modified" || file.status === "renamed") {
				file.previousContent = await this.getFileContent(
					file.filename,
					pr.base.ref,
				);
			}
		}

		// Prepare review context
		const context: ReviewContext = {
			pullRequestNumber: pr.number,
			pullRequestTitle: pr.title,
			pullRequestBody: pr.body,
			repositoryName: this.context.repo.repo,
			repositoryOwner: this.context.repo.owner,
			branch: pr.head.ref,
			baseRef: pr.base.ref,
			files,
			relatedFiles: {},
		};

		return context;
	}
}
