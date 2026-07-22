import sys
import io
import os
import threading

# Force UTF-8 encoding on Windows consoles to prevent UnicodeEncodeError crash
if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

import torch

# Read managed environment variables
backend = os.environ.get('LAMA_BACKEND', 'cpu')
model_path = os.environ.get('LAMA_MODEL', '')
component_version = os.environ.get('LAMA_VERSION', '')

error_code = None
model_state = "loading"
model_message = "กำลังโหลดโมเดล LaMa"
lama = None

if backend == 'cuda' and not torch.cuda.is_available():
    model_state = "error"
    error_code = "cuda-unavailable"
    model_message = "ไม่พบฮาร์ดแวร์หรือไดรเวอร์ NVIDIA CUDA"
    device = 'cpu'
else:
    device = 'cuda' if backend == 'cuda' and torch.cuda.is_available() else 'cpu'

# MONKEY-PATCH: Force PyTorch JIT load to map to the target device
original_jit_load = torch.jit.load
def patched_jit_load(f, map_location=None, *args, **kwargs):
    if map_location is None:
        map_location = device
    return original_jit_load(f, map_location=map_location, *args, **kwargs)
torch.jit.load = patched_jit_load

import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from simple_lama_inpainting import SimpleLama

app = FastAPI(title="LaMa Inpainting Sidecar API")

# Enable CORS for Electron frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def classify_error(e):
    err_str = str(e).lower()
    if 'out of memory' in err_str or 'cuda error: out of memory' in err_str:
        return 'cuda-out-of-memory', 'หน่วยความจำการ์ดจอ (VRAM) ไม่เพียงพอ'
    if 'driver' in err_str or 'cuda driver' in err_str:
        return 'driver-too-old', 'ไดรเวอร์การ์ดจอ NVIDIA เก่าเกินไป'
    if 'no such file' in err_str or 'not found' in err_str or 'model' in err_str:
        return 'model-missing', 'ไม่พบไฟล์โมเดล LaMa'
    return 'startup-failed', f'ไม่สามารถเริ่ม AI รีทัชได้: {e}'

def load_model_worker():
    global lama, model_state, model_message, error_code
    if model_state == "error" and error_code == "cuda-unavailable":
        return

    try:
        if model_path and os.path.exists(model_path):
            lama = SimpleLama(model_path=model_path, device=torch.device(device))
        else:
            lama = SimpleLama(device=torch.device(device))
        model_state = "ready"
        error_code = None
        model_message = "AI รีทัชพร้อมใช้งาน"
        print(f"[AI] LaMa Model is ready on port 5000 using {device}!")
    except Exception as e:
        model_state = "error"
        error_code, model_message = classify_error(e)
        print(f"[AI] Error loading model: {e}")
        import traceback
        traceback.print_exc()

@app.on_event("startup")
def load_model():
    print("\n" + "="*50)
    print(f"[AI] Loading LaMa Inpainting Model (Backend: {backend}, Device: {device})...")
    print("="*50 + "\n")
    threading.Thread(target=load_model_worker, daemon=True).start()

@app.get("/health")
def health():
    return {
        "state": model_state,
        "backend": backend,
        "componentVersion": component_version,
        "errorCode": error_code,
        "message": model_message,
    }

@app.post("/inpaint")
async def inpaint(
    image: UploadFile = File(...),
    mask: UploadFile = File(...)
):
    if model_state != "ready" or lama is None:
        raise HTTPException(status_code=503, detail=model_message)

    try:
        img_bytes = await image.read()
        mask_bytes = await mask.read()

        img_pil = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        mask_pil = Image.open(io.BytesIO(mask_bytes)).convert("L")

        result_pil = lama(img_pil, mask_pil)

        output_buffer = io.BytesIO()
        result_pil.save(output_buffer, format="JPEG", quality=95)
        output_buffer.seek(0)

        return StreamingResponse(output_buffer, media_type="image/jpeg")
    except Exception as e:
        print(f"[AI] Error during inpainting: {e}")
        import traceback
        traceback.print_exc()
        raise e

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=5000)
