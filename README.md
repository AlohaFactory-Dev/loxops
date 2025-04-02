# Code Review Assistant

![Code Review](https://img.shields.io/badge/AI-Code%20Review-purple)
![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue)
![GitHub Actions](https://img.shields.io/badge/CI-GitHub%20Actions-2088FF)

이 GitHub Action은 [Anthropic의 Claude API](https://www.anthropic.com/claude)를 활용하여 풀 리퀘스트에 대한 자동화된 코드 리뷰를 제공합니다. 다양한 프로젝트 유형(Unity, Spring Boot, Android, Next.js 등)에 특화된 리뷰를 제공하며, 코드베이스의 특성에 맞는 맞춤형 피드백을 생성합니다. [Repomix](https://github.com/yamadashy/repomix)를 활용하여 전체 저장소 컨텍스트에 대한 심층적인 이해를 기반으로 더욱 정확하고 포괄적인 코드 리뷰를 제공합니다.

## 주요 기능

- **프로젝트 유형 자동 감지**: 파일 패턴과 내용을 분석하여 프로젝트 유형을 자동으로 식별합니다.
- **특화된 코드 리뷰**: 각 프로젝트 유형에 맞는 특화된 리뷰 가이드라인을 적용합니다.
- **관련 파일 분석**: 변경된 파일과 연관된 다른 파일들을 찾아 포괄적인 리뷰를 제공합니다.
- **전체 저장소 컨텍스트**: Repomix를 사용하여 전체 저장소를 패키징하고 AI에게 제공하여 코드베이스에 대한 심층적인 이해를 바탕으로 더 나은 리뷰를 제공합니다.
- **구체적인 개선 제안**: 문제점을 식별하고 코드 예시와 함께 구체적인 개선 방안을 제시합니다.
- **다양한 설정 옵션**: 분석할 파일 확장자, 제외 패턴, 모델 선택 등 다양한 설정이 가능합니다.

## 사용 방법

### 1. 시크릿 설정

GitHub 저장소의 "Settings" > "Secrets and variables" > "Actions"에서 다음 시크릿을 추가합니다:

- `CLAUDE_API_KEY`: Anthropic API 키

### 2. 워크플로우 추가

`.github/workflows/code-review-assistant.yml` 파일을 생성하고 다음 내용을 추가합니다:

```yaml
name: Code Review Assistant

on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: read
  pull-requests: write

jobs:
  code-review:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run Code Review Assistant
        uses: AlohaFactory-Dev/code-review-assistant@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          claude-api-key: ${{ secrets.CLAUDE_API_KEY }}
          project-type: 'auto'
          use-repomix: 'true'
```

### 3. 옵션 설정

다음 옵션을 설정하여 코드 리뷰를 맞춤화할 수 있습니다:

- `project-type`: 프로젝트 유형 ('unity', 'springboot', 'android', 'nextjs', 'auto')
- `file-extensions`: 분석할 파일 확장자
- `exclude-patterns`: 제외할 파일 패턴
- `find-related-files`: 관련 파일 분석 여부
- `max-files`: 한 번에 분석할 최대 파일 수
- `model`: 사용할 Claude 모델
- `use-repomix`: Repomix를 사용하여 전체 저장소 컨텍스트를 AI에게 제공할지 여부 (기본값: true)

## 지원하는 프로젝트 유형

- **Unity**: Unity 게임 개발 프로젝트
- **Spring Boot**: Java 기반 백엔드 프로젝트
- **Android**: 안드로이드 앱 개발 프로젝트
- **Next.js**: React 기반 프론트엔드 프로젝트

## Repomix 통합

이 액션은 [Repomix](https://github.com/yamadashy/repomix)를 통합하여 다음과 같은 이점을 제공합니다:

- **전체 코드베이스 컨텍스트**: Claude에게 전체 저장소 구조와 코드를 제공하여 코드베이스에 대한 더 깊은 이해를 기반으로 리뷰를 생성합니다.
- **더 나은 코드 패턴 인식**: 저장소 전체의 패턴과 규칙을 파악하여 일관성 있는 리뷰 제안을 제공합니다.
- **관련 코드 참조**: 변경 사항과 관련된 다른 파일의 코드를 참조하여 더 정확한 피드백을 제공합니다.

Repomix 사용을 비활성화하려면 `use-repomix: 'false'`로 설정하세요.

## 비용 최적화 팁

Claude API 사용에는 비용이 발생하므로, 다음 최적화를 고려하세요:

1. 특정 브랜치나 파일 유형에 대해서만 코드 리뷰를 실행
2. `max-files` 값을 조절하여 분석할 파일 수 제한
3. `find-related-files` 옵션을 상황에 따라 비활성화
4. 필요에 따라 더 경제적인 모델 사용
5. 대규모 저장소의 경우 `use-repomix: 'false'`로 설정하여 컨텍스트 크기 감소

## 라이센스

MIT

## 기여하기

이슈 및 풀 리퀘스트를 환영합니다. 새로운 프로젝트 유형 지원이나 기능 개선에 기여해 주세요.