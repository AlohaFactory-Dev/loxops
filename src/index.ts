import * as core from "@actions/core";
import { ClaudeService } from "./services/claude";
import { GitHubService } from "./services/github";
import { FileAnalyzerService } from "./services/file-analyzer";
import type { ProjectType, ReviewOptions } from "./types";

async function run(): Promise<void> {
	try {
		// Get inputs from GitHub Action
		const githubToken = core.getInput("github-token", { required: true });
		const claudeApiKey = core.getInput("claude-api-key", { required: true });
		const projectType = core.getInput("project-type") as ProjectType;
		const fileExtensions = core.getInput("file-extensions").split(",");
		const excludePatterns = core.getInput("exclude-patterns").split(",");
		const findRelatedFiles = core.getInput("find-related-files") === "true";
		const maxFiles = Number.parseInt(core.getInput("max-files"), 10);
		const model = core.getInput("model");
		const useRepomix = core.getInput("use-repomix") === "true";

		// Initialize options
		const options: ReviewOptions = {
			projectType,
			fileExtensions,
			excludePatterns,
			findRelatedFiles,
			maxFiles,
			model,
			useRepomix,
		};

		// Initialize services
		const fileAnalyzerService = new FileAnalyzerService(githubToken, options);
		const githubService = new GitHubService(githubToken, fileAnalyzerService);
		const claudeService = new ClaudeService(claudeApiKey, options);

		// Prepare review context
		const context = await githubService.prepareReviewContext(maxFiles);

		// Auto-detect project type if set to 'auto'
		if (options.projectType === "auto") {
			options.projectType = fileAnalyzerService.detectProjectType(
				context.files,
			);
			core.info(`Auto-detected project type: ${options.projectType}`);
		}

		// Find related files if enabled
		if (options.findRelatedFiles) {
			context.relatedFiles =
				await fileAnalyzerService.findRelatedFiles(context);
		}

		// Generate code review
		const review = await claudeService.generateReview(context);

		// Post review as a comment on the PR with line-specific comments
		await githubService.createReviewWithComments(
			context.pullRequestNumber,
			review,
		);

		core.info("Code review completed successfully");
	} catch (error) {
		if (error instanceof Error) {
			core.setFailed(`Action failed with error: ${error.message}`);
		} else {
			core.setFailed("Action failed with an unknown error");
		}
	}
}

run();
