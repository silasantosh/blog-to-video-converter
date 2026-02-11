$sourceDir = "c:\Users\haric\.gemini\antigravity\playground\emerald-cosmos\wp-content\plugins\blog-to-video-converter"
$zipFile = "c:\Users\haric\.gemini\antigravity\playground\emerald-cosmos\blog-to-video-converter-final.zip"

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

if (Test-Path $zipFile) { Remove-Item $zipFile -Force }

$zip = [System.IO.Compression.ZipFile]::Open($zipFile, [System.IO.Compression.ZipArchiveMode]::Create)

# 1. ADD THE MAIN PLUGIN FILE FIRST (Critical for some scanners)
$mainFile = Get-Item "$sourceDir/blog-to-video-converter.php"
Write-Host "Prioritizing main file: $($mainFile.Name)"
[System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $mainFile.FullName, "blog-to-video-converter/blog-to-video-converter.php")

# 2. Add all other files, excluding .git and the already added main file
$files = Get-ChildItem $sourceDir -Recurse | Where-Object { 
    -not $_.PSIsContainer -and 
    $_.Name -ne "blog-to-video-converter.php" -and
    $_.FullName -notlike "*\.git\*"
}

foreach ($file in $files) {
    $relativePath = $file.FullName.Substring($sourceDir.Length + 1)
    $entryName = "blog-to-video-converter/" + $relativePath.Replace('\', '/')
    Write-Host "Adding: $entryName"
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $entryName)
}

$zip.Dispose()
Write-Host "Success: $zipFile created with prioritized header file."
