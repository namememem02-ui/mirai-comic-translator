@echo off
title ComicTranslator Launchpad
echo [🧠] กำลังสตาร์ทระบบแปลการ์ตูน ComicTranslator...
npm start
if %errorlevel% neq 0 (
    echo [❌] พบข้อผิดพลาดในการรันโปรแกรม
    pause
)
