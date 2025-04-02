import type { PromptTemplate, ReviewContext } from "../types";
import { BasePromptTemplate } from "./base";

export class SpringBootPromptTemplate implements PromptTemplate {
	generatePrompt(context: ReviewContext): string {
		// Start with the base prompt
		const basePrompt = new BasePromptTemplate().generatePrompt(context);

		// Add Spring Boot-specific guidance
		return `${basePrompt}

Spring Boot 프로젝트 관련 추가 지침:

1. 아키텍처 및 구조:
   - 계층 구조(Controller, Facade, Service, Repository)가 적절히 구분되었는지 확인하세요.
   - DTO, Entity, VO 객체의 적절한 사용을 평가하세요.
   - 관심사 분리가 잘 되어 있는지 확인하세요.

2. Spring 이디엄 및 패턴:
   - @Transactional 어노테이션의 적절한 사용을 확인하세요.
   - DI(의존성 주입)이 생성자 주입 방식으로 구현되었는지 권장하세요.
   - @Autowired 필드 주입보다 생성자 주입을 권장하세요.

3. 성능 고려사항:
   - N+1 쿼리 문제가 발생할 수 있는 코드를 확인하세요.
   - 불필요한 데이터베이스 호출이 있는지 확인하세요.
   - 캐싱 적용이 필요한 부분을 식별하세요.

4. 예외 처리:
   - 전역 예외 처리기의 사용을 확인하세요.
   - 비즈니스 로직에 맞는 커스텀 예외를 사용하는지 확인하세요.
   - try-catch 블록이 적절히 사용되었는지 확인하세요.

5. 보안:
   - SQL 인젝션 방지를 위해 JPA 또는 명명된 파라미터를 사용하는지 확인하세요.
   - 인증/인가 코드의 적절한 구현을 확인하세요.
   - 민감한 정보가 로그에 노출되지 않는지 확인하세요.

이러한 추가 지침을 고려하여 Spring Boot 프로젝트에 특화된 코드 리뷰를 제공해주세요.
`;
	}
}
