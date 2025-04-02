import { ClaudeService } from "../../src/services/claude";
import type { ReviewOptions, ProjectType } from "../../src/types";

// Mock the core module to avoid actual logging in tests
jest.mock("@actions/core", () => ({
	info: jest.fn(),
	warning: jest.fn(),
	error: jest.fn(),
	debug: jest.fn(),
}));

// Mock Anthropic client
jest.mock("@anthropic-ai/sdk", () => {
	return {
		Anthropic: jest.fn().mockImplementation(() => ({
			messages: {
				create: jest.fn().mockResolvedValue({
					content: [{ text: '```json\n{"summary":"Test","comments":[]}\n```' }],
				}),
			},
		})),
	};
});

// Mock RepomixService
jest.mock("../../src/services/repomix", () => {
	return {
		RepomixService: jest.fn().mockImplementation(() => ({
			packRepository: jest.fn(),
		})),
	};
});

describe("ClaudeService", () => {
	// Create a testing class to expose protected methods
	class TestableClaudeService extends ClaudeService {
		parseJsonExposed(text: string) {
			return this.parseClaudeResponse(text);
		}

		extractJsonExposed(text: string) {
			return this.extractJsonFromResponse(text);
		}

		sanitizeJsonExposed(text: string) {
			return this.sanitizeJsonString(text);
		}
	}

	let service: TestableClaudeService;

	beforeEach(() => {
		const options: ReviewOptions = {
			model: "claude-3-opus-20240229",
			projectType: "auto",
			useRepomix: false,
			fileExtensions: [".ts", ".js"],
			excludePatterns: [],
			findRelatedFiles: false,
			maxFiles: 10,
		};
		service = new TestableClaudeService("fake-api-key", options);
	});

	describe("JSON Parsing", () => {
		test("extracts JSON from markdown code block", async () => {
			const response = '```json\n{"summary": "Test", "comments": []}\n```';
			const extracted = service.extractJsonExposed(response);
			expect(extracted).toBe('{"summary": "Test", "comments": []}');
		});

		test("extracts JSON from markdown code block without language", async () => {
			const response = '```\n{"summary": "Test", "comments": []}\n```';
			const extracted = service.extractJsonExposed(response);
			expect(extracted).toBe('{"summary": "Test", "comments": []}');
		});

		test("extracts JSON without code block", async () => {
			const response = '{"summary": "Test", "comments": []}';
			const extracted = service.extractJsonExposed(response);
			expect(extracted).toBe('{"summary": "Test", "comments": []}');
		});

		test("throws error when no JSON is found", async () => {
			const response = "This is not valid JSON";
			expect(() => service.extractJsonExposed(response)).toThrow();
		});

		test("sanitizes JSON with escaped quotes", async () => {
			const json = '{"text": "This has \\\\"quotes\\\\"."}';
			const sanitized = service.sanitizeJsonExposed(json);
			expect(sanitized).toBe('{"text": "This has \\"quotes\\"."}');
		});

		test("sanitizes JSON with backticks", async () => {
			const json = '{"code": "\\`\\`\\`typescript\\nconst x = 1;\\n\\`\\`\\`"}';
			const sanitized = service.sanitizeJsonExposed(json);

			// Instead of exact string matching, check key components
			expect(sanitized).toContain('{"code": "```typescript');
			expect(sanitized).toContain("const x = 1;");
			expect(sanitized).toContain('```"}');
		});

		test("parses valid JSON response with backticks", async () => {
			const response = `\`\`\`json
{
  "summary": "Good code",
  "comments": [
    {
      "path": "file.ts",
      "line": 5,
      "body": "Consider using a different approach:\\n\\n\\\`\\\`\\\`typescript\\nconst x = 1;\\n\\\`\\\`\\\`"
    }
  ]
}
\`\`\``;

			const result = await service.parseJsonExposed(response);
			expect(result.summary).toBe("Good code");
			expect(result.comments).toHaveLength(1);
			expect(result.comments[0].body).toContain("```typescript");
		});

		test("parses JSON with Korean characters", async () => {
			const response = `\`\`\`json
{
  "summary": "코드 리뷰 요약",
  "comments": [
    {
      "path": "file.ts",
      "line": 5,
      "body": "함수 이름이 명확하지 않습니다."
    }
  ]
}
\`\`\``;

			const result = await service.parseJsonExposed(response);
			expect(result.summary).toBe("코드 리뷰 요약");
			expect(result.comments[0].body).toBe("함수 이름이 명확하지 않습니다.");
		});

		test("filters unexpected fields", async () => {
			const response = `\`\`\`json
{
  "summary": "Test summary",
  "comments": [],
  "extraField": "should be removed",
  "overview": "Another extra field"
}
\`\`\``;

			const result = await service.parseJsonExposed(response);
			expect(result).toHaveProperty("summary");
			expect(result).toHaveProperty("comments");
			expect(result).not.toHaveProperty("extraField");
			expect(result).not.toHaveProperty("overview");
		});

		test("handles real-world Claude response with Korean text and code blocks", async () => {
			// This is a real response from Claude that would come from the API
			const response = `\`\`\`json
{
  "summary": "이번 변경은 프로젝트 생성 및 Adjust 통합을 위한 새로운 단계별 설정 기능을 도입했습니다. 코드는 전반적으로 잘 구조화되어 있으며, 프로젝트 생성 시 기본 Adjust 설정 단계를 자동으로 생성하는 기능을 추가했습니다.",
  "comments": [
    {
      "path": "flamingo-api/src/main/kotlin/ai/flmg/api/facade/ProjectFacade.kt",
      "line": 22,
      "body": "**개선 제안**: \`createProjectWithAdjustSteps\` 메서드에 트랜잭션 관리를 추가하는 것이 좋습니다.\\n\\n\`\`\`kotlin\\n@Transactional\\nfun createProjectWithAdjustSteps(dto: ProjectDto): ProjectDto {\\n    val project = projectService.create(dto)\\n    try {\\n        adjustStepService.insertDefaultSteps(projectId = project.id, name = dto.name)\\n        return project.toDto()\\n    } catch (e: Exception) {\\n        // 프로젝트 생성 롤백 로직 고려\\n        throw ProjectCreationException(\\"Adjust steps creation failed\\", e)\\n    }\\n}"
    },
    {
      "path": "flamingo-api/src/main/kotlin/ai/flmg/api/service/AdjustStepService.kt",
      "line": 16,
      "body": "**보안 및 성능 개선**: 기본 단계 생성 시 입력 데이터 검증 및 로깅 추가를 고려하세요.\\n\\n\`\`\`kotlin\\nfun insertDefaultSteps(projectId: UUID, name: String) {\\n    require(name.isNotBlank()) { \\"Project name cannot be empty\\" }\\n    logger.info(\\"Creating default Adjust steps for project: $projectId\\")\\n    // 기존 로직\\n}"
    },
    {
      "path": "flamingo-core/src/main/java/ai/flmg/core/data/model/AdjustStepStatus.java",
      "line": 40,
      "body": "**리팩토링 제안**: 상수로 최대 재시도 횟수를 정의하여 유연성과 가독성 개선\\n\\n\`\`\`java\\npublic static final int MAX_RETRY_ATTEMPTS = 3;\\n\\n@Column(name = \\"max_retry\\", nullable = false)\\nprivate int maxRetry = MAX_RETRY_ATTEMPTS;\\n\`\`\`"
    }
  ]
}
\`\`\``;

			const result = await service.parseJsonExposed(response);

			// Verify Korean summary is preserved
			expect(result.summary).toContain("이번 변경은 프로젝트 생성 및");

			// Verify we have the right number of comments
			expect(result.comments).toHaveLength(3);

			// Verify Korean content in the first comment
			expect(result.comments[0].body).toContain("개선 제안");
			expect(result.comments[0].body).toContain("메서드에 트랜잭션 관리를");

			// Verify code blocks are properly parsed
			expect(result.comments[0].body).toContain("```kotlin");
			expect(result.comments[0].body).toContain("@Transactional");

			// Verify file paths
			expect(result.comments[0].path).toBe(
				"flamingo-api/src/main/kotlin/ai/flmg/api/facade/ProjectFacade.kt",
			);
			expect(result.comments[1].path).toBe(
				"flamingo-api/src/main/kotlin/ai/flmg/api/service/AdjustStepService.kt",
			);
			expect(result.comments[2].path).toBe(
				"flamingo-core/src/main/java/ai/flmg/core/data/model/AdjustStepStatus.java",
			);
		});

		test("handles triple backticks in code blocks", async () => {
			// This test verifies the fix for the backticks rendering issue
			const response = `\`\`\`json
{
  "summary": "Good code",
  "comments": [
    {
      "path": "file.ts",
      "line": 5,
      "body": "Here's a code example:\\n\\n\\\`\\\`\\\`typescript\\nfunction example() {\\n  console.log('hello');\\n}\\n\\\`\\\`\\\`"
    }
  ]
}
\`\`\``;

			const result = await service.parseJsonExposed(response);

			// Verify the comment with a code block is parsed correctly
			expect(result.comments[0].body).toContain("Here's a code example:");

			// Verify the triple backticks are preserved properly
			expect(result.comments[0].body).toContain("```typescript");
			expect(result.comments[0].body).toContain("function example()");
		});
	});
});
