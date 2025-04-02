import type { PromptTemplate, ReviewContext } from "../types";
import { BasePromptTemplate } from "./base";

export class AndroidPromptTemplate implements PromptTemplate {
	generatePrompt(context: ReviewContext): string {
		// Start with the base prompt
		const basePrompt = new BasePromptTemplate().generatePrompt(context);

		// Add Android-specific guidance
		return `${basePrompt}

Android 프로젝트 관련 추가 지침:

1. 아키텍처 및 구조:
   - MVVM, MVP, MVC 등의 아키텍처 패턴이 일관되게 적용되었는지 확인하세요.
   - 비즈니스 로직이 UI 코드에서 분리되었는지 확인하세요.
   - Clean Architecture 원칙이 준수되고 있는지 평가하세요.

2. 생명주기 관리:
   - Activity/Fragment 생명주기 메서드의 적절한 사용을 확인하세요.
   - 메모리 누수 위험이 있는 코드를 식별하세요(예: 익명 내부 클래스, 비정상적 참조 유지).
   - ViewModel과 LiveData/Flow의 올바른 사용을 확인하세요.

3. UI/UX 고려사항:
   - UI 스레드 차단 코드를 식별하고 백그라운드 처리를 권장하세요.
   - RecyclerView/ListView의 효율적인 구현을 확인하세요.
   - 화면 방향 변경 및 다양한 화면 크기 대응을 확인하세요.

4. 성능 최적화:
   - 불필요한 객체 생성을 식별하세요.
   - ANR 가능성이 있는 코드를 식별하세요.
   - 배터리 소모를 줄이기 위한 최적화 방안을 제안하세요.

5. 현대적 안드로이드 개발:
   - Kotlin 언어 기능(확장 함수, 코루틴, flow 등)의 적절한 활용을 권장하세요.
   - Jetpack 컴포넌트의 활용을 장려하세요.
   - Compose UI 전환 가능성을 검토하세요.

6. 네트워크 및 데이터:
   - Retrofit과 같은 현대적 라이브러리 사용을 권장하세요.
   - Room 데이터베이스의 적절한 활용을 확인하세요.
   - 네트워크 에러 처리 및 오프라인 모드 지원을 확인하세요.

이러한 추가 지침을 고려하여 Android 프로젝트에 특화된 코드 리뷰를 제공해주세요.
`;
	}
}
