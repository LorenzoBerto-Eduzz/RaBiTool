param(
  [Parameter(Mandatory = $true)]
  [string]$Destination
)

$ErrorActionPreference = "Stop"
$source = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$destinationPath = [System.IO.Path]::GetFullPath($Destination)

if (Test-Path $destinationPath) {
  throw "Destination already exists: $destinationPath"
}

$excludeDirs = @(".git", "local_assets", "local_data", "private_data", "ChromeWorkHelperTemplate")
$excludeFiles = @("*.zip")

New-Item -ItemType Directory -Path $destinationPath | Out-Null

Get-ChildItem -Path $source -Force | ForEach-Object {
  if ($excludeDirs -contains $_.Name) { return }
  if (-not $_.PSIsContainer) {
    foreach ($pattern in $excludeFiles) {
      if ($_.Name -like $pattern) { return }
    }
  }
  Copy-Item -LiteralPath $_.FullName -Destination $destinationPath -Recurse -Force
}

Write-Host "Created new extension project from template: $destinationPath"
Write-Host "Next steps:"
Write-Host "1. Open the new folder with an AI."
Write-Host "2. Read AGENTS.md."
Write-Host "3. Rename the extension in project/manifest.json."
Write-Host "4. Load unpacked from project/."
Write-Host "5. Initialize Git and configure a remote when ready."
