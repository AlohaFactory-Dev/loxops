import * as core from "@actions/core";
import * as github from "@actions/github";
import type {
	FileChange,
	ReviewContext,
	StructuredReview,
	UserComment,
} from "../types";
import type { FileAnalyzerService } from "./file-analyzer";

export class GitHubService {
	protected octokit: ReturnType<typeof github.getOctokit>;
	protected fileAnalyzer: FileAnalyzerService;
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
				body: `# Loxops\n\n${review}`,
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
				const reviewBody = `# Loxops\n\n## Overall Assessment\n\n${summary}`;

				await this.octokit.rest.issues.createComment({
					owner,
					repo,
					issue_number: prNumber,
					body: reviewBody,
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

			// Get the PR diff to determine which lines are part of the diff
			const { data: files } = await this.octokit.rest.pulls.listFiles({
				owner,
				repo,
				pull_number: prNumber,
			});

			// Create a map of valid line ranges for each file in the diff
			const validLineRanges: Record<string, { start: number; end: number }[]> =
				{};

			for (const file of files) {
				if (!file.patch) continue;

				validLineRanges[file.filename] = [];

				// Parse the patch to extract changed line numbers
				const hunkHeaders =
					file.patch.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/g) || [];

				for (const header of hunkHeaders) {
					const match = header.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
					if (match) {
						const start = Number.parseInt(match[1], 10);
						const length = match[2] ? Number.parseInt(match[2], 10) : 1;
						validLineRanges[file.filename].push({
							start,
							end: start + length - 1,
						});
					}
				}
			}

			// Filter comments to only include those on lines that are part of the diff
			const validComments = comments
				.filter((comment) => {
					if (!comment.body || comment.line <= 0 || !comment.path) {
						return false;
					}

					const ranges = validLineRanges[comment.path];
					if (!ranges) return false;

					// Check if the comment's line falls within any of the changed ranges
					return ranges.some(
						(range) => comment.line >= range.start && comment.line <= range.end,
					);
				})
				.map((comment) => ({
					path: comment.path,
					line: comment.line,
					body: comment.body || "No comment provided",
				}));

			// Only create review if we have valid comments
			if (validComments.length > 0) {
				try {
					// Create the review with line-specific comments
					await this.octokit.rest.pulls.createReview({
						owner,
						repo,
						pull_number: prNumber,
						commit_id: headSha,
						body: "# Loxops - 라인별 코멘트",
						event: "COMMENT",
						comments: validComments,
					});

					core.info(
						"Successfully posted code review with line-specific comments",
					);
				} catch (reviewError) {
					core.error(
						`Error creating review with comments: ${reviewError instanceof Error ? reviewError.message : String(reviewError)}`,
					);

					// Fallback to individual comments
					core.info("Falling back to individual comments");
					for (const comment of validComments) {
						try {
							// Make sure we include the diff_hunk for the comment
							const fileInfo = files.find((f) => f.filename === comment.path);
							if (!fileInfo || !fileInfo.patch) {
								core.warning(`Could not find patch for file: ${comment.path}`);
								continue;
							}

							// Extract the relevant part of the patch for this line
							let diffHunk = "";
							const hunkHeaders =
								fileInfo.patch.match(
									/@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@[^\n]*\n(?:(?!@@)[^\n]*\n)*/g,
								) || [];
							for (const hunk of hunkHeaders) {
								const match = hunk.match(
									/@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/,
								);
								if (match) {
									const start = Number.parseInt(match[1], 10);
									const length = match[2] ? Number.parseInt(match[2], 10) : 1;
									if (
										comment.line >= start &&
										comment.line <= start + length - 1
									) {
										diffHunk = hunk;
										break;
									}
								}
							}

							if (!diffHunk) {
								core.warning(
									`Could not find diff hunk for line ${comment.line} in file: ${comment.path}`,
								);
								continue;
							}

							await this.octokit.rest.pulls.createReviewComment({
								owner,
								repo,
								pull_number: prNumber,
								commit_id: headSha,
								path: comment.path,
								body: comment.body,
								line: comment.line,
								side: "RIGHT",
								diff_hunk: diffHunk,
							});
						} catch (commentError) {
							core.error(
								`Error posting comment on ${comment.path}:${comment.line}: ${commentError instanceof Error ? commentError.message : String(commentError)}`,
							);
						}
					}
				}
			} else {
				core.info(
					"No valid line-specific comments to post, skipping review creation",
				);
			}
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

	async getCommentsForPR(prNumber: number): Promise<UserComment[]> {
		const { owner, repo } = this.context.repo;
		core.info(`Fetching comments for PR #${prNumber}...`);

		const comments: UserComment[] = [];

		try {
			// Get issue comments (general PR comments)
			const issueComments = await this.octokit.rest.issues.listComments({
				owner,
				repo,
				issue_number: prNumber,
			});

			// Get PR review comments (inline comments)
			const reviewComments = await this.octokit.rest.pulls.listReviewComments({
				owner,
				repo,
				pull_number: prNumber,
			});

			// Process issue comments
			for (const comment of issueComments.data) {
				// Skip bot comments including our own AI reviews
				if (
					comment.user?.type === "Bot" ||
					comment.body?.startsWith("# Loxops")
				) {
					continue;
				}

				if (comment.user && comment.body && comment.created_at) {
					comments.push({
						id: comment.id.toString(),
						user: comment.user.login,
						body: comment.body,
						createdAt: comment.created_at,
					});
				}
			}

			// Process review comments
			for (const comment of reviewComments.data) {
				// Skip bot comments
				if (comment.user?.type === "Bot") {
					continue;
				}

				if (comment.user && comment.body && comment.created_at) {
					comments.push({
						id: comment.id.toString(),
						user: comment.user.login,
						body: comment.body,
						createdAt: comment.created_at,
						path: comment.path,
						line: comment.line || comment.original_line || undefined,
					});
				}
			}

			core.info(`Found ${comments.length} user comments`);
			return comments;
		} catch (error) {
			if (error instanceof Error) {
				core.warning(`Error fetching comments: ${error.message}`);
			}
			return [];
		}
	}

	async getFilesFromCommit(commitSha: string): Promise<FileChange[]> {
		const { owner, repo } = this.context.repo;
		core.info(`Fetching files changed in commit ${commitSha}...`);

		try {
			const response = await this.octokit.rest.repos.getCommit({
				owner,
				repo,
				ref: commitSha,
			});

			const changedFiles: FileChange[] = [];

			for (const file of response.data.files || []) {
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

			core.info(
				`Found ${changedFiles.length} relevant files in commit ${commitSha}`,
			);
			return changedFiles;
		} catch (error) {
			if (error instanceof Error) {
				core.warning(
					`Error fetching files for commit ${commitSha}: ${error.message}`,
				);
			}
			return [];
		}
	}

	async prepareReviewContext(maxFiles: number): Promise<ReviewContext> {
		const pr = await this.getPullRequestDetails();
		let files: FileChange[] = [];

		// Check if this is a synchronize event (new commits pushed to PR)
		const isSynchronizeEvent = this.context.payload.action === "synchronize";

		if (isSynchronizeEvent && this.context.payload.after) {
			// For synchronize events, only get files from the latest commit
			core.info(
				"PR synchronize event detected - getting only files from latest commit",
			);
			files = await this.getFilesFromCommit(this.context.payload.after);
		} else {
			// For other events, get all files changed in the PR
			files = await this.getChangedFiles(pr.number);
		}

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

		// Fetch user comments
		const userComments = await this.getCommentsForPR(pr.number);

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
			userComments,
		};

		return context;
	}
}
