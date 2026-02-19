@echo off
echo Starting Next.js Development Server...
cd /d "%~dp0"
set NODE_ENV=development
set NODE_OPTIONS=--max-old-space-size=4096
node --max-old-space-size=4096 node_modules\next\dist\bin\next dev
