import type { PromptTemplate, ReviewContext } from "../types";
import { BasePromptTemplate } from "./base";

export class UnityPromptTemplate implements PromptTemplate {
	generatePrompt(context: ReviewContext): string {
		// Start with the base prompt
		const basePrompt = new BasePromptTemplate().generatePrompt(context);

		// Add Unity-specific guidance
		return `${basePrompt}

Unity 프로젝트 관련 추가 지침:

1. 성능 최적화:
   - 프레임 레이트 영향: Update()와 FixedUpdate() 메서드 내 무거운 연산을 찾아 최적화 방안을 제시하세요.
   - 메모리 관리: 불필요한 GameObject 생성/파괴 패턴을 찾고 오브젝트 풀링 구현을 권장하세요.
   - 컴포넌트 캐싱: GetComponent() 호출이 반복문이나 Update() 내부에 있는지 확인하고 캐싱 패턴을 제안하세요.
   - 물리 연산: Physics 관련 호출의 최적화와 레이어 마스크 활용을 권장하세요.
   - 배치 처리: 가능한 경우 DrawMeshInstanced와 같은 배치 렌더링 기법을 제안하세요.

2. 아키텍처 및 설계 패턴:
   - 컴포넌트 기반 설계: 단일 책임 원칙을 준수하는 작고 집중된 컴포넌트 구성을 권장하세요.
   - 의존성 주입: MonoBehaviour 싱글톤 대신 ScriptableObject 기반 서비스 로케이터나 DI 패턴을 권장하세요.
   - 이벤트 시스템: UnityEvent 또는 C# 이벤트를 활용한 컴포넌트 간 느슨한 결합을 제안하세요.
   - 상태 관리: 상태 패턴이나 상태 머신 구현을 통한 복잡한 게임 로직 관리를 권장하세요.
   - 모듈성: ScriptableObject를 활용한 모듈식 데이터 설계를 평가하세요.

3. 코드 품질 및 안전성:
   - null 참조 방지: [SerializeField], RequireComponent 속성 사용 또는 null 체크를 권장하세요.
   - 네이밍 컨벤션: Unity 스타일 가이드에 맞는 일관된 네이밍 패턴을 권장하세요.
   - 코루틴 관리: 코루틴의 적절한 시작/중지와 참조 관리를 검증하세요.
   - 이벤트 처리: 이벤트 구독/해제 쌍이 적절히 구현되었는지 확인하세요.
   - 예외 처리: try-catch 블록의 적절한 사용과 견고한 에러 처리를 권장하세요.

4. 현대적 Unity 개발 관행:
   - 새로운 Input System: 레거시 Input 대신 새로운 Input System 사용을 권장하세요.
   - 비동기 패턴: async/await 패턴과 UniTask 사용을 통한 코루틴 대체 방안을 제안하세요.
   - DOTS 적용 가능성: 대규모 성능 요구 사항이 있는 경우 Entity Component System(ECS) 도입을 검토하세요.
   - Universal Render Pipeline: 프로젝트에 적합한 경우 URP 도입을 고려하세요.
   - 애셋 관리: Addressables 시스템을 활용한 효율적인 애셋 로딩을 제안하세요.

5. 에디터 및 개발자 경험:
   - 커스텀 에디터: 반복 작업을 줄이는 커스텀 에디터 툴 개발을 권장하세요.
   - 디버깅 도구: 게임 내 디버깅 도구와 개발자 콘솔 구현을 제안하세요.
   - 시각적 피드백: Gizmos와 Debug.DrawLine을 활용한 시각적 디버깅 구현을 권장하세요.
   - 에디터 속성: [Header], [Tooltip] 등의 Inspector 속성을 통한 가독성 향상을 제안하세요.

프로젝트의 규모와 목적에 맞게 이러한 지침을 적용하여, Unity 게임 개발 모범 사례를 반영한 구체적이고 실행 가능한 코드 리뷰를 제공해주세요.
`;
	}
}
