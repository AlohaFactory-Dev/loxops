import type { PromptTemplate, ReviewContext } from "../types";
import { BasePromptTemplate } from "./base";

export class AndroidPromptTemplate implements PromptTemplate {
	generatePrompt(context: ReviewContext): string {
		// Start with the base prompt
		const basePrompt = new BasePromptTemplate().generatePrompt(context);

		// Add Android-specific guidance
		return `${basePrompt}

Android 프로젝트 관련 추가 지침:

1. 아키텍처 및 설계 패턴:
   - 클린 아키텍처: 계층 간 명확한 책임 분리와 의존성 규칙 준수를 평가하세요(데이터, 도메인, 표현 계층).
   - MVVM/MVI 구현: ViewModel과 View의 적절한 분리, 단방향 데이터 흐름 패턴을 확인하세요.
   - 의존성 주입: Hilt/Dagger의 효과적인 활용과 테스트 용이성을 위한 구성을 평가하세요.
   - 모듈화: 재사용 가능하고 독립적인 기능 모듈의 구현을 확인하세요.
   - SOLID 원칙: 특히 단일 책임 원칙과 의존성 역전 원칙의 준수를 검토하세요.

2. Kotlin 언어 활용:
   - 코틀린 특성: 확장 함수, 고차 함수, Scope 함수(let, apply, with, run)의 효과적인 활용을 확인하세요.
   - 널 안전성: 'null'에 안전한 코드 작성과 '!!' 연산자 사용 최소화를 권장하세요.
   - 코루틴: 비동기 작업에 코루틴과 Flow의 적절한 활용을 확인하세요.
   - 함수형 프로그래밍: 불변성, 순수 함수, 부작용 최소화 원칙 준수를 평가하세요.
   - 최신 문법: 코틀린 1.5+ 버전의 새로운 기능(예: 인라인 클래스, 시퀀스 빌더)의 활용을 권장하세요.

3. Jetpack 컴포넌트 활용:
   - Compose UI: 컴포저블 함수의 재사용성, 상태 관리, 이펙트 처리 방식을 평가하세요.
   - ViewModel: 생명주기 인식 데이터 관리와 UI 상태 노출 방식을 확인하세요.
   - Navigation: 딥 링크, 인수 전달, 트랜지션 처리의 적절한 구현을 확인하세요.
   - Room: 데이터베이스 스키마 설계, 관계 매핑, 쿼리 최적화를 검토하세요.
   - DataStore: SharedPreferences 대신 DataStore 사용과 적절한 유형(Preferences/Proto) 선택을 권장하세요.

4. 생명주기 및 메모리 관리:
   - 메모리 누수: Activity/Fragment 참조를 유지하는 비정상적 패턴을 식별하세요.
   - 수명 주기 인식: 수명 주기 이벤트에 대한 적절한 반응과 리소스 해제를 확인하세요.
   - 프로세스 복원: 구성 변경 및 프로세스 재생성 시 상태 보존 메커니즘을 평가하세요.
   - 백그라운드 작업: WorkManager, Foreground Service의 적절한 사용과 배터리 효율성을 검토하세요.
   - 저전력 모드: 도즈 모드와 앱 대기 최적화 대응 방식을 확인하세요.

5. UI/UX 및 성능:
   - 반응형 UI: 사용자 입력에 즉시 반응하는 UI 구현과 ANR 방지 전략을 평가하세요.
   - 애니메이션: 매끄러운 애니메이션과 전환을 위한 프레임 드롭 방지 방법을 검토하세요.
   - 레이아웃 성능: 중첩된 레이아웃 최소화, ConstraintLayout 활용, 렌더링 최적화를 권장하세요.
   - 리스트 성능: RecyclerView와 ListAdapter의 효율적인 구현과 DiffUtil 활용을 확인하세요.
   - 지연 로딩: 큰 이미지와 리소스의 지연 로딩 전략을 평가하세요.

6. 보안 및 데이터 처리:
   - 민감 데이터: EncryptedSharedPreferences, Biometric API, Keystore의 적절한 활용을 확인하세요.
   - 네트워크 보안: HTTPS 사용, 인증서 고정, 네트워크 보안 구성의 적절한 설정을 평가하세요.
   - 입력 검증: 사용자 입력 및 API 응답의 적절한 유효성 검사를 확인하세요.
   - 권한 처리: 최소 권한 원칙과 런타임 권한 요청의 적절한 구현을 평가하세요.
   - 데이터 노출: 로그, 클립보드, IPC를 통한 민감 정보 노출 가능성을 검토하세요.

7. 테스트 및 유지보수성:
   - 단위 테스트: ViewModel, UseCase, Repository의 테스트 용이성과 테스트 범위를 평가하세요.
   - UI 테스트: Espresso, Compose UI 테스트의 구현을 확인하세요.
   - 모의 객체: 테스트를 위한 모의 객체와 의존성 주입 구조의 적합성을 검토하세요.
   - 코드 품질: 정적 분석 도구(ktlint, detekt) 활용과 코딩 규약 준수를 권장하세요.
   - 문서화: 복잡한 로직과 공용 API에 대한 KDoc 문서화를 확인하세요.

8. 앱 크기 및 최적화:
   - R8/ProGuard: 적절한 코드 최소화와 난독화 룰 설정을 확인하세요.
   - 앱 번들: 동적 기능 모듈과 앱 번들 구현을 통한 앱 크기 최적화를 권장하세요.
   - 리소스 최적화: 이미지 압축, 벡터 드로어블 활용, 리소스 한정자의 적절한 사용을 평가하세요.
   - 온디맨드 기능: 동적 전달 또는 플레이 기능 API를 활용한 필요 시 설치 기능 구현을 검토하세요.
   - 다양한 기기 지원: 다양한 화면 크기, 폴더블, 태블릿 지원을 위한 UI 조정을 확인하세요.

이러한 지침을 바탕으로 모던 Android 개발 모범 사례를 반영한 깊이 있는 코드 리뷰를 제공해주세요. 각 항목에 대해 구체적인 코드 예시를 포함한 실행 가능한 개선 방안을 제시하세요.
`;
	}
}
