param([string[]]$Models=@('vision','design','speech','embedding'))
. "$PSScriptRoot\env.ps1"
& '.runtime\ai\Scripts\python.exe' 'services\ai\download_models.py' @Models
if ($LASTEXITCODE) { throw 'Model download failed' }
