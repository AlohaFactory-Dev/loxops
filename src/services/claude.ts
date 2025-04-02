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

			// Get the prompt template based on project type
			const promptTemplate = getPromptTemplate(this.options.projectType);
			let systemPrompt = promptTemplate.generatePrompt(context);

			// If the use of Repomix is enabled, pack the repository
			if (this.options.useRepomix) {
				core.info(
					"Using Repomix to pack repository for more comprehensive code review",
				);

				// Pack the repository
				const packedRepo = await this.repomixService.packRepository(context);

				// Add packed repo to the system prompt
				if (packedRepo && !packedRepo.startsWith("Failed")) {
					core.info("Adding packed repository to the prompt");
					systemPrompt = `${systemPrompt}\n\n# Full Repository Context\n\n${packedRepo}`;
				} else {
					core.warning(
						"Failed to pack repository with Repomix, falling back to basic review",
					);
				}
			}

			systemPrompt += `\n\n# Response Format
Please provide your review in a structured JSON format that includes:
1. A summary section with overall feedback
2. Line-specific comments for each file

Your ENTIRE response must be valid JSON enclosed in a markdown code block. Do not include any text, explanations, or comments outside the JSON code block.

Format both the "summary" and comment "body" fields as markdown text. This allows you to include:
- Code blocks with syntax highlighting
- Bullet points and numbered lists
- Bold/italic text for emphasis
- Links to documentation when relevant

IMPORTANT: When including code snippets or special characters in your response, ensure they are properly escaped for JSON. Double quotes must be escaped with a backslash (\\"), newlines with \\n, tabs with \\t, and backslashes themselves with a double backslash (\\\\).

The newlines in markdown should be properly escaped in the JSON as "\\n".

Example format:
\`\`\`json
{
  "summary": "Overall the code is well-structured, but there are a few areas for improvement:\\n\\n- Some function names could be more descriptive\\n- Error handling could be improved\\n- Consider adding more unit tests",
  "comments": [
    {
      "path": "src/utils/parser.ts",
      "line": 42,
      "body": "This function name is not descriptive. Consider renaming to describe what it does more clearly.\\n\\nExample:\\n\\n\`\`\`typescript\\n// Instead of\\nfunction process(data) {\\n  // ...\\n}\\n\\n// Consider\\nfunction validateUserInput(data) {\\n  // ...\\n}\\n\`\`\`"
    },
    {
      "path": "src/models/user.ts",
      "line": 57,
      "body": "Error handling can be improved here. Consider using a try/catch block and providing more specific error messages."
    }
  ]
}
\`\`\`

Please ensure your JSON is valid and properly formatted. Make sure to escape any special characters in the JSON to prevent parsing errors.`;

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
							"제공된 모든 변경사항을 검토하고 포괄적이면서도 간결한 코드 리뷰를 제공해주세요. 중요한 이슈에 집중하고, 구체적인 개선 제안을 코드 예시와 함께 제공해주세요. 변경된 파일과 관련 파일들 간의 잠재적 영향도 분석해주세요.",
					},
				],
			});

			const responseText = message.content[0].text;
			core.debug(`Claude response: ${responseText}`);

			// Extract JSON from the response
			const jsonMatch =
				responseText.match(/```json\n([\s\S]*?)\n```/) ||
				responseText.match(/```\n([\s\S]*?)\n```/) ||
				responseText.match(/{[\s\S]*}/);

			if (!jsonMatch) {
				throw new Error(
					"Could not parse JSON review structure from Claude's response",
				);
			}

			const jsonString = jsonMatch[0].replace(/```json\n|```\n|```/g, "");

			// Enhanced JSON sanitization to handle all problematic characters
			let sanitizedJson = "";
			try {
				// First attempt: Advanced sanitization of JSON string
				// Handle various control/special characters that could cause issues
				sanitizedJson = jsonString
					// Replace common escape sequence issues
					.replace(/\n/g, "\\n")
					.replace(/\r/g, "\\r")
					.replace(/\t/g, "\\t")
					// Remove problematic ASCII control characters (0-31)
					.split("")
					.filter(
						(char) =>
							char.charCodeAt(0) > 31 ||
							char === "\n" ||
							char === "\r" ||
							char === "\t",
					)
					.join("")
					// Remove problematic Unicode characters
					.split("")
					.filter((char) => {
						const code = char.charCodeAt(0);
						return (
							code !== 0x2028 &&
							code !== 0x2029 &&
							code !== 0xfeff &&
							code !== 0x85 &&
							code !== 0x0b
						);
					})
					.join("")
					// Fix double-escaped quotes in code blocks
					.replace(/\\\\"/g, '\\"')
					// Clean up any double escape sequences
					.replace(/\\\\/g, "\\");

				// Attempt to parse with the sanitized string
				const review = JSON.parse(sanitizedJson);

				// Ensure the review has the expected structure
				if (!review.summary || !Array.isArray(review.comments)) {
					throw new Error("Invalid review structure received from Claude");
				}

				return review as StructuredReview;
			} catch (firstError) {
				core.warning(
					`First JSON parsing attempt failed: ${firstError instanceof Error ? firstError.message : String(firstError)}`,
				);

				// Second attempt: Character-by-character sanitization
				try {
					sanitizedJson = "";
					for (let i = 0; i < jsonString.length; i++) {
						const char = jsonString[i];
						const charCode = jsonString.charCodeAt(i);

						// Include only safe characters
						// Printable ASCII (32-126) plus safe whitespace characters
						if (
							(charCode >= 32 && charCode <= 126) ||
							char === "\n" ||
							char === "\r" ||
							char === "\t"
						) {
							sanitizedJson += char;
						}
					}

					// Try to parse again
					const review = JSON.parse(sanitizedJson);

					// Validate structure
					if (!review.summary || !Array.isArray(review.comments)) {
						throw new Error("Invalid review structure after sanitization");
					}

					return review as StructuredReview;
				} catch (secondError) {
					core.warning(
						`Second JSON parsing attempt failed: ${secondError instanceof Error ? secondError.message : String(secondError)}`,
					);

					// Last resort: Try to extract summary and comments manually
					try {
						// Manual extraction of summary using safer regex approach
						const summaryRegex = /"summary"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/;
						const summaryMatch = jsonString.match(summaryRegex);
						const summary = summaryMatch
							? summaryMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"')
							: "코드 리뷰 요약을 파싱할 수 없습니다.";

						// Attempt to extract comments with safer regex approach
						const comments: ReviewComment[] = [];
						const commentRegex =
							/"path"\s*:\s*"([^"]*)"\s*,\s*"line"\s*:\s*(\d+)\s*,\s*"body"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/g;

						let match: RegExpExecArray | null = null;
						// Use a safer approach without assignment in the condition
						match = commentRegex.exec(jsonString);
						while (match !== null) {
							comments.push({
								path: match[1],
								line: Number.parseInt(match[2], 10),
								body: match[3].replace(/\\n/g, "\n").replace(/\\"/g, '"'),
							});
							match = commentRegex.exec(jsonString);
						}

						core.info(`Manually extracted ${comments.length} comments`);
						return { summary, comments };
					} catch (manualError) {
						core.error(
							`Manual extraction failed: ${manualError instanceof Error ? manualError.message : String(manualError)}`,
						);

						// Ultimate fallback
						return {
							summary:
								"코드 리뷰 응답 파싱에 실패했습니다. JSON 형식이 올바르지 않습니다.",
							comments: [],
						};
					}
				}
			}
		} catch (error) {
			if (error instanceof Error) {
				core.error(`Claude API 호출 중 오류 발생: ${error.message}`);
				return {
					summary: `Claude 코드 리뷰 생성 중 오류가 발생했습니다: ${error.message}`,
					comments: [],
				};
			}
			core.error("Claude API 호출 중 알 수 없는 오류가 발생했습니다");
			return {
				summary: "알 수 없는 오류로 코드 리뷰를 생성할 수 없습니다",
				comments: [],
			};
		}
	}
}
