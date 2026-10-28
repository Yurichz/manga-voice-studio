$ErrorActionPreference='Stop'
$editorRoot=Split-Path -Parent $PSScriptRoot
$recordPath=Join-Path $editorRoot 'work\publication-acceptance\processes.json'
if(!(Test-Path -LiteralPath $recordPath)){return}
foreach($record in (Get-Content -LiteralPath $recordPath -Raw | ConvertFrom-Json)){
 $process=Get-Process -Id $record.Pid -ErrorAction SilentlyContinue
 if($process -and $process.StartTime.ToUniversalTime().Ticks -eq ([DateTimeOffset]$record.Started).UtcDateTime.Ticks){
  & taskkill.exe /PID $record.Pid /T /F | Out-Null
 }
}
Remove-Item -LiteralPath $recordPath
Write-Output 'Owned isolated editor and AI processes stopped.'
