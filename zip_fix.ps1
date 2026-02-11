$sourceDir = "c:\Users\haric\.gemini\antigravity\playground\emerald-cosmos\dist-plugin\blog-to-video-converter"
$zipFile = "c:\Users\haric\.gemini\antigravity\playground\emerald-cosmos\blog-to-video-converter-final.zip"

Add-Type -AssemblyName System.IO.Compression.FileSystem
$compressionLevel = [System.IO.Compression.CompressionLevel]::Optimal

if (Test-Path $zipFile) { Remove-Item $zipFile }

$zip = [System.IO.Compression.ZipFile]::Open($zipFile, [System.IO.Compression.ZipArchiveMode]::Create)

$files = Get-ChildItem $sourceDir -Recurse | Where-Object { ! $_.PSIsContainer }

foreach ($file in $files) {
    $relativePath = $file.FullName.Substring($sourceDir.Length + 1)
    # Force forward slashes for Linux compatibility
    $entryName = "blog-to-video-converter/" + $relativePath.Replace('\', '/')
    
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $entryName, $compressionLevel)
}

$zip.Dispose()
Write-Host "Zip created at $zipFile"
