$PluginDir = "wp-content/plugins/blog-to-video-converter"
$ZipName = "blog-to-video-converter-v4.0.0.zip"
$CurrentDir = Get-Location

if (Test-Path $ZipName) {
    Remove-Item $ZipName -Force
}

# Go to the plugins directory so the ZIP starts from the plugin folder name
Set-Location "wp-content/plugins"

# Compress the folder
Compress-Archive -Path "blog-to-video-converter" -DestinationPath "$CurrentDir/$ZipName"

# Return to original directory
Set-Location $CurrentDir

Write-Host "ZIP fixed: $ZipName"
