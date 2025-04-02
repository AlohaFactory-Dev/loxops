import * as github from "@actions/github";
import * as core from "@actions/core";
import type { FileChange, ReviewContext } from "../types";
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
