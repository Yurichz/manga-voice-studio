param([switch]$PrepareCache)
. "$PSScriptRoot\env.ps1"
if (Test-Path -LiteralPath 'work\processes.json') { throw 'Stop the application before installation verification.' }
$sourceRoot=$ProjectRoot
$checkRoot=Join-Path $sourceRoot ('work\clean-install-'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $checkRoot | Out-Null
$files=rg --files --hidden -g '!.git/**' -g '!node_modules/**' -g '!**/node_modules/**' -g '!**/.next/**' -g '!**/__pycache__/**' -g '!**/.pytest_cache/**' -g '!.env' -g '!work/**' -g '!outputs/**' -g '!storage/**' -g '!models/**' -g '!.cache/**' -g '!.runtime/**' -g '!dist/**' -g '!test-results/**' -g '!playwright-report/**'
if ($LASTEXITCODE) { throw 'Source inventory failed' }
foreach ($file in $files) {
 $destination=Join-Path $checkRoot $file
 New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
 Copy-Item -LiteralPath (Join-Path $sourceRoot $file) -Destination $destination
}
Push-Location -LiteralPath $checkRoot
try {
 pnpm install --offline --frozen-lockfile --store-dir (Join-Path $sourceRoot '.cache\pnpm')
 if ($LASTEXITCODE) { throw 'Frozen offline Node installation failed' }
 pnpm db:generate
 if ($LASTEXITCODE) { throw 'Fresh Prisma generation failed' }
 pnpm typecheck
 if ($LASTEXITCODE) { throw 'Fresh typecheck failed' }
 pnpm build
 if ($LASTEXITCODE) { throw 'Fresh production build failed' }
 $networkArgs=@(); if (!$PrepareCache) { $networkArgs=@('--offline') }
 foreach ($runtime in @('ai','tts','vision','voxcpm')) {
  $directory=Join-Path $checkRoot ('.runtime\'+$runtime)
  uv venv $directory --python 3.12.13
  if ($LASTEXITCODE) { throw "Fresh Python environment failed: $runtime" }
  uv pip sync @networkArgs --python (Join-Path $directory 'Scripts\python.exe') (Join-Path $checkRoot "services\ai\requirements-$runtime.lock") --extra-index-url https://download.pytorch.org/whl/cu128 --index-strategy unsafe-best-match
  if ($LASTEXITCODE) { throw "Frozen offline Python installation failed: $runtime" }
 }
 & (Join-Path $checkRoot '.runtime\ai\Scripts\python.exe') -m pytest services\ai -q
 if ($LASTEXITCODE) { throw 'Fresh Python tests failed' }
 & (Join-Path $checkRoot '.runtime\tts\Scripts\python.exe') -c "import torch; assert torch.cuda.is_available(); import qwen_tts; print('Fresh TTS runtime sees CUDA')"
 if ($LASTEXITCODE) { throw 'Fresh CUDA/SDK import failed' }
 & (Join-Path $checkRoot '.runtime\voxcpm\Scripts\python.exe') -c "import torch; assert torch.cuda.is_available(); import voxcpm; print('Fresh VoxCPM runtime sees CUDA')"
 if ($LASTEXITCODE) { throw 'Fresh VoxCPM CUDA/SDK import failed' }
 $result=@{passed=$true;freshSourceDirectory=$checkRoot;frozenOfflineNodeInstall=$true;frozenOfflinePythonInstall=(!$PrepareCache);freshBuild=$true;freshTypecheck=$true;freshPytest=$true;freshCudaSdk=$true;scope='Fresh source/dependency environments on the current Windows host. Separate clean Windows installation not tested.'}
 New-Item -ItemType Directory -Path (Join-Path $sourceRoot 'outputs\clean-install') -Force | Out-Null
 $result | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $sourceRoot 'outputs\clean-install\verification.json') -Encoding UTF8
 Write-Output 'Fresh installation and production build passed using pinned local caches.'
} finally { Pop-Location }
