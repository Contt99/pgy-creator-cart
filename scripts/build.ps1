$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$distRoot = Join-Path $projectRoot 'dist'
$version = (Get-Content -LiteralPath (Join-Path $projectRoot 'manifest.json') -Raw | ConvertFrom-Json).version
$packageName = "pgy-creator-cart-extension-v$version"
$packageRoot = Join-Path $distRoot $packageName
$zipPath = Join-Path $distRoot ($packageName + '.zip')

New-Item -ItemType Directory -Force -Path $packageRoot | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot 'manifest.json') -Destination $packageRoot -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'README.md') -Destination $packageRoot -Force

$sourceRoot = Join-Path $projectRoot 'src'
Get-ChildItem -LiteralPath $sourceRoot -Recurse -File | ForEach-Object {
  $relativePath = $_.FullName.Substring($projectRoot.Length).TrimStart('\')
  $destination = Join-Path $packageRoot $relativePath
  $destinationDirectory = Split-Path -Parent $destination
  New-Item -ItemType Directory -Force -Path $destinationDirectory | Out-Null
  Copy-Item -LiteralPath $_.FullName -Destination $destination -Force
}

Compress-Archive -Path (Join-Path $packageRoot '*') -DestinationPath $zipPath -Force
Write-Output $packageRoot
Write-Output $zipPath
