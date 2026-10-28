param([Parameter(Mandatory=$true)][string]$Destination,[ValidatePattern('^[A-Za-z_][A-Za-z0-9_]{0,62}$')][string]$Database)
. "$PSScriptRoot\env.ps1"
if (Test-Path -LiteralPath 'work\processes.json') { throw 'Stop the application before backup to keep database and files consistent.' }
$destinationPath = [IO.Path]::GetFullPath($Destination)
if (Test-Path -LiteralPath $destinationPath) { throw 'Choose a new empty backup destination.' }
New-Item -ItemType Directory -Path $destinationPath | Out-Null
$databaseName = if ($Database) { $Database } else { $env:POSTGRES_DB }
docker compose exec -T postgres pg_dump -U $env:POSTGRES_USER -d $databaseName -Fc -f /tmp/mvs-backup.dump
if ($LASTEXITCODE) { throw 'Database backup failed' }
docker compose cp postgres:/tmp/mvs-backup.dump (Join-Path $destinationPath 'database.dump')
if ($LASTEXITCODE) { throw 'Database dump copy failed' }
if (Test-Path -LiteralPath 'storage\private') { Copy-Item -LiteralPath 'storage\private' -Destination (Join-Path $destinationPath 'private') -Recurse } else { New-Item -ItemType Directory -Path (Join-Path $destinationPath 'private') | Out-Null }
Copy-Item -LiteralPath 'services\ai\models.json' -Destination (Join-Path $destinationPath 'model-registry.json')
$privateRoot = [IO.Path]::GetFullPath((Join-Path $destinationPath 'private'))
$files = @(Get-ChildItem -LiteralPath $privateRoot -Recurse -File | ForEach-Object { @{key=$_.FullName.Substring($privateRoot.Length+1);sha256=(Get-ProjectFileHash $_.FullName);bytes=$_.Length} })
@{version=1;createdAt=[DateTime]::UtcNow.ToString('o');database=$databaseName;dumpSha256=(Get-ProjectFileHash (Join-Path $destinationPath 'database.dump'));files=$files} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $destinationPath 'backup.json') -Encoding UTF8
Write-Output 'Backup contains private user files. Keep it protected. Models and secrets are not included.'
