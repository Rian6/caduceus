$ErrorActionPreference = 'Stop'
Add-Type -Path (Join-Path $PSScriptRoot '../electron/native/OplActivity.cs')
$testFile = Join-Path ([IO.Path]::GetTempPath()) (([Guid]::NewGuid().ToString()) + '.iso')
$stream = [IO.File]::Open($testFile, [IO.FileMode]::CreateNew, [IO.FileAccess]::ReadWrite, [IO.FileShare]::ReadWrite)
try {
    if ([OplActivity]::GetOpenImages($PID) -notcontains $testFile) { throw 'Open ISO was not detected.' }
    $stream.Dispose()
    if ([OplActivity]::GetOpenImages($PID) -contains $testFile) { throw 'Closed ISO was still detected.' }
    [OplActivity]::GetActiveImages(1024) | Out-Null
    Write-Output 'PASS: native ISO open/close detection and TCP table inspection.'
} finally {
    $stream.Dispose()
    Remove-Item -LiteralPath $testFile
}
