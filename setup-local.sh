#!/bin/bash

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Setting up Code Review Assistant for local development...${NC}"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm is not installed. Please install Node.js and npm first.${NC}"
    exit 1
fi

# Check if pnpm is installed
if command -v pnpm &> /dev/null; then
    PACKAGE_MANAGER="pnpm"
else
    PACKAGE_MANAGER="npm"
    echo -e "${YELLOW}pnpm not found, using npm instead.${NC}"
fi

# Install dependencies
echo -e "${BLUE}Installing dependencies...${NC}"
$PACKAGE_MANAGER install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${BLUE}Creating .env file from template...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}Please edit the .env file and fill in your GitHub token and Claude API key.${NC}"
else
    echo -e "${GREEN}.env file already exists.${NC}"
fi

echo -e "${GREEN}Setup complete!${NC}"
echo -e "${YELLOW}1. Edit the .env file and add your GitHub token and Claude API key.${NC}"
echo -e "${YELLOW}2. Set the PULL_REQUEST_URL to the PR you want to review.${NC}"
echo -e "${YELLOW}3. Run '${PACKAGE_MANAGER} run start:local' to start the code review process.${NC}"