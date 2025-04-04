import type {
	ProjectType,
	PromptTemplate,
	ReviewContext,
	UserComment,
} from "../types";
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
		let prompt = this.getIntroduction();
		prompt += this.getReviewGuidelines();
		prompt += this.getReviewFormat();
		prompt += this.getFilesList(context);
		prompt += this.getFileContents(context);
		prompt += this.getUserComments(context);
		prompt += this.getRelatedFilesInfo(context);
		prompt += this.getClosingInstructions();

		return prompt;
	}

	protected getIntroduction(): string {
		return "# 코드 리뷰 임무\n\n당신은 10+ 경력의 시니어 개발자이며 깊이 있는 코드 리뷰 전문가입니다. 풍부한 경험을 바탕으로 아래 변경사항에 대해 철저하고 구체적인 코드 리뷰를 수행해주세요.\n\n## 리뷰 목표\n- 코드 품질 향상 및 버그 예방\n- 유지보수성과 확장성 개선\n- 일관된 코딩 스타일과 모범 사례 권장\n- 시스템 설계 및 아키텍처 강화\n- 개발자 성장을 돕는 교육적 피드백 제공";
	}

	protected getReviewGuidelines(): string {
		return "\n## 리뷰 지침\n\n### 코드 품질\n- **가독성:** 코드가 명확하고 직관적인지 평가. 복잡한 로직이나 과도한 중첩 구조 식별.\n- **유지보수성:** 코드의 모듈화, 재사용성, 응집도를 검토. 불필요한 중복 코드 식별.\n- **확장성:** 코드가 미래 요구사항 변화에 대응할 수 있는지 평가.\n\n### 기술적 측면\n- **성능:** 비효율적인 알고리즘, 불필요한 연산, 메모리/리소스 낭비 식별.\n- **보안:** 잠재적 보안 취약점, SQL 인젝션, XSS, 안전하지 않은 데이터 처리 등 식별.\n- **오류 처리:** 예외 처리, 오류 복구 메커니즘, 사용자 피드백 적절성 평가.\n- **병행성:** 스레드 안전성, 동시성 문제, 교착 상태 가능성 검토.\n\n### 코딩 표준\n- **명명 규칙:** 변수, 함수, 클래스 등의 이름이 명확하고 일관되게 사용되는지 확인.\n- **코드 스타일:** 일관된 들여쓰기, 공백, 괄호 사용 등 스타일 가이드라인 준수 확인.\n- **주석:** 필요한 곳에 적절한 주석이 있는지, 과도하거나 불필요한 주석은 없는지 확인.\n\n### 아키텍처 및 설계\n- **설계 패턴:** 적절한 디자인 패턴 사용, 불필요한 복잡성 회피 여부 검토.\n- **의존성:** 컴포넌트 간 의존성과 결합도 평가, 의존성 주입 활용 검토.\n- **책임 분리:** 단일 책임 원칙 준수 여부, 응집도 높은 컴포넌트 구성 확인.\n\n### 테스트 적합성\n- **테스트 용이성:** 코드가 단위 테스트에 적합하게 작성되었는지 평가.\n- **테스트 범위:** 경계 조건, 예외 경로, 핵심 비즈니스 로직에 대한 테스트 필요성 식별.";
	}

	protected getReviewFormat(): string {
		return "\n## 리뷰 형식\n\n### 1. 요약\n[변경사항에 대한 간결한 3-5줄 요약. 전반적인 품질 평가, 주요 장점과 개선점을 포함하세요.]\n\n### 2. 긍정적 측면\n1. [주목할 만한 좋은 구현/개선점]\n   - [구체적인 설명과 코드 예시]\n2. [다른 긍정적 측면]\n   - [세부 설명]\n3. [추가 긍정적 측면]\n   - [세부 설명]\n\n### 3. 주요 개선 필요 사항\n1. [이슈 제목: 심각도(높음/중간/낮음)]\n   - **문제:** [명확한 문제 설명]\n   - **영향:** [이슈가 코드베이스 또는 애플리케이션에 미치는 잠재적 영향]\n   - **해결책:** [구체적인 개선 방안]\n   ```\n   // 개선된 코드 예시\n   ```\n   - **참고 자료:** [관련 문서/모범 사례 링크(해당되는 경우)]\n\n2. [이슈 제목: 심각도]\n   - **문제:** [설명]\n   - **영향:** [설명]\n   - **해결책:** [설명]\n   ```\n   // 코드 예시\n   ```\n\n### 4. 리팩토링 제안\n[더 큰 규모의 리팩토링이나 아키텍처 변경에 대한 제안. 현재 구현의 한계를 설명하고 더 나은 접근 방식을 제안하세요.]\n\n### 5. 관련 파일 영향 분석\n[변경사항이 다른 파일이나 시스템 컴포넌트에 미치는 잠재적 영향 분석]\n\n### 6. 요약 및 우선순위\n[가장 중요한 개선 사항 요약 및 우선순위화. 향후 개선을 위한 로드맵 제안]";
	}

	protected getFilesList(context: ReviewContext): string {
		const { files } = context;
		let prompt = "\n## 변경된 파일 목록\n";

		for (const file of files) {
			prompt += `- ${file.filename} (${file.status})\n`;
		}

		return prompt;
	}

	protected getFileContents(context: ReviewContext): string {
		const { files } = context;
		let prompt = "\n## 변경 내용 상세\n";

		for (const file of files) {
			prompt += `### ${file.filename}\n`;

			if (file.status === "removed") {
				prompt += `상태: 삭제됨\n\n`;
			} else {
				if (file.patch) {
					prompt += `#### 변경된 부분:\n\`\`\`diff\n${file.patch}\n\`\`\`\n\n`;
				}

				if (file.fullContent) {
					prompt += `#### 전체 내용:\n\`\`\`\n${file.fullContent}\n\`\`\`\n\n`;
				}
			}
		}

		return prompt;
	}

	protected getUserComments(context: ReviewContext): string {
		const { userComments } = context;

		if (!userComments || userComments.length === 0) {
			return "";
		}

		let prompt = "\n## 개발자/리뷰어 피드백\n";

		// Group comments by file or general PR comments
		const generalComments: UserComment[] = [];
		const fileComments: Record<string, UserComment[]> = {};

		// Organize comments into appropriate groups
		this.organizeUserComments(userComments, generalComments, fileComments);

		// Add general PR comments
		prompt += this.formatGeneralComments(generalComments);

		// Add file-specific comments
		prompt += this.formatFileComments(fileComments);

		return prompt;
	}

	private organizeUserComments(
		userComments: UserComment[],
		generalComments: UserComment[],
		fileComments: Record<string, UserComment[]>,
	): void {
		for (const comment of userComments) {
			if (comment.path) {
				if (!fileComments[comment.path]) {
					fileComments[comment.path] = [];
				}
				fileComments[comment.path].push(comment);
			} else {
				generalComments.push(comment);
			}
		}
	}

	private formatGeneralComments(generalComments: UserComment[]): string {
		if (generalComments.length === 0) {
			return "";
		}

		let result = "### 일반 코멘트\n";
		for (const comment of generalComments) {
			result += `**${comment.user}** (${comment.createdAt}):\n> ${comment.body.replace(/\n/g, "\n> ")}\n\n`;
		}

		return result;
	}

	private formatFileComments(
		fileComments: Record<string, UserComment[]>,
	): string {
		if (Object.keys(fileComments).length === 0) {
			return "";
		}

		let result = "### 파일별 코멘트\n";
		for (const [path, comments] of Object.entries(fileComments)) {
			result += `#### ${path}\n`;
			for (const comment of comments) {
				if (comment.line) {
					result += `**${comment.user}** (라인 ${comment.line}, ${comment.createdAt}):\n> ${comment.body.replace(/\n/g, "\n> ")}\n\n`;
				} else {
					result += `**${comment.user}** (${comment.createdAt}):\n> ${comment.body.replace(/\n/g, "\n> ")}\n\n`;
				}
			}
		}

		return result;
	}

	protected getRelatedFilesInfo(context: ReviewContext): string {
		const { relatedFiles } = context;

		if (Object.keys(relatedFiles).length === 0) {
			return "";
		}

		let prompt = "\n## 관련 파일 영향 분석\n";

		for (const [changedFile, related] of Object.entries(relatedFiles)) {
			prompt += `### ${changedFile}의 변경으로 영향 받을 수 있는 파일\n`;

			for (const relatedFile of related) {
				prompt += `- ${relatedFile}\n`;
			}
			prompt += "\n";
		}

		return prompt;
	}

	protected getClosingInstructions(): string {
		return (
			"\n## 응답 형식 지침\n\n" +
			"### 언어 및 인코딩\n" +
			"- 한글 및 비라틴 문자 사용 시 유니코드 이스케이프(\\u)를 사용하지 마세요.\n" +
			"- UTF-8 인코딩된 문자를 그대로 사용하세요.\n" +
			"- 특수 문자나 제어 문자만 이스케이프 처리하세요.\n\n" +
			"### 코드 예시\n" +
			"- 코드 예시는 항상 적절한 언어 구문 강조와 함께 코드 블록으로 제공하세요.\n" +
			"- 수정 전/후 코드를 함께 보여주면 더 효과적입니다.\n\n" +
			"### 중요 원칙\n" +
			"- 코드 리뷰는 단순히 문제를 지적하는 것이 아니라 교육적 피드백을 제공하는 것을 목표로 합니다.\n" +
			"- 긍정적인 측면도 강조하여 균형 잡힌 리뷰를 제공하세요.\n" +
			"- 가장 중요한 이슈에 우선순위를 두고, 사소한 문제는 간략히 언급하세요.\n" +
			"- 구체적인 개선 방안과 학습 자료를 함께 제공하세요."
		);
	}
}
