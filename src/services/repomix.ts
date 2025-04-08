import { exec } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";
import * as core from "@actions/core";
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
			const outputFilePath = path.join(tempDir, "repomix-output.xml");

			// Create a basic config file for Repomix
			const configFilePath = path.join(tempDir, "repomix.config.json");

			const config = {
				output: {
					path: outputFilePath,
					includeRepositoryStructure: true,
					removeComments: false,
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
}
