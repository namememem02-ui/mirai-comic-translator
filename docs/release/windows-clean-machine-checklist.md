# Windows Clean-Machine Release Verification Checklist

This checklist verifies the packaged installer (`Mee-a-rai-ComicTranslator-Setup-0.1.0.exe`) on a clean Windows x64 machine with no pre-installed Python, Screen Translator, CUDA, or Node.js.

## Prerequisites & Pre-flight

- [ ] Target OS: Windows 10/11 x64 (clean install or sandbox)
- [ ] Installer artifact: `artifacts/installer/Mee-a-rai-ComicTranslator-Setup-0.1.0.exe`
- [ ] Component manifest: `https://github.com/namememem02-ui/mirai-comic-translator/releases/latest/download/lama-components.json`

## Test Matrix

1. **Clean Installation:**
   - [ ] Run `Mee-a-rai-ComicTranslator-Setup-0.1.0.exe`
   - [ ] Confirm Desktop & Start Menu shortcuts are created
   - [ ] Launch application without system Python installed
   - [ ] Verify application opens and translation / editing / export features work without LaMa

2. **LaMa Component Onboarding:**
   - [ ] Open Settings ➔ Retouch tab
   - [ ] Confirm hardware detection shows CPU ready and NVIDIA status
   - [ ] Click "ติดตั้ง AI รีทัช" (Install)
   - [ ] Confirm byte progress and percentage progress bar update smoothly
   - [ ] Verify successful activation transitions header badge to `AI รีทัช · CPU`

3. **Inpainting & Offline Support:**
   - [ ] Retouch one comic page with dialogue bubble
   - [ ] Confirm LaMa removes text cleanly without errors
   - [ ] Disconnect network / test offline
   - [ ] Confirm LaMa remains functional offline using installed local component

4. **Fallback & Recovery:**
   - [ ] Test Cancel download mid-stream ➔ confirm staging is cleaned and UI restores prior state
   - [ ] Test Repair ➔ confirm component re-extracts cleanly
   - [ ] Test Remove ➔ confirm component directory is removed from `%APPDATA%\comic-translator`

5. **Uninstallation & Data Preservation:**
   - [ ] Run Uninstaller from Control Panel / Settings
   - [ ] Confirm application binary is uninstalled
   - [ ] Confirm user project data (`projects/`) remains intact
