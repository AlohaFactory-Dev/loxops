import { Anthropic } from "@anthropic-ai/sdk";
import * as core from "@actions/core";
import type { ReviewContext, ReviewOptions, StructuredReview } from "../types";
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

				// Create instruction file for Repomix
				const instructionFile =
					this.repomixService.createInstructionFile(context);

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

The newlines in markdown should be properly escaped in the JSON as "\\n".

Example format:
\`\`\`json
{
  "summary": "## Overall Review\\n\\nThis is a markdown formatted summary with **bold text** and a list:\\n- Item 1\\n- Item 2",
  "comments": [
    {
      "path": "src/example.ts",
      "line": 42,
      "body": "Consider using a more descriptive name. Example:\\n\\n\`\`\`typescript\\nconst userId = data.id;\\n\`\`\`"
    }
  ]
}
\`\`\`

IMPORTANT: Ensure that the JSON is valid and properly escaped, especially for quotes, control characters, and special characters in strings. All markdown must be properly escaped within the JSON strings.
`;

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
							"제공된 모든 변경사항을 검토하고 포괄적이면서도 간결한 코드 리뷰를 제공해주세요. 중요한 이슈에 집중하고, 구체적인 개선 제안을 코드 예시와 함께 제공해주세요. 변경된 파일과 관련 파일들 간의 잠재적 영향도 분석해주세요. JSON 형식으로 응답해주세요.",
					},
				],
			});

			const responseText = message.content[0].text;

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

			// Sanitize JSON string by manually removing control characters
			let sanitizedJson = "";
			for (let i = 0; i < jsonString.length; i++) {
				const charCode = jsonString.charCodeAt(i);
				// Skip control characters
				if (
					(charCode >= 0x20 && charCode !== 0x7f) ||
					charCode === 0x09 ||
					charCode === 0x0a ||
					charCode === 0x0d
				) {
					sanitizedJson += jsonString[i];
				}
			}

			try {
				const review = JSON.parse(sanitizedJson);

				// Ensure the review has the expected structure
				if (!review.summary || !Array.isArray(review.comments)) {
					throw new Error("Invalid review structure received from Claude");
				}

				return review as StructuredReview;
			} catch (jsonError) {
				core.error(
					`JSON parsing error: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`,
				);
				core.debug(
					`Failed to parse JSON: ${sanitizedJson.substring(0, 500)}...`,
				);

				// Fallback to a simpler structure
				return {
					summary:
						"코드 리뷰 응답 파싱에 실패했습니다. JSON 형식이 올바르지 않습니다.",
					comments: [],
				};
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
