#!/bin/bash

# Figma Automator Development Startup Script
# This script ensures all environment variables and dependencies are loaded

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Load .env files explicitly
if [ -f ".env" ]; then
    echo "📁 Loading .env file..."
    # Export all vars except PORT to avoid React dev server conflict
    export $(cat .env | grep -v '^#' | grep -v '^PORT=' | xargs)
fi

if [ -f ".env.development" ]; then
    echo "📁 Loading .env.development file..."
    # Export all vars except PORT to avoid React dev server conflict
    export $(cat .env.development | grep -v '^#' | grep -v '^PORT=' | xargs)
fi

# Set NODE_ENV if not already set
export NODE_ENV="${NODE_ENV:-development}"

# Ensure yarn is available (for nvm users)
if [ -f "$HOME/.nvm/nvm.sh" ]; then
    echo "🔧 Loading nvm..."
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

# Check if node is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js or configure nvm."
    exit 1
fi

if ! command -v yarn &> /dev/null; then
    echo "❌ Yarn not found. Please install yarn globally: npm install -g yarn"
    exit 1
fi

# Display environment info
echo "✅ Node version: $(node --version)"
echo "✅ Yarn version: $(yarn --version)"
echo "✅ Environment: $NODE_ENV"
echo "✅ Working directory: $(pwd)"
echo ""
echo "🚀 Starting Figma Automator..."
echo ""

# Start the application
yarn start
