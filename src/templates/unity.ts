import type { PromptTemplate, ReviewContext } from "../types";
import { BasePromptTemplate } from "./base";

export class UnityPromptTemplate implements PromptTemplate {
	generatePrompt(context: ReviewContext): string {
		// Start with the base prompt
		const basePrompt = new BasePromptTemplate().generatePrompt(context);

		// Add Unity-specific guidance
		return `${basePrompt}

Unity 프로젝트 관련 추가 지침:

1. 성능 고려사항:
   - Update() 메서드에서 무거운 연산이 있는지 확인하세요.
   - GetComponent() 호출이 반복문 내에 있는지 확인하고, 캐싱을 제안하세요.
   - 오브젝트 풀링이 적용 가능한 상황인지 평가하세요.
   - 불필요한 Instantiate/Destroy 호출을 찾아 최적화 방안을 제안하세요.

2. 코드 구조:
   - MonoBehaviour를 적절히 활용하고 있는지 확인하세요.
   - 싱글톤 패턴의 올바른 구현을 확인하고, 의존성 주입을 고려하세요.
   - 컴포넌트 간 통신 방식이 효율적인지 평가하세요.

3. 안전성:
   - null 참조 가능성을 확인하고, [SerializeField] 또는 RequireComponent 속성 사용을 권장하세요.
   - 코루틴 관리가 적절한지 확인하세요.
   - 이벤트 구독/해제가 짝을 이루는지 확인하세요.

4. Unity 특화 패턴:
   - ScriptableObject 활용 기회를 찾으세요.
   - Unity의 새로운 Input System을 사용할 것을 권장하세요.
   - GameObject.Find() 및 싱글톤 대신 의존성 주입 패턴을 권장하세요.

이러한 추가 지침을 고려하여 Unity 프로젝트에 특화된 코드 리뷰를 제공해주세요.
`;
	}
}
