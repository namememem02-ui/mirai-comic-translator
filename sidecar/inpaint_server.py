import sys
import io
import threading

# Force UTF-8 encoding on Windows consoles to prevent UnicodeEncodeError crash
if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

import torch

# Dynamically detect if a compatible NVIDIA GPU (CUDA) is available, otherwise fallback to CPU
device = 'cuda' if torch.cuda.is_available() else 'cpu'

# MONKEY-PATCH: Force PyTorch JIT load to map to the detected device
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

lama = None
model_state = "loading"
model_message = "กำลังโหลดโมเดล LaMa"

def load_model_worker():
    global lama, model_state, model_message
    try:
        lama = SimpleLama()
        model_state = "ready"
        model_message = "AI รีทัชพร้อมใช้งาน"
        print("[AI] LaMa Model is ready on port 5000!")
    except Exception as e:
        model_state = "error"
        model_message = str(e)
        print(f"[AI] Error loading model: {e}")
        import traceback
        traceback.print_exc()

@app.on_event("startup")
def load_model():
    print("\n" + "="*50)
    print("[AI] Loading LaMa Inpainting Model...")
    print("[AI] Note: First run will download model weights (~300MB) automatically.")
    print("="*50 + "\n")
    threading.Thread(target=load_model_worker, daemon=True).start()

@app.get("/health")
def health():
    return {"state": model_state, "message": model_message}

@app.post("/inpaint")
async def inpaint(
    image: UploadFile = File(...),
    mask: UploadFile = File(...)
):
    if model_state != "ready" or lama is None:
        raise HTTPException(status_code=503, detail=model_message)

    try:
        # Read uploaded files
        img_bytes = await image.read()
        mask_bytes = await mask.read()

        # Convert to PIL Images
        img_pil = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        mask_pil = Image.open(io.BytesIO(mask_bytes)).convert("L")

        # Preserve the complete page context. Patch cropping produced visible seams
        # and block-shaped texture changes around large dialogue regions.
        result_pil = lama(img_pil, mask_pil)

        # Save output image to a memory stream
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
