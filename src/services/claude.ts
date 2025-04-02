import { Anthropic } from "@anthropic-ai/sdk";
import * as core from "@actions/core";
import type {
	ReviewContext,
	ReviewOptions,
	StructuredReview,
	ReviewComment,
} from "../types";
import { getPromptTemplate } from "../templates/base";
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
		// Keep this the same as in your original code
		return `\n\n# Response Format
Please provide your review in a structured JSON format that MUST ONLY include these exact fields:
1. "summary" - A string with overall feedback
2. "comments" - An array of comment objects

Your ENTIRE response must be valid JSON enclosed in a markdown code block. Do not include any text, explanations, or comments outside the JSON code block.

The JSON MUST follow this exact structure:
{
  "summary": string,
  "comments": [
    {
      "path": string,
      "line": number,
      "body": string
    },
    ...
  ]
}

DO NOT add any extra fields to this structure. Fields like "overview", "keyChanges", "recommendedImprovements", "potentialRisks", or any other fields not explicitly listed above are NOT allowed and will cause parsing errors.

Format both the "summary" and comment "body" fields as markdown text. This allows you to include:
- Code blocks with syntax highlighting
- Bullet points and numbered lists
- Bold/italic text for emphasis
- Links to documentation when relevant

IMPORTANT: When including code snippets or special characters in your response, ensure they are properly escaped for JSON. Double quotes must be escaped with a backslash (\\"), newlines with \\n, tabs with \\t, and backslashes themselves with a double backslash (\\\\).

IMPORTANT: When using code blocks with backticks in your response, each backtick should be properly escaped as \\\` in the JSON. For triple backticks that start/end code blocks, use \\\`\\\`\\\` in the JSON.

When writing Korean or other non-Latin characters, make sure they are properly encoded in UTF-8. Do not add extra escape sequences for non-Latin characters.

The newlines in markdown should be properly escaped in the JSON as "\\n".

Example format:
\`\`\`json
{
  "summary": "전반적으로 코드는 잘 구성되어 있지만, 몇 가지 개선할 영역이 있습니다:\\n\\n- 일부 함수명이 더 명확할 수 있음\\n- 오류 처리가 향상될 수 있음\\n- 더 많은 단위 테스트를 고려해보세요",
  "comments": [
    {
      "path": "src/utils/parser.ts",
      "line": 42,
      "body": "이 함수 이름이 설명적이지 않습니다. 무엇을 하는지 더 명확하게 설명하도록 이름을 변경하는 것을 고려하세요.\\n\\n예시:\\n\\n\\\`\\\`\\\`typescript\\n// 대신\\nfunction process(data) {\\n  // ...\\n}\\n\\n// 다음과 같이 고려\\nfunction validateUserInput(data) {\\n  // ...\\n}\\n\\\`\\\`\\\`"
    },
    {
      "path": "src/models/user.ts",
      "line": 57,
      "body": "오류 처리를 개선할 수 있습니다. try/catch 블록을 사용하고 더 구체적인 오류 메시지를 제공하는 것을 고려하세요."
    }
  ]
}
\`\`\`

Please ensure your JSON is valid and properly formatted. Make sure to escape any special characters in the JSON to prevent parsing errors.`;
	}

	protected async callClaudeApi(systemPrompt: string): Promise<string> {
		core.debug(`Using model: ${this.options.model}`);
		core.debug(`System prompt length: ${systemPrompt.length} characters`);

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
			return this.parseReviewJson(jsonString);
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
