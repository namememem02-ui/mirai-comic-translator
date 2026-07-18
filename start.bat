@echo off
title Mee-a-rai Comic Translator Launchpad
echo [🧠] กำลังสตาร์ทระบบแปลการ์ตูน Mee-a-rai Comic Translator...
npm start
if %errorlevel% neq 0 (
    echo [❌] พบข้อผิดพลาดในการรันโปรแกรม
    pause
)
