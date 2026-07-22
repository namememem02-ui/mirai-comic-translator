# LaMa Component & Application Publishing Guide

This guide details the release tag conventions and upload sequence for GitHub Releases in `namememem02-ui/mirai-comic-translator`.

## Release Tags & Naming

1. **LaMa Component Release Tag:** `components-v1.0.0`
   - Release Target: Tagged component releases
   - Assets:
     - `lama-cpu-win-x64-v1.0.0.zip` (CPU component archive)
     - `lama-components.json` (SHA-256 verified manifest)
   - Mandatory Upload Order:
     - Upload `lama-cpu-win-x64-v1.0.0.zip` FIRST
     - Upload `lama-components.json` SECOND (so manifest SHA-256 references a published ZIP)

2. **Application Installer Tag:** `v0.1.0`
   - Assets:
     - `Mee-a-rai-ComicTranslator-Setup-0.1.0.exe`

## Build & Publishing Commands

```powershell
# 1. Build CPU LaMa Component Archive & Manifest
powershell -ExecutionPolicy Bypass -File scripts\build-lama-cpu.ps1

# 2. Build Windows Application Installer
npm.cmd run dist:win

# 3. Create GitHub Component Release & Upload Assets
gh release create components-v1.0.0 artifacts/components/lama-cpu-win-x64-v1.0.0.zip artifacts/components/lama-components.json --repo namememem02-ui/mirai-comic-translator --title "LaMa Component v1.0.0"

# 4. Create GitHub Application Release & Upload Installer
gh release create v0.1.0 artifacts/installer/Mee-a-rai-ComicTranslator-Setup-0.1.0.exe --repo namememem02-ui/mirai-comic-translator --title "Mee-a-rai Comic Translator v0.1.0"
```

## Checksum Verification

Before publishing, verify SHA-256 hashes locally:

```powershell
Get-FileHash artifacts/components/lama-cpu-win-x64-v1.0.0.zip -Algorithm SHA256
Get-FileHash artifacts/installer/Mee-a-rai-ComicTranslator-Setup-0.1.0.exe -Algorithm SHA256
```
