import type { ProjectType, PromptTemplate, ReviewContext } from "../types";
import { UnityPromptTemplate } from "./unity";
import { SpringBootPromptTemplate } from "./springboot";
import { AndroidPromptTemplate } from "./android";
import { NextJsPromptTemplate } from "./nextjs";

export function getPromptTemplate(type: ProjectType): PromptTemplate {
	switch (type) {
		case "unity":
			return new UnityPromptTemplate();
		case "springboot":
			return new SpringBootPromptTemplate();
		case "android":
			return new AndroidPromptTemplate();
		case "nextjs":
			return new NextJsPromptTemplate();
		default:
			return new BasePromptTemplate();
	}
}

export class BasePromptTemplate implements PromptTemplate {
	generatePrompt(context: ReviewContext): string {
		const { files, relatedFiles } = context;

		let prompt = `
경험 많은 시니어 개발자로서, 다음 변경사항들에 대해 전체적이고 간결한 코드 리뷰를 수행해주세요.

리뷰 지침:
1. 모든 변경사항을 종합적으로 검토하고, 가장 중요한 문제점이나 개선사항에만 집중하세요.
2. 파일별로 개별 리뷰를 하지 말고, 전체 변경사항에 대한 통합된 리뷰를 제공하세요.
3. 각 주요 이슈에 대해 간단한 설명과 구체적인 개선 제안을 제시하세요.
4. 개선 제안에는 실제 코드 예시를 포함하세요. 단, 코드 예시는 제공한 코드와 연관된 코드여야 합니다.
5. 사소한 스타일 문제나 개인적 선호도는 무시하세요.
6. 심각한 버그, 성능 문제, 또는 보안 취약점이 있는 경우에만 언급하세요.
7. 전체 리뷰는 간결하게 유지하세요.
8. 변경된 부분만 집중하여 리뷰하고, 이미 개선된 코드를 다시 지적하지 마세요.
9. 기존에 이미 개선된 사항(예: 중복 코드 제거를 위한 함수 생성)을 인식하고 이를 긍정적으로 언급하세요.
10. 변경된 파일과 관련된 다른 파일들에 미칠 수 있는 영향을 분석하세요.

리뷰 형식:
- 개선된 사항: [이미 개선된 부분에 대한 긍정적 언급]
- 주요 이슈 (있는 경우에만):
  1. [문제 설명]
     - 제안: [개선 방안 설명]
     \`\`\`
     // 수정된 코드 예시
     \`\`\`
  2. ...
- 관련 파일에 대한 영향 분석:
  [변경된 파일과 관련된 다른 파일들에 미칠 수 있는 잠재적 영향 설명]
- 전반적인 의견: [1-2문장으로 요약]

변경된 파일들:
`;

		// Add changed files to the prompt
		for (const file of files) {
			prompt += `- ${file.filename} (${file.status})\n`;
		}

		// Add file contents to the prompt
		prompt += "\n변경 내용:\n";
		for (const file of files) {
			if (file.status === "removed") {
				prompt += `파일: ${file.filename}\n상태: 삭제됨\n\n`;
			} else {
				prompt += `파일: ${file.filename}\n`;

				if (file.fullContent) {
					prompt += `전체 내용:\n${file.fullContent}\n\n`;
				}

				if (file.patch) {
					prompt += `변경된 부분:\n${file.patch}\n\n`;
				}
			}
		}

		// Add related files information
		if (Object.keys(relatedFiles).length > 0) {
			prompt += "\n관련된 파일들:\n";

			for (const [changedFile, related] of Object.entries(relatedFiles)) {
				prompt += `- ${changedFile}에 영향을 받을 수 있는 파일들:\n`;

				for (const relatedFile of related) {
					prompt += `  - ${relatedFile}\n`;
				}
			}
		}

		prompt += `
중요: 응답할 때 한글 또는 다른 비라틴 문자를 사용하는 경우, 문자 인코딩 문제를 방지하기 위해 다음 지침을 따르세요:
1. JSON 응답에서 한글을 사용할 때 추가 이스케이프를 하지 마세요 (\\u로 시작하는 유니코드 이스케이프).
2. 완전히 유효한 UTF-8 인코딩된 문자를 그대로 사용하세요.
3. 특수 문자나 제어 문자만 이스케이프 처리하고, 한글과 같은 비라틴 문자는 그대로 두세요.
`;

		return prompt;
	}
}
