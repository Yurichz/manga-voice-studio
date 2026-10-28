. "$PSScriptRoot\env.ps1"
if (Test-Path -LiteralPath 'work\processes.json') { foreach ($record in (Get-Content -LiteralPath 'work\processes.json' -Raw | ConvertFrom-Json)) { $running=Get-Process -Id $record.Pid -ErrorAction SilentlyContinue; if (Test-RecordedProcess $running $record) { throw 'Application already running. Stop it with scripts/stop.ps1 first.' } } }
foreach ($port in @(3000,3001,8001)) { if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { throw "Port $port is occupied. Stop the existing application before launch." } }
$docker = Get-Command docker -ErrorAction SilentlyContinue
if (!$docker) { foreach ($candidate in @((Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin\docker.exe'), (Join-Path $ProjectRoot '.runtime\docker-desktop\resources\bin\docker.exe'))) { if (Test-Path -LiteralPath $candidate) { $docker = $candidate; break } }; if (!$docker) { throw 'Docker unavailable: complete scripts/system-setup.ps1 first.' } }
pnpm build:server
if ($LASTEXITCODE) { throw 'Server workspace build failed' }
& $docker compose up -d --wait
if ($LASTEXITCODE) { throw 'Docker dependencies failed' }
pnpm db:migrate
if ($LASTEXITCODE) { throw 'Database migration failed' }
$records = @()
try { foreach ($entry in @(@{Name='ai';Exe=(Join-Path $ProjectRoot '.runtime\ai\Scripts\python.exe');Args=@('-m','uvicorn','services.ai.supervisor:app','--host','127.0.0.1','--port','8001')},@{Name='api';Exe='node';Args=@('--conditions=mvs-source','--import','tsx','apps/api/src/main.ts')},@{Name='worker';Exe='node';Args=@('--conditions=mvs-source','--import','tsx','apps/worker/src/main.ts')},@{Name='web';Exe='node';Args=@('node_modules/next/dist/bin/next','dev','apps/web','--hostname','127.0.0.1','--port','3000')})) {
 $out = Join-Path $ProjectRoot "work\$($entry.Name).log"; $err = Join-Path $ProjectRoot "work\$($entry.Name).err.log"
 $p = Start-Process -FilePath $entry.Exe -ArgumentList $entry.Args -WorkingDirectory $ProjectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
 $records += @{Pid=$p.Id;Started=$p.StartTime.ToUniversalTime().ToString('o');Name=$entry.Name}
 $records | ConvertTo-Json | Set-Content -LiteralPath 'work\processes.json'
} } catch { & "$PSScriptRoot\stop.ps1"; throw }
$ready = $false
$deadline = [DateTime]::UtcNow.AddSeconds(60)
while ([DateTime]::UtcNow -lt $deadline) {
 try {
  if (!(Test-ProjectServices)) { throw 'Application services are not ready yet.' }
  foreach ($record in $records) { $running=Get-Process -Id $record.Pid -ErrorAction SilentlyContinue; if (!(Test-RecordedProcess $running $record)) { throw "Application process exited: $($record.Name)" } }
  $ready = $true; break
 } catch { Start-Sleep -Milliseconds 500 }
}
if (!$ready) { Get-Content -LiteralPath 'work\health.log'; & "$PSScriptRoot\stop.ps1"; throw 'Application startup failed. Check work/*.err.log; owned processes have been stopped.' }
Write-Output 'Manga Voice Studio: http://localhost:3000. First-time owner: pnpm bootstrap.'
