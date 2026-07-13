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

        # Run AI Inpainting with Patch-based crop & paste to preserve high-res details and prevent blurriness
        mask_np = np.array(mask_pil)
        
        import cv2
        _, thresh = cv2.threshold(mask_np, 127, 255, cv2.THRESH_BINARY)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if len(contours) > 0:
            img_np = np.array(img_pil)
            h, w, _ = img_np.shape
            result_np = img_np.copy()
            
            for contour in contours:
                x, y, gw, gh = cv2.boundingRect(contour)
                # Add 32px padding on all sides for texture context
                pad = 32
                x1 = max(0, x - pad)
                y1 = max(0, y - pad)
                x2 = min(w, x + gw + pad)
                y2 = min(h, y + gh + pad)
                
                # Crop patches
                crop_img = img_np[y1:y2, x1:x2]
                crop_mask = mask_np[y1:y2, x1:x2]
                
                crop_img_pil = Image.fromarray(crop_img)
                crop_mask_pil = Image.fromarray(crop_mask)
                
                # Inpaint patch
                crop_result_pil = lama(crop_img_pil, crop_mask_pil)
                
                # Paste back, ensuring dimensions match original crop boundaries to prevent ValueError
                crop_result_np = np.array(crop_result_pil)
                if crop_result_np.shape[0] != (y2 - y1) or crop_result_np.shape[1] != (x2 - x1):
                    crop_result_np = cv2.resize(crop_result_np, (x2 - x1, y2 - y1), interpolation=cv2.INTER_AREA)
                result_np[y1:y2, x1:x2] = crop_result_np
                
            result_pil = Image.fromarray(result_np)
        else:
            result_pil = img_pil

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
