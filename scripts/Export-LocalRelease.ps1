param(
  [string]$Name = "Chrome_Extension_AI_Template",
  [switch]$Zip
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$project = Join-Path $root "project"
$export = Join-Path $root $Name
$zipPath = Join-Path $root "$Name.zip"

if (-not (Test-Path -LiteralPath (Join-Path $project "manifest.json"))) {
  throw "project/manifest.json was not found. Run this script from the template repo."
}

if (Test-Path -LiteralPath $export) { Remove-Item -LiteralPath $export -Recurse -Force }
if ((-not $Zip) -and (Test-Path -LiteralPath $zipPath)) { Remove-Item -LiteralPath $zipPath -Force }

Copy-Item -LiteralPath $project -Destination $export -Recurse
$devData = Join-Path $export "local_test_data"
if (Test-Path -LiteralPath $devData) { Remove-Item -LiteralPath $devData -Recurse -Force }
Write-Host "Created $export"

if ($Zip) {
  Compress-Archive -LiteralPath $export -DestinationPath $zipPath -Force
  Write-Host "Created $zipPath"
}
