# Code Review Assistant - Local Development

This repository contains a script to run the Code Review Assistant locally, allowing you to generate AI-powered code reviews for GitHub pull requests using Claude AI.

## What's Included

1. **local-run.ts**: The main script that enables local execution of the code review pipeline
2. **tsconfig.local.json**: Custom TypeScript configuration for local development
3. **setup-local.sh**: Automated setup script
4. **.env.example**: Template for environment variables
5. **LOCAL_DEV.md**: Detailed documentation for local development

## Quick Start

1. Clone this repository:
   ```bash
   git clone https://github.com/your-username/code-review-assistant.git
   cd code-review-assistant
   ```

2. Run the setup script:
   ```bash
   ./setup-local.sh
   ```

3. Edit the `.env` file with your:
   - GitHub personal access token (needs `repo` scope)
   - Claude API key
   - GitHub pull request URL

4. Run the local version:
   ```bash
   pnpm run start:local
   # or
   npm run start:local
   ```

## Requirements

- Node.js (v18+)
- GitHub Personal Access Token
- Claude API Key

## Features

- Generate AI code reviews for any GitHub pull request
- Automatically analyze code changes and identify issues
- Support for multiple project types (Unity, Springboot, Android, Next.js)
- Provide line-specific comments directly on the PR

## How It Works

1. Connects to GitHub API to fetch pull request details
2. Analyzes changed files and identifies related files
3. Generates a comprehensive code review using Claude AI
4. Posts the review as comments on the pull request

## Customization

See `LOCAL_DEV.md` for detailed configuration options and advanced usage scenarios.