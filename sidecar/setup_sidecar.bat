@echo off
title LaMa Inpainting Sidecar Launcher
cd /d "%~dp0"

echo [🧠] กำลังตรวจสอบความพร้อมของระบบ Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [❌] ไม่พบการติดตั้ง Python ในระบบของคุณ!
    echo กรุณาดาวน์โหลดและติดตั้ง Python (แนะนำรุ่น 3.9 - 3.11) จาก python.org
    echo อย่าลืมติ๊กเลือก "Add Python to PATH" ตอนติดตั้งด้วยนะครับ
    pause
    exit /b 1
)

if not exist .venv (
    echo [📦] กำลังสร้าง Virtual Environment (.venv)...
    python -m venv .venv
    if %errorlevel% neq 0 (
        echo [❌] การสร้าง venv ล้มเหลว!
        pause
        exit /b 1
    )
)

echo [🚀] เปิดใช้งาน Virtual Environment (.venv)...
call .venv\Scripts\activate.bat

echo [⚙️] กำลังดาวน์โหลดและติดตั้งไลบรารีที่จำเป็น (ขั้นตอนนี้ทำครั้งแรกครั้งเดียว)...
python -m pip install --upgrade pip
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [❌] การติดตั้งไลบรารีล้มเหลว!
    pause
    exit /b 1
)

echo [🔥] กำลังเริ่มรันเซิร์ฟเวอร์ AI Inpainting (LaMa)...
python inpaint_server.py
if %errorlevel% neq 0 (
    echo [❌] เซิร์ฟเวอร์หยุดทำงานกะทันหัน!
    pause
)
