# Local Development Guide

This guide explains how to run the Code Review Assistant locally for development and testing.

## Prerequisites

- Node.js (version 18+)
- npm or pnpm or yarn
- GitHub Personal Access Token with `repo` scope
- Claude API Key

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/AlohaFactory-Dev/loxops.git
   cd loxops
   ```

2. Install dependencies:
   ```bash
   pnpm install
   # or
   npm install
   ```

3. Create a `.env` file based on the template:
   ```bash
   cp .env.example .env
   ```

4. Open the `.env` file and fill in the required values:
   - `GITHUB_TOKEN`: Your GitHub Personal Access Token
   - `CLAUDE_API_KEY`: Your Claude API Key
   - `PULL_REQUEST_URL`: URL of the pull request you want to review

## Running Locally

To run the code review assistant locally:

```bash
pnpm start:local
# or
npm run start:local
```

This will:
1. Connect to GitHub using your token
2. Fetch the pull request details and changed files
3. Generate a code review using Claude
4. Post the review comments to the pull request

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| GITHUB_TOKEN | GitHub Personal Access Token | (Required) |
| CLAUDE_API_KEY | Claude API Key | (Required) |
| PULL_REQUEST_URL | URL of the PR to review | (Required) |
| PROJECT_TYPE | Project type (unity, springboot, android, nextjs, auto) | auto |
| FILE_EXTENSIONS | Comma-separated list of file extensions to analyze | .ts,.js,.tsx,.jsx,.cs,.java,.kt,.xml,.json,.yaml,.yml |
| EXCLUDE_PATTERNS | Comma-separated list of glob patterns to exclude | node_modules/**,dist/**,build/**,*.min.js,*.test.* |
| FIND_RELATED_FILES | Whether to find and analyze related files | true |
| MAX_FILES | Maximum number of files to analyze | 10 |
| MODEL | Claude model to use | claude-3-5-haiku-20241022 |
| USE_REPOMIX | Whether to use Repomix for comprehensive review | true |

## Troubleshooting

- **Error: GITHUB_TOKEN is required**: Make sure you've added your GitHub token to the `.env` file.
- **Error: CLAUDE_API_KEY is required**: Make sure you've added your Claude API key to the `.env` file.
- **Error: Invalid PULL_REQUEST_URL format**: Ensure the pull request URL is in the format `https://github.com/owner/repo/pull/number`.
- **Rate limiting issues**: GitHub and Claude APIs have rate limits. If you're making many requests, you might hit these limits.