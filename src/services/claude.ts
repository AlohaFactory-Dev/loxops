import * as core from "@actions/core";
import { Anthropic } from "@anthropic-ai/sdk";
import { getPromptTemplate } from "../templates/base";
import type {
	ReviewComment,
	ReviewContext,
	ReviewOptions,
	StructuredReview,
} from "../types";
import { RepomixService } from "./repomix";

export class ClaudeService {
	private client: Anthropic;
	private options: ReviewOptions;
	private repomixService: RepomixService;

	constructor(apiKey: string, options: ReviewOptions) {
		this.client = new Anthropic({ apiKey });
		this.options = options;
		this.repomixService = new RepomixService();
	}

	async generateReview(context: ReviewContext): Promise<StructuredReview> {
		try {
			core.info("Generating code review with Claude AI...");
			const systemPrompt = await this.buildSystemPrompt(context);
			const responseText = await this.callClaudeApi(systemPrompt);
			return await this.parseClaudeResponse(responseText);
		} catch (error) {
			return this.handleGenerationError(error);
		}
	}

	protected async buildSystemPrompt(context: ReviewContext): Promise<string> {
		const promptTemplate = getPromptTemplate(this.options.projectType);
		let systemPrompt = promptTemplate.generatePrompt(context);

		if (this.options.useRepomix) {
			systemPrompt = await this.addRepomixContext(systemPrompt, context);
		}

		systemPrompt += this.getResponseFormatInstructions();
		return systemPrompt;
	}

	protected async addRepomixContext(
		systemPrompt: string,
		context: ReviewContext,
	): Promise<string> {
		core.info(
			"Using Repomix to pack repository for more comprehensive code review",
		);
		const packedRepo = await this.repomixService.packRepository(context);
		if (packedRepo && !packedRepo.startsWith("Failed")) {
			core.info("Adding packed repository to the prompt");
			return `${systemPrompt}\n\n# Full Repository Context\n\n${packedRepo}`;
		}
		core.warning(
			"Failed to pack repository with Repomix, falling back to basic review",
		);
		return systemPrompt;
	}

	protected getResponseFormatInstructions(): string {
		return `\n\n# Response Format Instructions

You must respond with ONLY a JSON object inside a code block. No other text allowed.

\`\`\`json
{
  "summary": "Brief overall assessment",
  "comments": [
    {
      "path": "file/path.ext",
      "line": 42,
      "priority": "critical|high|medium|low",
      "body": "Comment with markdown formatting"
    }
  ]
}
\`\`\`

## Key Requirements

1. **Structure:** Include only "summary" and "comments" fields
2. **Focus:** Address only 3-5 most important issues
3. **Priority:** Label each comment as "critical", "high", "medium", or "low"
4. **Comments:** Format your comment bodies with markdown:
   - Use code blocks with syntax highlighting
   - Use bullet points and formatting
   - Do NOT include priority text in comments (use the priority field)

## Formatting Guidelines

- Properly escape JSON characters: \\" for quotes, \\n for newlines, \\\` for backticks
- For code blocks use triple backticks with language: \\\`\\\`\\\`language
- Use UTF-8 for Korean or other non-Latin characters without extra escaping

## Example

\`\`\`json
{
  "summary": "코드는 잘 작성되었지만 몇 가지 중요한 이슈가 있습니다:\\n\\n- 일부 함수명이 명확하지 않음\\n- 오류 처리 개선 필요\\n- 성능 이슈",
  "comments": [
    {
      "path": "src/utils.ts",
      "line": 42,
      "priority": "high",
      "body": "함수 이름을 더 명확하게 변경하세요:\\n\\n\\\`\\\`\\\`typescript\\n// Before\\nfunction process(data) { ... }\\n\\n// After\\nfunction validateUserInput(data) { ... }\\n\\\`\\\`\\\`"
    },
    {
      "path": "src/models.ts",
      "line": 57,
      "priority": "critical",
      "body": "예외 처리가 부족합니다. try/catch를 추가하세요."
    }
  ]
}
\`\`\`

Ensure your output is valid JSON and follows this exact structure.`;
	}

	protected async callClaudeApi(systemPrompt: string): Promise<string> {
		core.debug(`Using model: ${this.options.model}`);
		core.debug(`System prompt length: ${systemPrompt.length} characters`);
		core.debug(`System prompt: ${systemPrompt}`);

		const message = await this.client.messages.create({
			model: this.options.model,
			max_tokens: 4000,
			system: systemPrompt,
			messages: [
				{
					role: "user",
					content:
						"제공된 모든 변경사항을 검토하고 포괄적이면서도 간결한 코드 리뷰를 제공해주세요. 중요한 이슈에 집중하고, 구체적인 개선 제안을 코드 예시와 함께 제공해주세요. 변경된 파일과 관련 파일들 간의 잠재적 영향도 분석해주세요. 반드시 지정된 형식(summary와 comments 필드만 포함)의 JSON 형태로 응답해주세요.",
				},
			],
		});

		const responseText = message.content[0].text;
		core.debug(`Claude response: ${responseText}`);
		return responseText;
	}

	protected async parseClaudeResponse(
		responseText: string,
	): Promise<StructuredReview> {
		const jsonString = this.extractJsonFromResponse(responseText);
		try {
			const review = this.parseReviewJson(jsonString);
			return this.filterReviewComments(review);
		} catch (firstError) {
			core.warning(
				`First JSON parsing attempt failed: ${firstError instanceof Error ? firstError.message : String(firstError)}`,
			);
			return this.handleParsingFailure(jsonString, firstError);
		}
	}

	protected extractJsonFromResponse(responseText: string): string {
		// Use a more robust regex to capture JSON within ```json ... ``` or just {...}
		const jsonMatch =
			responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || // Matches ```json { ... } ``` or ``` { ... } ```
			responseText.match(/(\{[\s\S]*\})/); // Fallback to match any {...} block

		if (!jsonMatch) {
			throw new Error(
				"Could not extract JSON review structure from Claude's response",
			);
		}
		// Group 1 contains the JSON content if matched by the first regex, otherwise use the full match
		return (jsonMatch[1] || jsonMatch[0]).trim();
	}

	protected parseReviewJson(jsonString: string): StructuredReview {
		// Apply sanitization *before* parsing
		const sanitizedJson = this.sanitizeJsonString(jsonString);
		core.debug(`Sanitized JSON string: ${sanitizedJson}`); // Add debug log

		const review = JSON.parse(sanitizedJson);

		if (!review.summary || !Array.isArray(review.comments)) {
			const availableFields = Object.keys(review).join(", ");
			throw new Error(
				`Invalid review structure. Available fields: ${availableFields}. Expected 'summary' and 'comments'.`,
			);
		}

		const expectedFields = ["summary", "comments"];
		const actualFields = Object.keys(review);
		const unexpectedFields = actualFields.filter(
			(key) => !expectedFields.includes(key),
		);

		if (unexpectedFields.length > 0) {
			core.warning(
				`Unexpected fields found in Claude response: ${unexpectedFields.join(", ")}. Keeping only 'summary' and 'comments'.`,
			);
			return {
				summary: review.summary,
				comments: Array.isArray(review.comments)
					? review.comments.map(this.sanitizeComment)
					: [], // Sanitize individual comments
			};
		}

		// Sanitize individual comment bodies even if structure is correct
		return {
			summary: review.summary,
			comments: review.comments.map(this.sanitizeComment),
		};
	}

	// New helper method to sanitize individual comment bodies after parsing
	// biome-ignore lint/suspicious/noExplicitAny: This is a workaround to avoid type errors
	protected sanitizeComment(comment: any): ReviewComment {
		if (
			typeof comment.path !== "string" ||
			typeof comment.line !== "number" ||
			typeof comment.body !== "string"
		) {
			core.warning(
				`Invalid comment structure found: ${JSON.stringify(comment)}. Skipping comment.`,
			);
			// Return a placeholder or throw, depending on desired strictness
			return {
				path: "unknown",
				line: 0,
				body: "Error: Invalid comment structure received.",
			};
		}

		// Apply post-parsing cleanup specific to body content if needed
		// (Example: ensure code blocks are formatted correctly if JSON parse didn't handle markdown well)
		// This might be redundant if sanitizeJsonString works perfectly, but adds robustness.
		let body = comment.body;
		// Example: Re-check code block formatting if necessary
		body = body
			.replace(/\\`\\`\\`/g, "```") // Ensure escaped backticks become real ones
			.replace(/\\`/g, "`");

		return {
			path: comment.path,
			line: comment.line,
			priority: comment.priority,
			body: body,
		};
	}

	/**
	 * Cleans the JSON string *before* parsing.
	 * Focuses ONLY on fixing common non-standard escaping issues or structural anomalies
	 * that might come from an LLM, while preserving standard JSON escapes like \" and \n.
	 */
	protected sanitizeJsonString(jsonString: string): string {
		core.debug("Starting JSON sanitization (minimal approach)...");

		let sanitized = jsonString;

		// 1. Fix common double-escaping of backslashes. MUST be done first.
		//    Example: \\" -> \", \\n -> \n, \\` -> \`
		//    This helps ensure subsequent regex doesn't fail on double escapes.
		sanitized = sanitized.replace(/\\\\/g, "\\");

		// 2. Fix incorrectly escaped markdown backticks within JSON strings.
		//    LLMs might escape markdown syntax. JSON standard doesn't use \`.
		//    We assume \\\` should be ` and \\`\\`\\` should be ``` within the string content.
		sanitized = sanitized.replace(/\\`\\`\\`/g, "```"); // \\\`\\\`\\\` -> ```
		sanitized = sanitized.replace(/\\`/g, "`"); // \\\` -> `

		// 3. Normalize code block language identifier format, working WITH standard JSON escapes (e.g., \\n).
		//    Target specific patterns that cause issues, like language identifier alone between \\n.

		// Pattern A: ``` followed by space/escaped newline(s), language, space/escaped newline(s) -> ```language\\n
		// Example: ``` \\n kotlin \\n -> ```kotlin\\n
		sanitized = sanitized.replace(
			/```\s*(\\n)+\s*([a-z]+)\s*(\\n)+\s*/g, // Look for literal \\n sequences
			(match, nl1, lang, nl2) => `\`\`\`${lang}\\n`, // Replace with standardized form using literal \\n
		);
		// Simpler version for ```lang\\n
		sanitized = sanitized.replace(
			/```\s*([a-z]+)\s*\\n/g, // Look for ```lang\\n
			(match, lang) => `\`\`\`${lang}\\n`, // Ensure it's standardized
		);

		// Pattern B: An escaped newline, language identifier, escaped newline, then the start of code.
		//            This specifically targets the case from the first error.
		//            Example: "...\nkotlin\n@Transactional..." -> "...\n\`\`\`kotlin\n@Transactional..."
		//            We need to match literal \\n in the JSON string.
		// Look for a context character (:, ., }), then \\n, language, \\n, code character
		sanitized = sanitized.replace(
			/([:.}])(\\n)([a-z]+)(\\n)(\s*[^`\s{"}])/g, // Match context, \\n, lang, \\n, start of code
			(match, context, nl1, lang, nl2, codeStart) => {
				core.debug(`Sanitizing language on escaped new line: ${match}`);
				// Reconstruct: context + \\n + ``` + language + \\n + codeStart
				return `${context}${nl1}\`\`\`<span class="math-inline">\{lang\}</span>{nl2}${codeStart}`;
			},
		);

		// **** DO NOT UNESCAPE STANDARD JSON SEQUENCES LIKE \\" or \\n ****
		// JSON.parse handles these correctly. Removing the line below fixes the current error.
		// sanitized = sanitized.replace(/\\"/g, '"'); // <-- REMOVED / KEPT COMMENTED OUT

		// **** DO NOT UNESCAPE/RE-ESCAPE \\n or \\t ****
		// The regex above now works directly with the literal \\n sequence.

		core.debug("Finished JSON sanitization (minimal approach).");
		// Return the string with only targeted fixes, letting JSON.parse handle the rest.
		return sanitized;
	}

	// --- Fallback Methods ---
	// Keep these similar to your original code, but ensure they also benefit
	// from the refined understanding of the backtick/language issue if needed.
	// The sanitizeJsonString above should ideally prevent needing these often.

	protected async handleParsingFailure(
		jsonString: string,
		originalError: unknown,
	): Promise<StructuredReview> {
		core.warning("Attempting alternative JSON parsing...");
		try {
			// Try parsing with potentially problematic characters removed/fixed by regex
			// Pass the *original* potentially broken jsonString here
			return this.alternativeJsonParsing(jsonString);
		} catch (secondError) {
			core.warning(
				`Second JSON parsing attempt failed: ${secondError instanceof Error ? secondError.message : String(secondError)}. Falling back to manual extraction.`,
			);
			// Pass the *original* potentially broken jsonString here
			return this.manualExtractionFallback(jsonString);
		}
	}

	// Alternative parsing: less strict, uses regex more heavily
	protected alternativeJsonParsing(rawJsonString: string): StructuredReview {
		core.debug("Executing alternativeJsonParsing");
		// Basic sanitization common in many JSON libs (remove control chars except tab/newline/feed)
		const potentiallyFixableJson = rawJsonString.replace(
			// biome-ignore lint/suspicious/noControlCharactersInRegex: This is a workaround to avoid type errors
			/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,
			"",
		);

		// Attempt to extract summary and comments using regex, assuming basic structure might be there
		const summaryMatch = potentiallyFixableJson.match(
			/"summary"\s*:\s*"((?:\\.|[^"\\])*)"/,
		);
		const summary = summaryMatch
			? summaryMatch[1]
					.replace(/\\n/g, "\n")
					.replace(/\\"/g, '"')
					.replace(/\\`/g, "`")
					.replace(/\\`\\`\\`/g, "```")
			: "Fallback: Could not parse summary.";

		const comments: ReviewComment[] = [];
		// Regex to find comment objects - might be fragile
		const commentBlockMatch = potentiallyFixableJson.match(
			/"comments"\s*:\s*\[([\s\S]*)\]/,
		);
		if (commentBlockMatch?.[1]) {
			const commentObjectsRegex =
				/\{\s*"path"\s*:\s*"((?:\\.|[^"\\])*)"\s*,\s*"line"\s*:\s*(\d+)\s*,\s*"body"\s*:\s*"((?:\\.|[^"\\])*)"\s*\}/g;
			let match: RegExpExecArray | null;
			match = commentObjectsRegex.exec(commentBlockMatch[1]);
			while (match !== null) {
				try {
					const body = match[3]
						.replace(/\\n/g, "\n")
						.replace(/\\"/g, '"')
						// Handle potential escaped backticks AFTER primary unescaping
						.replace(/\\`\\`\\`/g, "```")
						.replace(/\\`/g, "`")
						// Re-apply the fix for language identifiers on new lines
						.replace(/\n([a-z]+)\n(\s*[^`\s])/g, "\n```$1\n$2");

					comments.push({
						path: match[1].replace(/\\\\/g, "\\"), // Handle escaped backslashes in path
						line: Number.parseInt(match[2], 10),
						body: body,
					});
				} catch (e) {
					core.warning(
						`Error parsing individual comment in alternative method: ${e}`,
					);
				}
				match = commentObjectsRegex.exec(commentBlockMatch[1]);
			}
		}

		if (!summaryMatch && comments.length === 0) {
			throw new Error("Alternative parsing failed to extract any useful data.");
		}

		core.info(
			`Alternative parsing extracted summary and ${comments.length} comments.`,
		);
		return { summary, comments };
	}

	// Manual extraction: Last resort, pure regex on the raw string
	protected manualExtractionFallback(
		rawResponseText: string,
	): StructuredReview {
		core.debug("Executing manualExtractionFallback");
		try {
			// Extract summary (more forgiving regex)
			const summaryRegex = /"summary"\s*:\s*"((?:\\.|[^"\\])*)"/; // Capture content of summary string
			const summaryMatch = rawResponseText.match(summaryRegex);
			const summary = summaryMatch
				? summaryMatch[1]
						.replace(/\\n/g, "\n")
						.replace(/\\"/g, '"')
						.replace(/\\`/g, "`")
						.replace(/\\`\\`\\`/g, "```")
				: "Fallback: Could not parse summary.";

			const comments: ReviewComment[] = [];
			// Extract comment objects (more forgiving regex)
			const commentRegex =
				/\{\s*"path"\s*:\s*"((?:\\.|[^"\\])*)"\s*,\s*"line"\s*:\s*(\d+)\s*,\s*"body"\s*:\s*"((?:\\.|[^"\\])*)"\s*\}/g;
			let match: RegExpExecArray | null;
			match = commentRegex.exec(rawResponseText);
			while (match !== null) {
				try {
					const body = match[3]
						.replace(/\\n/g, "\n")
						.replace(/\\"/g, '"')
						// Handle potential escaped backticks AFTER primary unescaping
						.replace(/\\`\\`\\`/g, "```")
						.replace(/\\`/g, "`")
						// Re-apply the fix for language identifiers on new lines
						.replace(/\n([a-z]+)\n(\s*[^`\s])/g, "\n```$1\n$2");

					comments.push({
						path: match[1].replace(/\\\\/g, "\\"), // Handle escaped backslashes in path
						line: Number.parseInt(match[2], 10),
						body: body,
					});
				} catch (e) {
					core.warning(
						`Error parsing individual comment in manual fallback: ${e}`,
					);
				}
				match = commentRegex.exec(rawResponseText);
			}

			core.info(
				`Manual fallback extracted summary and ${comments.length} comments.`,
			);
			if (!summaryMatch && comments.length === 0) {
				core.error("Manual extraction failed to find summary or comments.");
				throw new Error("Manual extraction failed."); // Trigger ultimate fallback
			}
			return { summary, comments };
		} catch (manualError) {
			core.error(
				`Manual extraction failed critically: ${manualError instanceof Error ? manualError.message : String(manualError)}`,
			);
			// Ultimate fallback
			return {
				summary:
					"Code review response parsing failed completely. The response format might be severely incorrect.",
				comments: [],
			};
		}
	}

	/**
	 * Filter and prioritize comments based on user preferences
	 */
	protected filterReviewComments(review: StructuredReview): StructuredReview {
		if (!review.comments || review.comments.length === 0) {
			return review;
		}

		// Sort comments by priority/severity
		const sortedComments = [...review.comments].sort((a, b) => {
			return this.getCommentPriority(b) - this.getCommentPriority(a);
		});

		// Filter by priority level if specified
		let filteredComments = sortedComments;
		if (this.options.commentPriority) {
			const minPriority = this.getMinPriorityLevel(
				this.options.commentPriority,
			);
			filteredComments = sortedComments.filter(
				(comment) => this.getCommentPriority(comment) >= minPriority,
			);
		}

		// Limit number of comments if specified
		if (this.options.maxComments && this.options.maxComments > 0) {
			filteredComments = filteredComments.slice(0, this.options.maxComments);
		}

		// Update summary to reflect filtering if needed
		let summary = review.summary;
		if (filteredComments.length < review.comments.length) {
			const removedCount = review.comments.length - filteredComments.length;
			summary = `${summary}\n\n_참고: ${review.comments.length}개 중 ${filteredComments.length}개의 주요 코멘트만 표시되었습니다. ${removedCount}개의 낮은 우선순위 코멘트는 필터링되었습니다._`;
		}

		return {
			summary,
			comments: filteredComments,
		};
	}

	/**
	 * Extract priority level from comment (critical = 3, high = 2, medium = 1, low = 0)
	 */
	private getCommentPriority(comment: ReviewComment): number {
		// Use the explicit priority field if available
		if (comment.priority) {
			switch (comment.priority) {
				case "critical":
					return 3;
				case "high":
					return 2;
				case "medium":
					return 1;
				case "low":
					return 0;
			}
		}

		return 0;
	}

	/**
	 * Get minimum priority level based on user preference
	 */
	private getMinPriorityLevel(
		priority: "all" | "medium" | "high" | "critical",
	): number {
		switch (priority) {
			case "critical":
				return 3;
			case "high":
				return 2;
			case "medium":
				return 1;
			default:
				return 0;
		}
	}

	protected handleGenerationError(error: unknown): StructuredReview {
		if (error instanceof Error) {
			core.error(`Error during Claude review generation: ${error.message}`);
			// Include stack trace in debug log if available
			if (error.stack) {
				core.debug(error.stack);
			}
			return {
				summary: `Error generating code review: ${error.message}`,
				comments: [],
			};
		}
		core.error("Unknown error during Claude review generation");
		return {
			summary: "Unknown error generating code review.",
			comments: [],
		};
	}
}
