$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
function Test-RecordedProcess($Process, $Record) {
 # PowerShell 7 can deserialize ISO timestamps as DateTime; compare UTC ticks.
 return $Process -and $Process.StartTime.ToUniversalTime().Ticks -eq ([DateTimeOffset]$Record.Started).UtcDateTime.Ticks
}
function Test-ProjectServices([switch]$Demo) {
 $probeArgs=@('scripts/health.mjs');if ($Demo) { $probeArgs+='--demo' };$probeArgs+='--verbose'
 $probe=Start-Process -FilePath 'node' -ArgumentList $probeArgs -WorkingDirectory $ProjectRoot -WindowStyle Hidden -PassThru -Wait -RedirectStandardOutput (Join-Path $ProjectRoot 'work\health.log') -RedirectStandardError (Join-Path $ProjectRoot 'work\health.err.log')
 if ($null -eq $probe.ExitCode) { throw 'Health probe exit code unavailable.' };return ($probe.ExitCode -eq 0)
}
Set-Location -LiteralPath $ProjectRoot
function Get-ProjectFileHash([string]$Path) { $stream=[IO.File]::OpenRead($Path); $algorithm=[Security.Cryptography.SHA256]::Create(); try { return ([BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace('-','') } finally { $stream.Dispose(); $algorithm.Dispose() } }
$env:UV_CACHE_DIR = Join-Path $ProjectRoot '.cache\uv'
$env:UV_PYTHON_INSTALL_DIR = Join-Path $ProjectRoot '.runtime\python'
$env:UV_PYTHON_BIN_DIR = Join-Path $ProjectRoot '.runtime\bin'
$env:HF_HOME = Join-Path $ProjectRoot '.cache\huggingface'
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $ProjectRoot '.cache\playwright'
$env:NEXT_TELEMETRY_DISABLED = '1'
$env:CHECKPOINT_DISABLE = '1'
$env:PRISMA_HIDE_UPDATE_MESSAGE = '1'
$env:CI = 'true'
$env:PYTHONUTF8 = '1'
$projectPaths = @((Join-Path $ProjectRoot '.runtime\bin'), (Join-Path $ProjectRoot '.runtime\docker-desktop\resources\bin'), (Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin'), 'C:\Program Files\Docker\Docker\resources\bin')
$env:PATH = (($projectPaths | Where-Object { Test-Path -LiteralPath $_ }) -join ';') + ';' + $env:PATH
$env:TEMP = Join-Path $ProjectRoot 'work\temp'
$env:TMP = $env:TEMP
New-Item -ItemType Directory -Force -Path $env:TEMP | Out-Null
if (Test-Path -LiteralPath '.env') {
 foreach ($line in Get-Content -LiteralPath '.env') { if ($line -match '^([A-Z_]+)=(.*)$') { [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process') } }
}
