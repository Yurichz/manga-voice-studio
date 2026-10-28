. "$PSScriptRoot\env.ps1"
if (!(Test-Path -LiteralPath '.env')) {
 function New-Secret([int]$length) { $bytes = New-Object byte[] $length; $rng = [Security.Cryptography.RandomNumberGenerator]::Create(); try { $rng.GetBytes($bytes); return ([BitConverter]::ToString($bytes)).Replace('-', '') } finally { $rng.Dispose() } }
 $secret = New-Secret 32
 $aiSecret = New-Secret 32
 $dbPassword = New-Secret 24
 $template = Get-Content -LiteralPath '.env.example' -Raw
 $template = $template.Replace('GENERATE_LOCALLY', $secret).Replace('AI_SECRET='+$secret, 'AI_SECRET='+$aiSecret).Replace('CHANGE_ME', $dbPassword)
 Set-Content -LiteralPath '.env' -Value $template -Encoding utf8
}
pnpm install --frozen-lockfile --store-dir .cache/pnpm
if ($LASTEXITCODE) { throw 'pnpm installation failed' }
pnpm db:generate
if ($LASTEXITCODE) { throw 'Prisma generation failed. Stop the application before setup on Windows.' }
pnpm build:server
if ($LASTEXITCODE) { throw 'Server workspace build failed' }
uv python install 3.12.13
foreach ($runtime in @('ai','tts','vision','voxcpm')) { if (!(Test-Path -LiteralPath ".runtime\$runtime\Scripts\python.exe")) { uv venv ".runtime\$runtime" --python 3.12.13 } }
foreach ($runtime in @('ai','tts','vision','voxcpm')) { uv pip sync --python ".runtime\$runtime\Scripts\python.exe" "services\ai\requirements-$runtime.lock" --extra-index-url https://download.pytorch.org/whl/cu128 --index-strategy unsafe-best-match; if ($LASTEXITCODE) { throw "Failed runtime $runtime" } }
Write-Output 'Project dependencies installed. Start Docker, run scripts/start.ps1, then pnpm bootstrap.'
