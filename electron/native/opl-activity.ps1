param([int]$Port = 1024, [int]$ParentPid)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -Path (Join-Path $PSScriptRoot 'OplActivity.cs')
while (Get-Process -Id $ParentPid -ErrorAction SilentlyContinue) {
    try {
        $files = @([OplActivity]::GetActiveImages($Port))
        [Console]::WriteLine((ConvertTo-Json -Compress -InputObject @{ files = $files }))
    } catch {
        [Console]::WriteLine((ConvertTo-Json -Compress -InputObject @{ files = @(); error = $_.Exception.Message }))
    }
    Start-Sleep -Milliseconds 1500
}
