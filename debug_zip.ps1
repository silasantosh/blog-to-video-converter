Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipPath = "blog-to-video-converter-v4.0.0.zip"
if (Test-Path $zipPath) {
    $zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
    $zip.Entries | ForEach-Object { Write-Host $_.FullName }
    $zip.Dispose()
}
else {
    Write-Host "Zip not found."
}
