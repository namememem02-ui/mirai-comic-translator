import sys
import io

# Force UTF-8 encoding on Windows consoles to prevent UnicodeEncodeError crash
if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

import torch

# MONKEY-PATCH: Force PyTorch JIT load to always map to CPU.
# This prevents NotImplementedError (CUDA backend fallback issues) on CPU-only machines.
original_jit_load = torch.jit.load
def patched_jit_load(f, map_location=None, *args, **kwargs):
    if map_location is None:
        map_location = 'cpu'
    return original_jit_load(f, map_location=map_location, *args, **kwargs)
torch.jit.load = patched_jit_load

import numpy as np
from fastapi import FastAPI, UploadFile, File
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

@app.on_event("startup")
def load_model():
    global lama
    print("\n" + "="*50)
    print("[AI] Loading LaMa Inpainting Model...")
    print("[AI] Note: First run will download model weights (~300MB) automatically.")
    print("="*50 + "\n")
    try:
        lama = SimpleLama()
        print("\n" + "="*50)
        print("[AI] LaMa Model is ready on port 5000!")
        print("="*50 + "\n")
    except Exception as e:
        print(f"[AI] Error loading model: {e}")
        import traceback
        traceback.print_exc()

@app.post("/inpaint")
async def inpaint(
    image: UploadFile = File(...),
    mask: UploadFile = File(...)
):
    global lama
    if lama is None:
        lama = SimpleLama()

    try:
        # Read uploaded files
        img_bytes = await image.read()
        mask_bytes = await mask.read()

        # Convert to PIL Images
        img_pil = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        mask_pil = Image.open(io.BytesIO(mask_bytes)).convert("L")

        # Run AI Inpainting
        # LaMa expects a grayscale PIL mask where white (255) defines the regions to repair
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
