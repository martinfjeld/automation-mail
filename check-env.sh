#!/bin/bash

# Environment Diagnostic Script for Figma Automator
# Run this to check if all required environment variables are set

echo "🔍 Figma Automator Environment Diagnostics"
echo "==========================================="
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Load .env files
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs 2>/dev/null)
fi

if [ -f ".env.development" ]; then
    export $(cat .env.development | grep -v '^#' | xargs 2>/dev/null)
fi

# Check Node and Yarn
echo "📦 Dependencies:"
if command -v node &> /dev/null; then
    echo "  ✅ Node.js: $(node --version)"
else
    echo "  ❌ Node.js: NOT FOUND"
fi

if command -v yarn &> /dev/null; then
    echo "  ✅ Yarn: $(yarn --version)"
else
    echo "  ❌ Yarn: NOT FOUND"
fi

echo ""
echo "🔑 Environment Variables:"

# Check required environment variables
check_env_var() {
    local var_name=$1
    local var_value="${!var_name}"
    
    if [ -z "$var_value" ]; then
        echo "  ❌ $var_name: NOT SET"
        return 1
    else
        # Show first 10 chars + ***
        local masked="${var_value:0:10}***"
        echo "  ✅ $var_name: $masked"
        return 0
    fi
}

check_env_var "OPENAI_API_KEY"
check_env_var "NOTION_TOKEN"
check_env_var "NOTION_DATABASE_ID"
check_env_var "SANITY_PROJECT_ID"
check_env_var "SANITY_DATASET"
check_env_var "SANITY_TOKEN"

echo ""
echo "🌍 System Info:"
echo "  NODE_ENV: ${NODE_ENV:-not set (will default to development)}"
echo "  SERVER_PORT: ${SERVER_PORT:-not set (will default to 3001)}"
echo "  PWD: $(pwd)"

echo ""
echo "📄 Config Files:"
[ -f ".env" ] && echo "  ✅ .env exists" || echo "  ❌ .env missing"
[ -f ".env.development" ] && echo "  ✅ .env.development exists" || echo "  ⚠️  .env.development missing (optional)"
[ -f ".env.production" ] && echo "  ✅ .env.production exists" || echo "  ⚠️  .env.production missing (optional)"
[ -f "package.json" ] && echo "  ✅ package.json exists" || echo "  ❌ package.json missing"
[ -d "node_modules" ] && echo "  ✅ node_modules exists" || echo "  ⚠️  node_modules missing (run: yarn install)"

echo ""
echo "==========================================="
echo "Diagnostic complete!"
