import type { ProjectType, PromptTemplate, ReviewContext } from "../types";
import { UnityPromptTemplate } from "./unity";
import { SpringBootPromptTemplate } from "./springboot";
import { AndroidPromptTemplate } from "./android";
import { NextJsPromptTemplate } from "./nextjs";
import { FastApiPromptTemplate } from "./fastapi";

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
		case "fastapi":
			return new FastApiPromptTemplate();
		default:
			return new BasePromptTemplate();
	}
}

export class BasePromptTemplate implements PromptTemplate {
	generatePrompt(context: ReviewContext): string {
		const { files, relatedFiles } = context;

		let prompt = `
당신은 10+ 경력의 시니어 개발자이며 깊이 있는 코드 리뷰 전문가입니다. 다음 변경사항에 대해 철저하고 구체적인 코드 리뷰를 수행해주세요.

리뷰 지침:
1. 코드 품질 분석: 가독성, 유지보수성, 확장성 측면에서 코드를 분석하세요.
2. 핵심 이슈 우선순위화: 가장 중요한 문제점에 집중하고, 심각성 순으로 정렬하세요.
3. 구체적인 개선 제안: 모든 이슈에 대해 실행 가능한 해결책과 구체적인 코드 예시를 제공하세요.
4. 아키텍처 및 설계 검토: 설계 패턴의 적절한 사용과 코드 구조를 평가하세요.
5. 성능 분석: 잠재적인 성능 병목 현상을 식별하고 최적화 방안을 제안하세요.
6. 보안 취약점 검토: 보안 위험을 식별하고 완화 방법을 제안하세요.
7. 테스트 적합성: 코드의 테스트 용이성을 평가하고 필요한 테스트 케이스를 제안하세요.
8. 기술 부채 식별: 향후 문제를 일으킬 수 있는 코드 영역을 식별하세요.
9. 장점 인식: 잘 작성된 코드와 이미 개선된 부분을 적극적으로 인정하세요.
10. 파급 효과 분석: 변경 사항이 관련 파일과 전체 시스템에 미치는 영향을 평가하세요.

리뷰 형식:
- 요약: [변경사항에 대한 간결한 3-5줄 요약, 전반적인 품질과 주요 관심사 포함]
- 긍정적 측면:
  1. [특히 뛰어난 코드 또는 개선된 부분 설명]
  2. ...
- 주요 이슈:
  1. [이슈 제목: 심각도(높음/중간/낮음)]
     - 문제: [구체적인 문제 설명]
     - 영향: [이 이슈가 미치는 잠재적 영향]
     - 해결책: [구체적인 개선 방안]
     \`\`\`
     // 개선된 코드 예시
     \`\`\`
  2. ...
- 관련 파일 영향 분석:
  [변경사항이 관련 파일과 전체 시스템에 미치는 영향]
- 추가 권장사항:
  [일반적인 코드 품질 개선을 위한 제안과 리소스 제공]

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

코드 리뷰의 목표는 단순히 문제를 지적하는 것이 아니라, 개발자가 더 나은 코드를 작성하도록 구체적인 지침과 교육적 피드백을 제공하는 것임을 기억하세요.
`;

		return prompt;
	}
}
