<#
  package-project.ps1 - creates BugBoard-MERN.zip from this project folder (Windows PowerShell 5.1+).
  Run from the PROJECT ROOT:   powershell -ExecutionPolicy Bypass -File .\package-project.ps1
  Excludes node_modules, build output, real .env files and logs, so no secrets or bulky folders get zipped.
#>
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$name = Split-Path -Leaf $root
$zip  = Join-Path (Split-Path -Parent $root) 'BugBoard-MERN.zip'
if (Test-Path $zip) { Remove-Item $zip -Force }

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$skipDirs = @('node_modules', 'dist', 'build', 'coverage', '.git', '.vscode')
$archive = [System.IO.Compression.ZipFile]::Open($zip, 'Create')
$count = 0
try {
  Get-ChildItem -Path $root -Recurse -File -Force | ForEach-Object {
    $rel = $_.FullName.Substring($root.Length).TrimStart('\','/')
    $parts = $rel -split '[\\/]'
    if ($parts | Where-Object { $skipDirs -contains $_ }) { return }
    if ($_.Name -eq '.env' -or ($_.Name -like '.env.*' -and $_.Name -ne '.env.example')) { return }
    if ($_.Extension -eq '.log') { return }
    $entry = ($name + '/' + ($rel -replace '\\','/'))
    [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $entry, 'Optimal')
    $count++
  }
} finally { $archive.Dispose() }
Write-Host "Created $zip with $count files."
