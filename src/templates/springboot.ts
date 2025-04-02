import type { PromptTemplate, ReviewContext } from "../types";
import { BasePromptTemplate } from "./base";

export class SpringBootPromptTemplate implements PromptTemplate {
	generatePrompt(context: ReviewContext): string {
		// Start with the base prompt
		const basePrompt = new BasePromptTemplate().generatePrompt(context);

		// Add Spring Boot-specific guidance
		return `${basePrompt}

Spring Boot 프로젝트 관련 추가 지침:

1. 아키텍처 및 계층 구조:
   - 클린 아키텍처: 도메인 중심 설계와 계층 간 명확한 경계가 있는지 검토하세요.
   - 계층 분리: Controller, Service, Repository 계층이 명확히 분리되었는지 확인하고, 불필요한 의존성을 식별하세요.
   - 비즈니스 로직 위치: 비즈니스 로직이 도메인 모델이나 서비스 계층에 적절히 배치되었는지 확인하세요.
   - DTO 활용: Entity와 DTO의 구분이 명확하고, Entity가 표현 계층까지 노출되지 않는지 확인하세요.
   - 모듈화: 기능별 모듈화가 잘 되어 있는지 확인하고, 패키지 구조를 평가하세요.

2. Spring 프레임워크 활용:
   - DI 최적화: 생성자 주입 방식을 사용하는지 확인하고, @Autowired 필드 주입을 지양하세요.
   - 트랜잭션 관리: @Transactional 어노테이션의 적절한 범위와 전파 설정을 확인하세요.
   - Bean 생명주기: Bean 생명주기 콜백 메서드의 올바른 사용을 확인하세요.
   - 프로파일 활용: 환경별 구성을 위한 @Profile 사용을 확인하세요.
   - 조건부 구성: @ConditionalOn* 어노테이션을 통한 유연한 자동 구성을 권장하세요.

3. 데이터 액세스 및 성능:
   - N+1 쿼리 방지: 연관 엔티티 로딩 시 fetch join, EntityGraph, BatchSize 활용을 권장하세요.
   - 쿼리 최적화: JPQL, Querydsl, 또는 네이티브 쿼리의 적절한 사용을 평가하세요.
   - 페이지네이션: 대용량 데이터 처리 시 페이지네이션 적용을 확인하세요.
   - 캐싱 전략: @Cacheable을 활용한 적절한 캐싱 구현을 확인하세요.
   - 비동기 처리: @Async 및 CompletableFuture를 활용한 비동기 처리 기회를 식별하세요.

4. 보안 및 예외 처리:
   - 인증/인가: Spring Security 구성의 적절성과 보안 모범 사례 준수를 확인하세요.
   - 입력 검증: @Valid, @Validated를 활용한 입력 유효성 검증을 확인하세요.
   - 예외 계층: 도메인별 커스텀 예외 계층 구조를 권장하세요.
   - 전역 예외 처리: @ControllerAdvice를 활용한 일관된 예외 처리를 확인하세요.
   - 보안 취약점: SQL 인젝션, XSS, CSRF 방지 조치를 확인하세요.

5. API 설계 및 문서화:
   - RESTful 원칙: HTTP 메서드, 상태 코드, 리소스 명명 규칙의 적절한 사용을 평가하세요.
   - API 버전 관리: API 버전 관리 전략이 적용되었는지 확인하세요.
   - Swagger/OpenAPI: API 문서화 도구의 활용을 확인하고 권장하세요.
   - HATEOAS: 필요한 경우 HATEOAS 원칙 적용을 권장하세요.
   - 응답 형식: 일관된 응답 형식과 적절한 HTTP 상태 코드 사용을 확인하세요.

6. 테스트 및 유지보수성:
   - 단위 테스트: 서비스 및 도메인 로직에 대한 단위 테스트 작성을 권장하세요.
   - 통합 테스트: @SpringBootTest를 활용한 통합 테스트 구현을 확인하세요.
   - 테스트 가능성: 코드가 테스트하기 쉽게 설계되었는지 평가하세요(의존성 주입, 모킹 용이성).
   - 로깅 전략: 적절한 로깅 레벨과 컨텍스트 정보 제공을 확인하세요.
   - 모니터링 지원: Actuator 엔드포인트 활용 및 메트릭 노출을 권장하세요.

이러한 지침을 바탕으로 Spring Boot 프로젝트의 코드 품질, 성능, 보안 및 유지보수성을 종합적으로 평가하고, 구체적인 개선 방안을 제시해주세요.
`;
	}
}
