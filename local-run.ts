import * as dotenv from "dotenv";
import * as core from "@actions/core";
import { ClaudeService } from "./src/services/claude";
import { GitHubService } from "./src/services/github";
import { FileAnalyzerService } from "./src/services/file-analyzer";
import * as github from "@actions/github";
import type {
	FileChange,
	ProjectType,
	ReviewOptions,
	ReviewContext,
	StructuredReview,
	ReviewComment,
	RelatedFiles,
} from "./src/types";
import path from "node:path";

// Load environment variables from .env file
dotenv.config();

// Extend FileAnalyzerService to override findRelatedFiles for local use
class LocalFileAnalyzerService extends FileAnalyzerService {
	private ownerName: string;
	private repoName: string;

	constructor(
		token: string,
		options: ReviewOptions,
		owner: string,
		repo: string,
	) {
		super(token, options);
		this.ownerName = owner;
		this.repoName = repo;
	}

	// Override findRelatedFiles to use local owner/repo
	async findRelatedFiles(context: ReviewContext): Promise<RelatedFiles> {
		if (!this.options.findRelatedFiles) {
			return {};
		}

		core.info("Finding related files...");
		const relatedFiles: RelatedFiles = {};
		// Use local owner/repo instead of context.repo
		const owner = this.ownerName;
		const repo = this.repoName;

		// For each changed file, search for related files
		for (const file of context.files) {
			const filename = path.basename(file.filename);
			const fileNameWithoutExt = path.basename(
				filename,
				path.extname(filename),
			);

			// Skip files that were removed
			if (file.status === "removed") {
				continue;
			}

			try {
				// Simple approach: search for files containing the name of the changed file
				const searchResult = await this.octokit.rest.search.code({
					q: `repo:${owner}/${repo} ${fileNameWithoutExt} in:file`,
					per_page: 30,
				});

				const related = searchResult.data.items
					.filter(
						(item) =>
							// Exclude the file itself
							item.path !== file.filename &&
							// Make sure the file extension is in our list
							this.shouldAnalyzeFile(item.path) &&
							// Make sure the file is not in the ignore list
							!this.ignoreFilter.ignores(item.path),
					)
					.map((item) => item.path);

				if (related.length > 0) {
					relatedFiles[file.filename] = related;
				}
			} catch (error) {
				if (error instanceof Error) {
					core.warning(
						`Error finding related files for ${file.filename}: ${error.message}`,
					);
				}
			}
		}

		core.info(
			`Found related files for ${Object.keys(relatedFiles).length} changed files`,
		);
		return relatedFiles;
	}
}

// Extend GitHubService to override methods for local use
class LocalGitHubService extends GitHubService {
	private ownerName: string;
	private repoName: string;
	private prNumber: number;

	constructor(
		token: string,
		fileAnalyzer: FileAnalyzerService,
		owner: string,
		repo: string,
		prNumber: number,
	) {
		super(token, fileAnalyzer);
		this.ownerName = owner;
		this.repoName = repo;
		this.prNumber = prNumber;
	}

	// Override getPullRequestDetails to fetch PR directly using octokit
	async getPullRequestDetails(): Promise<{
		number: number;
		title: string;
		body: string | null;
		head: { ref: string; sha: string };
		base: { ref: string };
	}> {
		const { data: pr } = await this.octokit.rest.pulls.get({
			owner: this.ownerName,
			repo: this.repoName,
			pull_number: this.prNumber,
		});

		return {
			number: pr.number,
			title: pr.title,
			body: pr.body,
			head: {
				ref: pr.head.ref,
				sha: pr.head.sha,
			},
			base: {
				ref: pr.base.ref,
			},
		};
	}

	// Override getChangedFiles to use local owner/repo
	async getChangedFiles(prNumber: number): Promise<FileChange[]> {
		core.info(`Fetching changed files for PR #${prNumber}...`);
		const changedFiles: FileChange[] = [];
		let page = 1;
		let hasMorePages = true;

		while (hasMorePages) {
			const response = await this.octokit.rest.pulls.listFiles({
				owner: this.ownerName,
				repo: this.repoName,
				pull_number: prNumber,
				per_page: 100,
				page,
			});

			if (response.data.length === 0) {
				hasMorePages = false;
				break;
			}

			for (const file of response.data) {
				// Use fileAnalyzer from the base class property
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

	// Override getFileContent to use local owner/repo
	async getFileContent(filepath: string, ref: string): Promise<string> {
		try {
			const response = await this.octokit.rest.repos.getContent({
				owner: this.ownerName,
				repo: this.repoName,
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

	// Override prepareReviewContext to fully replicate base logic using local owner/repo
	async prepareReviewContext(maxFiles: number): Promise<ReviewContext> {
		// Fetch PR details using the overridden method
		const pr = await this.getPullRequestDetails();

		// Fetch changed files using the overridden method
		let files = await this.getChangedFiles(pr.number);

		// Limit number of files to analyze
		if (files.length > maxFiles) {
			core.warning(
				`Limiting analysis to ${maxFiles} files out of ${files.length} changed files`,
			);
			files = files.slice(0, maxFiles);
		}

		// Fetch full content for each file using the overridden method
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

		// Prepare review context using local owner/repo names
		const context: ReviewContext = {
			pullRequestNumber: pr.number,
			pullRequestTitle: pr.title,
			pullRequestBody: pr.body,
			repositoryName: this.repoName, // Use local repoName
			repositoryOwner: this.ownerName, // Use local ownerName
			branch: pr.head.ref,
			baseRef: pr.base.ref,
			files,
			relatedFiles: {}, // Initialize relatedFiles
		};

		return context;
	}

	// Override createReviewComment to use local owner/repo
	async createReviewComment(prNumber: number, review: string): Promise<void> {
		try {
			await this.octokit.rest.issues.createComment({
				owner: this.ownerName,
				repo: this.repoName,
				issue_number: prNumber,
				body: `# AI 코드 리뷰\n\n${review}`,
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

	// Override createReviewWithComments to use local owner/repo
	async createReviewWithComments(
		prNumber: number,
		review: StructuredReview,
	): Promise<void> {
		const { summary, comments } = review;

		try {
			// Check if the summary is from an error in Claude service
			const isErrorSummary =
				summary.includes("코드 리뷰 응답 파싱에 실패했습니다") ||
				summary.includes("Claude 코드 리뷰 생성 중 오류가 발생했습니다") ||
				summary.includes("알 수 없는 오류로 코드 리뷰를 생성할 수 없습니다");

			// Only post regular comment if it's not an error summary
			if (!isErrorSummary) {
				// First post the overall review as a regular comment
				await this.octokit.rest.issues.createComment({
					owner: this.ownerName,
					repo: this.repoName,
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
				owner: this.ownerName,
				repo: this.repoName,
				pull_number: prNumber,
			});

			const headSha = prResponse.data.head.sha;

			// Get the PR diff to determine which lines are part of the diff
			const { data: files } = await this.octokit.rest.pulls.listFiles({
				owner: this.ownerName,
				repo: this.repoName,
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
				.filter((comment: ReviewComment) => {
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
				.map((comment: ReviewComment) => ({
					path: comment.path,
					line: comment.line,
					body: comment.body || "No comment provided",
				}));

			// Only create review if we have valid comments
			if (validComments.length > 0) {
				try {
					// Create the review with line-specific comments
					await this.octokit.rest.pulls.createReview({
						owner: this.ownerName,
						repo: this.repoName,
						pull_number: prNumber,
						commit_id: headSha,
						body: "# AI 코드 리뷰 - 라인별 코멘트",
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
								owner: this.ownerName,
								repo: this.repoName,
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

				// Fallback to posting a regular comment using the overridden method
				try {
					core.info("Falling back to posting a regular comment");
					await this.createReviewComment(
						prNumber,
						`${summary}\n\n## 상세 코멘트\n\n${comments.map((c: ReviewComment) => `- **${c.path}:${c.line}**: ${c.body}`).join("\n\n")}`,
					);
				} catch (fallbackError) {
					core.error("Fallback comment also failed");
				}
			} else {
				core.error("Unknown error posting review");
			}
		}
	}
}

async function runLocal(): Promise<void> {
	try {
		// Get required parameters
		const githubToken = process.env.GITHUB_TOKEN;
		const claudeApiKey = process.env.CLAUDE_API_KEY;
		const pullRequestUrl = process.env.PULL_REQUEST_URL;

		if (!githubToken) {
			throw new Error("GITHUB_TOKEN is required");
		}

		if (!claudeApiKey) {
			throw new Error("CLAUDE_API_KEY is required");
		}

		if (!pullRequestUrl) {
			throw new Error("PULL_REQUEST_URL is required");
		}

		// Parse PR URL to get owner, repo, and PR number
		const prUrlMatch = pullRequestUrl.match(
			/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/,
		);
		if (!prUrlMatch) {
			throw new Error("Invalid PULL_REQUEST_URL format");
		}

		const [, owner, repo, prNumberStr] = prUrlMatch;
		const prNumber = Number.parseInt(prNumberStr, 10);
		console.log(`Repository: ${owner}/${repo}`);
		console.log(`Pull Request: #${prNumber}`);

		// Get optional parameters with defaults
		const projectType = (process.env.PROJECT_TYPE || "auto") as ProjectType;
		const fileExtensions = (
			process.env.FILE_EXTENSIONS ||
			".ts,.js,.tsx,.jsx,.cs,.java,.kt,.xml,.json,.yaml,.yml"
		).split(",");
		const excludePatterns = (
			process.env.EXCLUDE_PATTERNS ||
			"node_modules/**,dist/**,build/**,*.min.js,*.test.*"
		).split(",");
		const findRelatedFiles = process.env.FIND_RELATED_FILES !== "false";
		const maxFiles = Number.parseInt(process.env.MAX_FILES || "10", 10);
		const model = process.env.MODEL || "claude-3-5-haiku-20241022";
		const useRepomix = process.env.USE_REPOMIX !== "false";
		const commentStdout = process.env.COMMENT_STDOUT === "true";

		console.log(`Project Type: ${projectType}`);
		console.log(`Max Files: ${maxFiles}`);
		console.log(`Model: ${model}`);
		console.log(`Print comments to stdout: ${commentStdout}`);

		// Initialize options
		const options: ReviewOptions = {
			projectType,
			fileExtensions,
			excludePatterns,
			findRelatedFiles,
			maxFiles,
			model,
			useRepomix,
			commentStdout,
		};

		// Initialize services with local versions
		console.log("Initializing services...");
		const fileAnalyzerService = new LocalFileAnalyzerService(
			githubToken,
			options,
			owner,
			repo,
		);
		const githubService = new LocalGitHubService(
			githubToken,
			fileAnalyzerService,
			owner,
			repo,
			prNumber,
		);
		const claudeService = new ClaudeService(claudeApiKey, options);

		// Prepare review context
		console.log("Preparing review context...");
		const context = await githubService.prepareReviewContext(maxFiles);

		// Find related files if enabled
		if (options.findRelatedFiles) {
			console.log("Finding related files...");
			context.relatedFiles =
				await fileAnalyzerService.findRelatedFiles(context);
		}

		// Generate code review
		console.log("Generating code review...");
		const review = await claudeService.generateReview(context);

		// Post review as a comment or print to stdout
		if (options.commentStdout) {
			// Print the review to stdout instead of posting to PR
			console.log("\n\n========== CODE REVIEW ==========\n");
			console.log(`# AI 코드 리뷰\n\n${review.summary}`);

			if (review.comments.length > 0) {
				console.log("\n## 상세 코멘트\n");
				for (const comment of review.comments) {
					console.log(`- **${comment.path}:${comment.line}**: ${comment.body}`);
				}
			}
			console.log("\n=================================\n");

			console.log("Code review completed successfully (printed to stdout)");
		} else {
			// Post review as a comment on the PR with line-specific comments
			console.log("Posting review to PR...");
			// Use the correct octokit instance for posting comments
			await githubService.createReviewWithComments(
				context.pullRequestNumber,
				review,
			);

			console.log("Code review completed successfully");
		}
	} catch (error) {
		if (error instanceof Error) {
			console.error(`Error: ${error.message}`);
		} else {
			console.error("Unknown error occurred");
		}
		process.exit(1);
	}
}

runLocal();
