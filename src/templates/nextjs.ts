import type { PromptTemplate, ReviewContext } from "../types";
import { BasePromptTemplate } from "./base";

export class NextJsPromptTemplate implements PromptTemplate {
	generatePrompt(context: ReviewContext): string {
		// Start with the base prompt
		const basePrompt = new BasePromptTemplate().generatePrompt(context);

		// Add Next.js-specific guidance
		return `${basePrompt}

Next.js 프로젝트 관련 추가 지침:

1. 렌더링 최적화:
   - 서버 컴포넌트와 클라이언트 컴포넌트의 적절한 사용을 확인하세요.
   - 불필요한 클라이언트 사이드 렌더링을 식별하고 서버 컴포넌트로의 전환을 권장하세요.
   - 정적 생성(SSG)과 서버 사이드 렌더링(SSR)의 적절한 활용을 확인하세요.

2. 라우팅 및 데이터 페칭:
   - App Router와 Pages Router의 일관된 사용을 확인하세요.
   - Next.js의 데이터 페칭 메서드(getServerSideProps, getStaticProps, fetch 등)의 적절한 사용을 평가하세요.
   - 불필요한 리렌더링을 유발하는 코드를 식별하세요.

3. 상태 관리:
   - 전역 상태 관리의 필요성과 그 구현을 평가하세요(Context API, Redux, Zustand 등).
   - 컴포넌트 간 상태 공유가 효율적으로 이루어지는지 확인하세요.
   - 서버 상태와 클라이언트 상태의 적절한 분리를 확인하세요.

4. 성능 고려사항:
   - 불필요한 번들 크기 증가 요소를 식별하세요.
   - 이미지 최적화(next/image)의 사용을 확인하세요.
   - 컴포넌트 메모이제이션(React.memo, useMemo, useCallback)의 적절한
   - 사용을 확인하세요.

5. 타입스크립트 활용:
   - 엄격한 타입 검사를 위한 설정을 권장하세요.
   - any 타입의 사용을 지양하고 구체적인 타입 정의를 권장하세요.
   - 재사용 가능한 타입 정의와 인터페이스의 활용을 확인하세요.

6. 접근성 및 SEO:
   - 시맨틱 HTML 요소의 적절한 사용을 확인하세요.
   - alt 속성, ARIA 속성 등 접근성 관련 속성의 사용을 확인하세요.
   - SEO 최적화를 위한 메타 태그의 사용을 확인하세요.

이러한 추가 지침을 고려하여 Next.js 프로젝트에 특화된 코드 리뷰를 제공해주세요.
`;
	}
}
