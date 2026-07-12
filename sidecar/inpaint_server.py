import io
import numpy as np
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import StreamingResponse
from PIL import Image
from simple_lama_inpainting import SimpleLama

app = FastAPI(title="LaMa Inpainting Sidecar API")
lama = None

@app.on_event("startup")
def load_model():
    global lama
    print("\n" + "="*50)
    print("[🧠] กำลังโหลดโมเดล AI Inpainting (LaMa)...")
    print("[💡] หมายเหตุ: การทำงานครั้งแรก ระบบจะดาวน์โหลดน้ำหนักโมเดล (~300MB) โดยอัตโนมัติ")
    print("="*50 + "\n")
    try:
        lama = SimpleLama()
        print("\n" + "="*50)
        print("[✅] โมเดล LaMa พร้อมทำงานบนพอร์ต 5000 แล้วครับ!")
        print("="*50 + "\n")
    except Exception as e:
        print(f"[❌] เกิดข้อผิดพลาดในการโหลดโมเดล: {e}")

@app.post("/inpaint")
async def inpaint(
    image: UploadFile = File(...),
    mask: UploadFile = File(...)
):
    global lama
    if lama is None:
        lama = SimpleLama()

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=5000)
