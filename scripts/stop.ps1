. "$PSScriptRoot\env.ps1"
if (Test-Path -LiteralPath 'work\processes.json') {
 $processes=Get-CimInstance Win32_Process
 function Stop-OwnedTree([int]$processId) { foreach($child in $processes | Where-Object ParentProcessId -eq $processId) { Stop-OwnedTree $child.ProcessId }; Stop-Process -Id $processId -ErrorAction SilentlyContinue }
 foreach ($record in (Get-Content -LiteralPath 'work\processes.json' -Raw | ConvertFrom-Json)) { $p=Get-Process -Id $record.Pid -ErrorAction SilentlyContinue; if (Test-RecordedProcess $p $record) { Stop-OwnedTree $p.Id } }
 Remove-Item -LiteralPath 'work\processes.json'
}
Write-Output 'Owned application processes stopped. Persistent Docker volumes remain available.'
