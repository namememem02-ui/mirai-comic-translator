# PowerShell Script: Build reproducible CPU LaMa component package
$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ArtifactsDir = Join-Path $ProjectRoot "artifacts\components"
$BuildStageDir = Join-Path $ProjectRoot "build\staging\lama-cpu"
$ZipTarget = Join-Path $ArtifactsDir "lama-cpu-win-x64-v1.0.0.zip"

Write-Host "[+] Preparing directories..."
if (Test-Path $BuildStageDir) { Remove-Item -Recurse -Force $BuildStageDir }
New-Item -ItemType Directory -Path $BuildStageDir -Force | Out-Null
New-Item -ItemType Directory -Path $ArtifactsDir -Force | Out-Null

Write-Host "[+] Copying template and sidecar files..."
$ComponentJson = Join-Path $ProjectRoot "component\lama\component.template.json"
Copy-Item $ComponentJson (Join-Path $BuildStageDir "component.json")

$SidecarDst = Join-Path $BuildStageDir "sidecar"
New-Item -ItemType Directory -Path $SidecarDst -Force | Out-Null
Copy-Item (Join-Path $ProjectRoot "sidecar\inpaint_server.py") (Join-Path $SidecarDst "inpaint_server.py")

$ModelsDst = Join-Path $BuildStageDir "models"
New-Item -ItemType Directory -Path $ModelsDst -Force | Out-Null
# Copy model file if present locally
$LocalModel = Join-Path $ProjectRoot "models\big-lama.pt"
if (Test-Path $LocalModel) {
    Copy-Item $LocalModel (Join-Path $ModelsDst "big-lama.pt")
}

Write-Host "[+] Creating component staging complete."
Write-Host "[+] Creating ZIP archive..."
if (Test-Path $ZipTarget) { Remove-Item -Force $ZipTarget }
Compress-Archive -Path "$BuildStageDir\*" -DestinationPath $ZipTarget -Force

Write-Host "[+] Invoking manifest writer..."
node (Join-Path $PSScriptRoot "write-lama-manifest.js") $ZipTarget
