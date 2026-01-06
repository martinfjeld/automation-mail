# Desktop App Integration Guide for Salesmode

## Issue Summary

When launching the Figma Automator from the Salesmode desktop app, the server fails to start properly because environment variables from `.env` files are not being loaded. This happens because:

1. The iTerm2 terminal launches without loading `.zshrc`
2. The app runs in a fresh shell session without the full user environment
3. Critical API keys (OpenAI, Notion, Sanity) are not available to the Node.js process

## Solution

A dedicated startup script (`start-dev.sh`) has been created that explicitly loads all environment variables before starting the application.

## Required Changes to Salesmode App

### Current Command (Not Working):
```bash
cd ~/Downloads/INDIECLIMB DOCS/Figma Project/figma-automator && yarn start
```

### New Command (Working):
```bash
cd ~/Downloads/INDIECLIMB\ DOCS/Figma\ Project/figma-automator && ./start-dev.sh
```

**Important:** Note the escaped spaces (`\ `) in the path.

## What the Startup Script Does

The `start-dev.sh` script automatically:

- ✅ Loads `.env` and `.env.development` files into the environment
- ✅ Sets up Node.js path (handles nvm installations)
- ✅ Validates Node.js and Yarn are installed
- ✅ Sets `NODE_ENV=development` 
- ✅ Displays version info and environment status
- ✅ Starts both server (port 3001) and client (port 3000)

## Testing the Fix

### Test 1: Manual Test
Open iTerm2 and run:
```bash
cd ~/Downloads/INDIECLIMB\ DOCS/Figma\ Project/figma-automator && ./start-dev.sh
```

Expected output:
```
📁 Loading .env file...
📁 Loading .env.development file...
🔧 Loading nvm...
✅ Node version: v20.19.5
✅ Yarn version: 1.22.19
✅ Environment: development
✅ Working directory: /Users/martinfjeld/Downloads/INDIECLIMB DOCS/Figma Project/figma-automator

🚀 Starting Figma Automator...

[server] 🚀 Server running on http://localhost:3001
[client] webpack compiled successfully
```

### Test 2: Environment Check
Run the diagnostic script to verify all environment variables are loaded:
```bash
cd ~/Downloads/INDIECLIMB\ DOCS/Figma\ Project/figma-automator && ./check-env.sh
```

All critical variables should show ✅:
- OPENAI_API_KEY
- NOTION_TOKEN
- NOTION_DATABASE_ID
- SANITY_PROJECT_ID
- SANITY_DATASET
- SANITY_TOKEN

### Test 3: Desktop App Test
After updating the Salesmode app with the new command:
1. Click the Salesmode app icon
2. Verify iTerm2 opens and shows the startup messages
3. Wait 5 seconds for the server to initialize
4. Verify Chrome opens with the correct tabs
5. Visit http://localhost:3000 and test functionality

## Troubleshooting

### If the script doesn't execute:
```bash
chmod +x ~/Downloads/INDIECLIMB\ DOCS/Figma\ Project/figma-automator/start-dev.sh
```

### If you still see "command not found" errors:
The path to Node.js/Yarn may need to be explicitly set. Edit `start-dev.sh` and add these lines after the nvm section:

```bash
# Fallback: Add common Node.js paths
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
```

### If environment variables are still missing:
Verify the `.env` file exists and contains all required keys:
```bash
ls -la ~/Downloads/INDIECLIMB\ DOCS/Figma\ Project/figma-automator/.env*
```

## Alternative Solutions (If Script Modification Isn't Possible)

If you cannot use the startup script, you can modify the Salesmode app to run:

```bash
cd ~/Downloads/INDIECLIMB\ DOCS/Figma\ Project/figma-automator && source ~/.zshrc && NODE_ENV=development yarn start
```

This loads your full shell environment before starting, but is less reliable than the dedicated startup script.

## Files Modified/Created

1. **start-dev.sh** - Main startup script (use this in the desktop app)
2. **check-env.sh** - Diagnostic script for troubleshooting
3. **server/index.ts** - Enhanced to load multiple .env files correctly

## Support

If issues persist after implementing these changes:
1. Run `./check-env.sh` and share the output
2. Check iTerm2 for any error messages
3. Verify the `.env` file contains all required API keys
