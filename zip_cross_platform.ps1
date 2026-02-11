$zipPath = "blog-to-video-converter-v4.0.0.zip"
$pluginSource = "wp-content/plugins/blog-to-video-converter"
$rootFolderName = "blog-to-video-converter"

if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$stream = [System.IO.File]::OpenWrite($zipPath)
$archive = New-Object System.IO.Compression.ZipArchive($stream, [System.IO.Compression.ZipArchiveMode]::Create)

$files = Get-ChildItem -Path $pluginSource -Recurse | Where-Object { -not $_.PSIsContainer }

foreach ($file in $files) {
    # Calculate the relative path from the plugin folder
    $relativePath = $file.FullName.Substring((Get-Item $pluginSource).FullName.Length + 1)
    
    # Enforce forward slashes for the ZIP entry name
    $entryName = "$rootFolderName/" + $relativePath.Replace('\', '/')
    
    Write-Host "Adding: $entryName"
    
    $entry = $archive.CreateEntry($entryName)
    $entryStream = $entry.Open()
    $fileStream = [System.IO.File]::OpenRead($file.FullName)
    $fileStream.CopyTo($entryStream)
    
    $fileStream.Dispose()
    $entryStream.Dispose()
}

$archive.Dispose()
$stream.Dispose()

Write-Host "Cross-platform ZIP created: $zipPath"
