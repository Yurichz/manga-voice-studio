param([switch]$AcceptDockerLicense)
. "$PSScriptRoot\env.ps1"
if (Get-Command docker -ErrorAction SilentlyContinue) { docker --version; Write-Output 'Existing Docker client found; no installation performed. Start Docker Desktop and wait for its Linux engine.'; exit }
$candidates = @('C:\Program Files\Docker\Docker\Docker Desktop.exe', (Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\Docker Desktop.exe'), (Join-Path $ProjectRoot '.runtime\docker-desktop\Docker Desktop.exe'))
foreach ($candidate in $candidates) { if (Test-Path -LiteralPath $candidate) { Write-Output "Existing Docker found: $candidate. Start it; no installation performed."; exit } }
$installed=Get-ItemProperty 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*','HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object DisplayName -eq 'Docker Desktop'
if ($installed) { Write-Output 'Docker is registered as installed. Start or repair that installation; no new installation performed.'; exit }
$admin = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (!$admin) { throw 'Run this script in an administrator PowerShell. WSL2 activation requires elevation.' }
if (!$AcceptDockerLicense) { throw 'Read https://www.docker.com/legal/docker-subscription-service-agreement/ and pass -AcceptDockerLicense only if you accept it.' }
$installer = Join-Path $ProjectRoot '.runtime\installers\Docker Desktop Installer.exe'
New-Item -ItemType Directory -Force -Path (Split-Path $installer) | Out-Null
if (!(Test-Path -LiteralPath $installer)) { Invoke-WebRequest -Uri 'https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe' -OutFile $installer }
$signature = Get-AuthenticodeSignature -LiteralPath $installer
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Docker') { throw 'Docker installer signature is invalid' }
$features = @('Microsoft-Windows-Subsystem-Linux','VirtualMachinePlatform')
$restart = $false
foreach ($feature in $features) { $result = Enable-WindowsOptionalFeature -Online -FeatureName $feature -All -NoRestart; $restart = $restart -or $result.RestartNeeded }
if ($restart) { Write-Output 'Restart Windows, then rerun this same script. No automatic restart performed.'; exit }
wsl --update --web-download
if ($LASTEXITCODE) { throw 'WSL update failed' }
$dataRoot = Join-Path $ProjectRoot '.runtime\docker-data'
$installRoot = Join-Path $ProjectRoot '.runtime\docker-desktop'
$process = Start-Process -FilePath $installer -ArgumentList @('install','--quiet','--accept-license','--backend=wsl-2',"--installation-dir=`"$installRoot`"","--wsl-default-data-root=`"$dataRoot`"") -WindowStyle Hidden -Wait -PassThru
if ($process.ExitCode -ne 0) { throw "Docker installer exited $($process.ExitCode)" }
Write-Output "Docker prepared. Open $installRoot\Docker Desktop.exe and wait for the engine."
