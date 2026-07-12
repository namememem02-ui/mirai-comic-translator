import io
import urllib.request
import urllib.error
from PIL import Image

def test():
    print("[+] Creating dummy test images...")
    # Create a 100x100 black image
    img = Image.new("RGB", (100, 100), color="blue")
    # Create a 100x100 mask with a white box in the center
    mask = Image.new("L", (100, 100), color=0)
    for x in range(30, 70):
        for y in range(30, 70):
            mask.putpixel((x, y), 255)
            
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='JPEG')
    img_bytes = img_byte_arr.getvalue()
    
    mask_byte_arr = io.BytesIO()
    mask.save(mask_byte_arr, format='PNG')
    mask_bytes = mask_byte_arr.getvalue()
    
    # Construct multipart/form-data manually
    boundary = b'----WebKitFormBoundary7MA4YWxkTrZu0gW'
    body = []
    
    # Image field
    body.append(b'--' + boundary)
    body.append(b'Content-Disposition: form-data; name="image"; filename="image.jpg"')
    body.append(b'Content-Type: image/jpeg')
    body.append(b'')
    body.append(img_bytes)
    
    # Mask field
    body.append(b'--' + boundary)
    body.append(b'Content-Disposition: form-data; name="mask"; filename="mask.png"')
    body.append(b'Content-Type: image/png')
    body.append(b'')
    body.append(mask_bytes)
    
    body.append(b'--' + boundary + b'--')
    body.append(b'')
    
    body_bytes = b'\r\n'.join(body)
    
    req = urllib.request.Request(
        "http://127.0.0.1:5001/inpaint",
        data=body_bytes,
        headers={
            'Content-Type': b'multipart/form-data; boundary=' + boundary,
            'Content-Length': str(len(body_bytes))
        }
    )
    
    print("[+] Sending request to inpaint server...")
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            status = response.getcode()
            print(f"[+] Server returned status code: {status}")
            if status == 200:
                print("[✅] Inpaint test SUCCESSFUL!")
    except urllib.error.HTTPError as e:
        print(f"[❌] Server returned HTTP error: {e.code} - {e.read().decode('utf-8', errors='ignore')}")
    except Exception as e:
        print(f"[❌] Connection failed: {e}")

if __name__ == "__main__":
    test()
