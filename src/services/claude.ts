import { Anthropic } from "@anthropic-ai/sdk";
import * as core from "@actions/core";
import type { ReviewContext, ReviewOptions } from "../types";
import { getPromptTemplate } from "../templates/base";

export class ClaudeService {
	private client: Anthropic;
	private options: ReviewOptions;

	constructor(apiKey: string, options: ReviewOptions) {
		this.client = new Anthropic({ apiKey });
		this.options = options;
	}

	async generateReview(context: ReviewContext): Promise<string> {
		try {
			core.info("Generating code review with Claude AI...");

			const promptTemplate = getPromptTemplate(this.options.projectType);
			const systemPrompt = promptTemplate.generatePrompt(context);

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

			return message.content[0].text;
		} catch (error) {
			if (error instanceof Error) {
				core.error(`Claude API 호출 중 오류 발생: ${error.message}`);
				return `Claude 코드 리뷰 생성 중 오류가 발생했습니다: ${error.message}`;
			}
			core.error("Claude API 호출 중 알 수 없는 오류가 발생했습니다");
			return "알 수 없는 오류로 코드 리뷰를 생성할 수 없습니다";
		}
	}
}
