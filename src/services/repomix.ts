import * as core from "@actions/core";
import * as path from "node:path";
import * as fs from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { ReviewContext } from "../types";

const execAsync = promisify(exec);

export class RepomixService {
	/**
	 * Packs the repository using Repomix and returns the content
	 * to be used by Claude for a more comprehensive code review
	 */
	async packRepository(context: ReviewContext): Promise<string> {
		try {
			core.info("Packing repository with Repomix...");

			// Create a temp directory for the output
			const tempDir = path.join(process.cwd(), ".repomix-temp");
			if (!fs.existsSync(tempDir)) {
				fs.mkdirSync(tempDir);
			}

			// Output file path
			const outputFilePath = path.join(tempDir, "repo-pack.md");

			// Create a basic config file for Repomix
			const configFilePath = path.join(tempDir, "repomix.config.json");
			const config = {
				output: {
					path: outputFilePath,
					includeRepositoryStructure: true,
					removeComments: false,
					instructionFilePath: null,
				},
				ignore: {
					useGitignore: true,
					useDefaultPatterns: true,
					customPatterns: context.files
						.filter((f) => f.status === "removed")
						.map((f) => f.filename),
				},
				security: {
					enableSecurityCheck: true,
				},
			};

			fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));

			// Run Repomix CLI command
			core.info("Running Repomix...");
			const { stdout, stderr } = await execAsync(
				`npx repomix --config ${configFilePath}`,
			);

			if (stderr) {
				core.warning(`Repomix warnings: ${stderr}`);
			}

			core.info(`Repomix output: ${stdout}`);

			// Read the packed file
			if (!fs.existsSync(outputFilePath)) {
				throw new Error("Repomix did not generate the output file");
			}

			const packedContent = fs.readFileSync(outputFilePath, "utf8");

			// Clean up
			try {
				fs.unlinkSync(outputFilePath);
				fs.unlinkSync(configFilePath);
				fs.rmdirSync(tempDir);
			} catch (cleanupError) {
				core.warning(
					`Failed to clean up temporary files: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
				);
			}

			core.info(
				`Repository packed successfully - ${(packedContent.length / 1024).toFixed(2)} KB`,
			);
			return packedContent;
		} catch (error) {
			core.error(
				`Failed to pack repository: ${error instanceof Error ? error.message : String(error)}`,
			);
			return "Failed to pack repository with Repomix";
		}
	}

	/**
	 * Creates a custom instruction file for Repomix
	 * based on the PR context and the review requirements
	 */
	createInstructionFile(context: ReviewContext): string {
		const tempDir = path.join(process.cwd(), ".repomix-temp");
		if (!fs.existsSync(tempDir)) {
			fs.mkdirSync(tempDir);
		}

		const instructionPath = path.join(tempDir, "review-instructions.md");

		// Create detailed instructions for Claude
		const instructions = `# Code Review Instructions

## Pull Request Information
- **PR Title:** ${context.pullRequestTitle}
- **PR Number:** ${context.pullRequestNumber}
- **Repository:** ${context.repositoryOwner}/${context.repositoryName}
- **Branch:** ${context.branch}
- **Base:** ${context.baseRef}

## Changed Files
Please focus your review on these files that were changed in the PR:
${context.files.map((file) => `- \`${file.filename}\` (${file.status})`).join("\n")}

## Review Guidelines
1. Identify bugs, security issues, and potential problems
2. Suggest code improvements for readability and maintainability
3. Check for performance issues
4. Ensure proper error handling
5. Verify code follows project patterns and conventions
6. Provide specific, actionable feedback with code examples

## Repository Context
The code above contains the full repository context to help you understand the codebase better.
`;

		fs.writeFileSync(instructionPath, instructions);
		return instructionPath;
	}
}
