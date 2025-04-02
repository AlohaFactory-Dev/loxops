import * as core from "@actions/core";
import type {
	FileChange,
	RelatedFiles,
	ReviewContext,
	ReviewOptions,
} from "../types";
import * as github from "@actions/github";
import ignore from "ignore";
import path from "node:path";

export class FileAnalyzerService {
	private options: ReviewOptions;
	private ignoreFilter: ReturnType<typeof ignore>;
	private octokit: ReturnType<typeof github.getOctokit>;
	private context = github.context;

	constructor(token: string, options: ReviewOptions) {
		this.options = options;
		this.octokit = github.getOctokit(token);

		// Set up ignore filter
		this.ignoreFilter = ignore().add(options.excludePatterns);
	}

	shouldAnalyzeFile(filename: string): boolean {
		// Check if file should be ignored
		if (this.ignoreFilter.ignores(filename)) {
			return false;
		}

		// Check if file extension is in the list of extensions to analyze
		const ext = path.extname(filename);
		return this.options.fileExtensions.includes(ext);
	}

	detectProjectType(
		files: FileChange[],
	): "unity" | "springboot" | "android" | "nextjs" {
		// Check for Unity project indicators
		const hasUnityFiles = files.some(
			(file) =>
				file.filename.endsWith(".cs") ||
				file.filename.includes("/Assets/") ||
				file.filename.includes("Assembly-CSharp.csproj"),
		);

		if (hasUnityFiles) {
			return "unity";
		}

		// Check for Spring Boot project indicators
		const hasSpringBootFiles = files.some(
			(file) =>
				file.filename.includes("application.properties") ||
				file.filename.includes("application.yml") ||
				file.filename.includes("build.gradle") ||
				file.filename.includes("pom.xml") ||
				(file.filename.endsWith(".java") &&
					(file.fullContent?.includes("@SpringBootApplication") ||
						file.fullContent?.includes("import org.springframework"))),
		);

		if (hasSpringBootFiles) {
			return "springboot";
		}

		// Check for Android project indicators
		const hasAndroidFiles = files.some(
			(file) =>
				file.filename.includes("AndroidManifest.xml") ||
				file.filename.includes("build.gradle") ||
				file.filename.endsWith(".kt") ||
				(file.filename.endsWith(".java") &&
					(file.fullContent?.includes("import android.") ||
						file.fullContent?.includes("extends Activity"))),
		);

		if (hasAndroidFiles) {
			return "android";
		}

		// Check for Next.js project indicators
		const hasNextJsFiles = files.some(
			(file) =>
				file.filename.includes("next.config.js") ||
				file.filename.includes("pages/") ||
				file.filename.includes("app/") ||
				(file.filename.endsWith(".js") &&
					file.fullContent?.includes("import { useRouter }")) ||
				(file.filename.endsWith(".tsx") &&
					file.fullContent?.includes("import { GetServerSideProps }")),
		);

		if (hasNextJsFiles) {
			return "nextjs";
		}

		// Default to Next.js if we can't determine the project type (since it's the most generic)
		return "nextjs";
	}

	async findRelatedFiles(context: ReviewContext): Promise<RelatedFiles> {
		if (!this.options.findRelatedFiles) {
			return {};
		}

		core.info("Finding related files...");
		const relatedFiles: RelatedFiles = {};
		const { owner, repo } = this.context.repo;

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
