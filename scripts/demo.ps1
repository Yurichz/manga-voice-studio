. "$PSScriptRoot\env.ps1"
$env:DEMO_MODE='true'
if (!$env:DEMO_ROOT) { $env:DEMO_ROOT=Join-Path $ProjectRoot 'storage\demo-english' }
$env:STORAGE_ROOT=$env:DEMO_ROOT
$env:DATABASE_URL='postgresql://disabled:disabled@127.0.0.1:1/disabled'
$env:REDIS_URL='redis://127.0.0.1:1'
$env:AI_SECRET=''
$env:BETTER_AUTH_SECRET=''
if (!(Test-Path -LiteralPath (Join-Path $env:DEMO_ROOT 'demo.json'))) { throw 'First run .runtime/ai/Scripts/python.exe scripts/prepare_english_demo.py.' }
Write-Output 'Run the web frontend in a second terminal: pnpm dev:web. Demo API uses port 3001.'
pnpm build:server
if ($LASTEXITCODE) { throw 'Server workspace build failed' }
node --conditions=mvs-source --import tsx apps/api/src/demo-main.ts
