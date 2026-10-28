. "$PSScriptRoot\env.ps1"
Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,TotalVisibleMemorySize
$projectDrive = (Get-Item -LiteralPath $ProjectRoot).PSDrive
$projectDrive | Select-Object Name,Free
nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader
node --version
pnpm --version
foreach ($runtime in @('tts','vision','voxcpm')) { if (Test-Path -LiteralPath ".runtime\$runtime\Scripts\python.exe") { Write-Output "Runtime: $runtime"; & ".runtime\$runtime\Scripts\python.exe" -c "import torch; print(torch.__version__, 'CUDA:', torch.cuda.is_available(), 'BF16:', torch.cuda.is_bf16_supported())" } }
if (Get-Command docker -ErrorAction SilentlyContinue) { Write-Output "Docker executable: $((Get-Command docker).Source)"; docker --version; docker desktop status; docker context ls } else { Write-Output 'BLOCKED: Docker CLI unavailable in the project environment. Check the existing installation before system setup.' }
Test-ProjectServices | Out-Null
Get-Content -LiteralPath 'work\health.log'
