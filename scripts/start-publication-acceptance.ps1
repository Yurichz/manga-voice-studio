. "$PSScriptRoot\env.ps1"
foreach($port in @(3000,3001,8001)){if(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue){throw "Port $port is occupied; stop the editor before isolated acceptance."}}
$databaseName='mvs_publication_acceptance'
$existing=& docker compose exec -T postgres psql -U $env:POSTGRES_USER -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$databaseName'"
if(!$existing){& docker compose exec -T postgres createdb -U $env:POSTGRES_USER $databaseName;if($LASTEXITCODE){throw 'Cannot create isolated acceptance database'}}
$uri=[UriBuilder]$env:DATABASE_URL;$uri.Path=$databaseName;$env:DATABASE_URL=$uri.Uri.AbsoluteUri
$env:STORAGE_ROOT=Join-Path $ProjectRoot 'work\publication-acceptance\private'
$env:MVS_QUEUE_NAME='mvs-publication-acceptance'
New-Item -ItemType Directory -Path 'work\publication-acceptance' -Force | Out-Null
$envLines=@();foreach($name in @('DATABASE_URL','STORAGE_ROOT','MVS_QUEUE_NAME','REDIS_URL','BETTER_AUTH_URL','BETTER_AUTH_SECRET','AI_URL','AI_SECRET')){$envLines+="$name=$([Environment]::GetEnvironmentVariable($name,'Process'))"}
$envLines | Set-Content -LiteralPath 'work\publication-acceptance\.env'
pnpm db:migrate
if($LASTEXITCODE){throw 'Isolated migration failed'}
$records=@()
foreach($entry in @(@{Name='ai';Exe=(Join-Path $ProjectRoot '.runtime\ai\Scripts\python.exe');Args=@('-m','uvicorn','services.ai.supervisor:app','--host','127.0.0.1','--port','8001')},@{Name='api';Exe='node';Args=@('--conditions=mvs-source','--import','tsx','apps/api/src/main.ts')},@{Name='worker';Exe='node';Args=@('--conditions=mvs-source','--import','tsx','apps/worker/src/main.ts')},@{Name='web';Exe='node';Args=@('node_modules/next/dist/bin/next','start','apps/web','--hostname','127.0.0.1','--port','3000')})){$p=Start-Process -FilePath $entry.Exe -ArgumentList $entry.Args -WorkingDirectory $ProjectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput "work\publication-acceptance\$($entry.Name).log" -RedirectStandardError "work\publication-acceptance\$($entry.Name).err.log";$records+=@{Pid=$p.Id;Name=$entry.Name;Started=$p.StartTime.ToUniversalTime().ToString('o')}}
$records | ConvertTo-Json | Set-Content -LiteralPath 'work\publication-acceptance\processes.json'
Write-Output 'Isolated editor acceptance running; production data is unchanged.'
