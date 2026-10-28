param([Parameter(Mandatory=$true)][string]$Source,[ValidatePattern('^[A-Za-z_][A-Za-z0-9_]{0,62}$')][string]$Database,[string]$StorageDirectory='storage\private')
. "$PSScriptRoot\env.ps1"
if (Test-Path -LiteralPath 'work\processes.json') { throw 'Stop the application before restore.' }
$sourcePath = [IO.Path]::GetFullPath($Source)
if (!(Test-Path -LiteralPath (Join-Path $sourcePath 'database.dump'))) { throw 'Backup not found' }
$storagePath = [IO.Path]::GetFullPath($StorageDirectory)
if (!$storagePath.StartsWith($ProjectRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Restore storage must be inside the project directory.' }
if (Test-Path -LiteralPath $storagePath) { throw 'Restore only into a fresh project storage. Existing storage will not be overwritten.' }
$databaseName = if ($Database) { $Database } else { $env:POSTGRES_DB }
$tables = docker compose exec -T postgres psql -U $env:POSTGRES_USER -d $databaseName -Atqc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"
if ($LASTEXITCODE -or $tables.Trim() -ne '0') { throw 'Restore requires an existing empty database. No data was changed.' }
$manifest = Get-Content -LiteralPath (Join-Path $sourcePath 'backup.json') -Raw | ConvertFrom-Json
if ($manifest.version -ne 1 -or (Get-ProjectFileHash (Join-Path $sourcePath 'database.dump')) -ne $manifest.dumpSha256) { throw 'Invalid or corrupted database backup' }
$privateRoot = [IO.Path]::GetFullPath((Join-Path $sourcePath 'private'))
if (@(Get-ChildItem -LiteralPath $privateRoot -Recurse -File).Count -ne @($manifest.files).Count) { throw 'Private file manifest differs from backup contents' }
foreach ($file in $manifest.files) {
 $filePath = [IO.Path]::GetFullPath((Join-Path $privateRoot $file.key))
 if (!$filePath.StartsWith($privateRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or (Get-ProjectFileHash $filePath) -ne $file.sha256) { throw 'Invalid or corrupted private file backup' }
}
docker compose cp (Join-Path $sourcePath 'database.dump') postgres:/tmp/mvs-restore.dump
if ($LASTEXITCODE) { throw 'Database dump copy failed' }
docker compose exec -T postgres pg_restore -U $env:POSTGRES_USER -d $databaseName --exit-on-error /tmp/mvs-restore.dump
if ($LASTEXITCODE) { throw 'Restore failed; use an empty database' }
New-Item -ItemType Directory -Path (Split-Path -Parent $storagePath) -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $sourcePath 'private') -Destination $storagePath -Recurse
Write-Output 'Database and files restored. Reuse the original model registry revisions.'
