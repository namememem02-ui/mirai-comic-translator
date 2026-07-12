// UI Elements
const dropZone = document.getElementById('dropZone');
const folderInput = document.getElementById('folderInput');
const keyStatus = document.getElementById('keyStatus');
const projectInfo = document.getElementById('projectInfo');
const projName = document.getElementById('projName');
const projChapter = document.getElementById('projChapter');
const thumbnailsList = document.getElementById('thumbnailsList');
const activePageTitle = document.getElementById('activePageTitle');
const translatePageBtn = document.getElementById('translatePageBtn');
const translateAllBtn = document.getElementById('translateAllBtn');
const previewToggleBtn = document.getElementById('previewToggleBtn');
const exportChapterBtn = document.getElementById('exportChapterBtn');
const viewportContainer = document.getElementById('viewportContainer');
const activeImage = document.getElementById('activeImage');
const bubbleOverlay = document.getElementById('bubbleOverlay');
const placeholderView = document.getElementById('placeholderView');
const glossaryList = document.getElementById('glossaryList');
const addGlossaryBtn = document.getElementById('addGlossaryBtn');
const bubblesList = document.getElementById('bubblesList');
const canvasLoader = document.getElementById('canvasLoader');

// App State
let currentProject = '';
let currentChapter = '';
let images = [];
let activeIndex = -1;
let activePageTranslation = [];
let projectGlossary = {}; // { eng: thai }

// 1. Initialize API Config
window.api.getConfig().then((cfg) => {
  keyStatus.className = 'key-status';
  const dot = keyStatus.querySelector('.status-dot');
  const txt = keyStatus.querySelector('.status-text');
  
  if (cfg.hasKey) {
    keyStatus.classList.add('connected');
    txt.textContent = `Gemini เชื่อมต่อแล้ว (${cfg.apiKeyMasked})`;
  } else {
    keyStatus.classList.add('disconnected');
    txt.textContent = 'ยังไม่ได้ตั้งค่า API Key';
  }

  if (cfg.lastFolderPath) {
    loadFolder(cfg.lastFolderPath, true);
  }
});

// 2. Drag & Drop & Select Handlers
dropZone.addEventListener('click', async () => {
  const folderPath = await window.api.selectFolder();
  if (folderPath) {
    loadFolder(folderPath);
  }
});

// Prevent default drag behaviors globally to stop Chromium from navigating/opening files
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    const folderPath = files[0].path;
    loadFolder(folderPath);
  }
});

// Helper to extract directory name from file path in case window helper is missing
window.pathDirName = (filePath) => {
  // Simple path parser for Windows / Unix paths
  const idx = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  if (idx !== -1) return filePath.substring(0, idx);
  return filePath;
};

// 3. Load Folder logic
async function loadFolder(folderPath, isAutoLoad = false) {
  const res = await window.api.readFolder(folderPath);
  if (res.error) {
    if (!isAutoLoad) {
      alert(`ข้อผิดพลาด: ${res.error}`);
    }
    return;
  }

  currentProject = res.project;
  currentChapter = res.chapter;
  images = res.images;

  // Show Project Info
  projName.textContent = currentProject;
  projChapter.textContent = currentChapter;
  projectInfo.style.display = 'block';
  previewToggleBtn.disabled = false;
  exportChapterBtn.disabled = false;

  // Load Glossary memory
  projectGlossary = await window.api.loadMemory({ project: currentProject });
  renderGlossary();

  // Render Page list thumbnails
  renderThumbnails();

  // Load first page
  if (images.length > 0) {
    selectPage(0);
  }
}

// 4. Render Thumbnails
function renderThumbnails() {
  thumbnailsList.innerHTML = '';
  images.forEach((img, idx) => {
    const item = document.createElement('div');
    item.className = 'thumb-item';
    if (idx === activeIndex) item.classList.add('active');

    const preview = document.createElement('img');
    preview.className = 'thumb-preview';
    preview.src = img.fileUrl;

    const details = document.createElement('div');
    details.className = 'thumb-details';

    const name = document.createElement('div');
    name.className = 'thumb-name';
    name.textContent = img.name;

    const status = document.createElement('div');
    status.className = 'thumb-status';
    status.innerHTML = '<span>⏳ ยังไม่ได้แปล</span>';

    // Check if this page already has a translation file saved
    window.api.loadPageTranslation({
      project: currentProject,
      chapter: currentChapter,
      pageName: img.name
    }).then((existing) => {
      if (existing) {
        status.className = 'thumb-status translated';
        status.innerHTML = '<span>✅ แปลเสร็จแล้ว</span>';
      }
    });

    details.appendChild(name);
    details.appendChild(status);
    item.appendChild(preview);
    item.appendChild(details);

    item.addEventListener('click', () => selectPage(idx));
    thumbnailsList.appendChild(item);
  });
}

// 5. Select Active Page
async function selectPage(idx) {
  activeIndex = idx;
  
  // Highlight active thumbnail
  const items = thumbnailsList.querySelectorAll('.thumb-item');
  items.forEach((item, i) => {
    if (i === idx) item.classList.add('active');
    else item.classList.remove('active');
  });

  const activePage = images[idx];
  activePageTitle.textContent = activePage.name;

  // Clear Overlay
  bubbleOverlay.innerHTML = '';
  bubblesList.innerHTML = '';

  // Load Existing Page Translation
  const existingTranslation = await window.api.loadPageTranslation({
    project: currentProject,
    chapter: currentChapter,
    pageName: activePage.name
  });

  if (existingTranslation) {
    activePageTranslation = existingTranslation;
    renderPageTranslation();
  } else {
    activePageTranslation = [];
    renderPlaceholder();
  }

  // Render Image
  activeImage.src = activePage.fileUrl;
  placeholderView.style.display = 'none';
  viewportContainer.style.display = 'block';
  translatePageBtn.disabled = false;
  translateAllBtn.disabled = false;
}

// 6. Render Page Translation & SVG Overlays
function renderPageTranslation() {
  bubbleOverlay.innerHTML = '';
  bubblesList.innerHTML = '';

  if (activePageTranslation.length === 0) {
    renderPlaceholder();
    return;
  }

  activePageTranslation.forEach((bubble) => {
    // 1. Draw SVG Bounding Box
    if (bubble.box_2d && bubble.box_2d.length === 4) {
      const [ymin, xmin, ymax, xmax] = bubble.box_2d;
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', xmin);
      rect.setAttribute('y', ymin);
      rect.setAttribute('width', xmax - xmin);
      rect.setAttribute('height', ymax - ymin);
      rect.setAttribute('class', 'bubble-rect');
      rect.setAttribute('data-id', bubble.bubble_id);
      
      rect.addEventListener('mouseenter', () => highlightCard(bubble.bubble_id));
      rect.addEventListener('mouseleave', () => unhighlightCard(bubble.bubble_id));
      rect.addEventListener('click', () => focusCard(bubble.bubble_id));

      bubbleOverlay.appendChild(rect);
    }

    // 2. Draw Dialogue Editor Card
    const card = document.createElement('div');
    card.className = 'bubble-editor-card';
    card.setAttribute('data-id', bubble.bubble_id);

    const header = document.createElement('div');
    header.className = 'card-header';
    
    const idLabel = document.createElement('span');
    idLabel.className = 'bubble-id-label';
    idLabel.textContent = `บอลลูน #${bubble.bubble_id}`;

    header.appendChild(idLabel);

    const origText = document.createElement('div');
    origText.className = 'original-text-block';
    origText.textContent = bubble.original_text || '(ไม่มีอักษรตรวจพบ)';

    const transInput = document.createElement('textarea');
    transInput.className = 'translation-textarea';
    transInput.value = bubble.translated_text || '';
    
    // Auto-save on edit
    transInput.addEventListener('input', (e) => {
      bubble.translated_text = e.target.value;
      saveCurrentPageTranslation();
    });

    transInput.addEventListener('focus', () => {
      highlightOverlayRect(bubble.bubble_id);
      card.classList.add('active');
    });

    transInput.addEventListener('blur', () => {
      unhighlightOverlayRect(bubble.bubble_id);
      card.classList.remove('active');
    });

    card.appendChild(header);
    card.appendChild(origText);
    card.appendChild(transInput);

    bubblesList.appendChild(card);
  });
}

function renderPlaceholder() {
  bubblesList.innerHTML = `
    <div class="no-bubbles-placeholder">
      <p>ยังไม่มีข้อมูลคำแปลหน้านี้</p>
      <p class="sub">กดปุ่มแปลภาษาด้านบนเพื่อเรียกใช้ Gemini</p>
    </div>
  `;
}

// 7. Interactive highlight sync between SVG overlay and editor cards
function highlightCard(bubbleId) {
  const card = bubblesList.querySelector(`.bubble-editor-card[data-id="${bubbleId}"]`);
  if (card) {
    card.classList.add('active');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function unhighlightCard(bubbleId) {
  const card = bubblesList.querySelector(`.bubble-editor-card[data-id="${bubbleId}"]`);
  if (card) {
    card.classList.remove('active');
  }
}

function focusCard(bubbleId) {
  const card = bubblesList.querySelector(`.bubble-editor-card[data-id="${bubbleId}"]`);
  if (card) {
    const textEl = card.querySelector('textarea');
    if (textEl) textEl.focus();
  }
}

function highlightOverlayRect(bubbleId) {
  const rect = bubbleOverlay.querySelector(`.bubble-rect[data-id="${bubbleId}"]`);
  if (rect) rect.classList.add('active');
}

function unhighlightOverlayRect(bubbleId) {
  const rect = bubbleOverlay.querySelector(`.bubble-rect[data-id="${bubbleId}"]`);
  if (rect) rect.classList.remove('active');
}

// 8. Save/Save-Loop Page Translations
async function saveCurrentPageTranslation() {
  if (activeIndex === -1 || !images[activeIndex]) return;
  const activePage = images[activeIndex];
  
  await window.api.savePageTranslation({
    project: currentProject,
    chapter: currentChapter,
    pageName: activePage.name,
    translationData: activePageTranslation
  });

  // Re-verify and update translated checkmarks in explorer thumbnails
  const items = thumbnailsList.querySelectorAll('.thumb-item');
  const activeItem = items[activeIndex];
  if (activeItem) {
    const status = activeItem.querySelector('.thumb-status');
    status.className = 'thumb-status translated';
    status.innerHTML = '<span>✅ แปลเสร็จแล้ว</span>';
  }
}

// 9. Translate Page via Gemini Call
translatePageBtn.addEventListener('click', async () => {
  if (activeIndex === -1 || !images[activeIndex]) return;
  const activePage = images[activeIndex];

  translatePageBtn.disabled = true;
  translatePageBtn.textContent = '⏳ กำลังแปลหน้าการ์ตูน...';

  try {
    const result = await window.api.translatePage({
      imagePath: activePage.absolutePath,
      glossary: projectGlossary
    });

    activePageTranslation = result;
    
    // Save translation
    await saveCurrentPageTranslation();
    
    // Render results
    renderPageTranslation();
  } catch (err) {
    alert(`การแปลล้มเหลว: ${err.message}`);
  } finally {
    translatePageBtn.disabled = false;
    translatePageBtn.textContent = '⚡ แปลหน้านี้';
  }
});

let isTranslatingAll = false;
translateAllBtn.addEventListener('click', async () => {
  if (isTranslatingAll) return;
  isTranslatingAll = true;
  translatePageBtn.disabled = true;
  translateAllBtn.disabled = true;

  try {
    let translateCount = 0;
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      
      const existing = await window.api.loadPageTranslation({
        project: currentProject,
        chapter: currentChapter,
        pageName: img.name
      });
      
      if (existing) {
        continue;
      }
      
      translateCount++;
      translateAllBtn.textContent = `⏳ แปลหน้า ${i+1}/${images.length} (${img.name})...`;
      
      await selectPage(i);
      
      const result = await window.api.translatePage({
        imagePath: img.absolutePath,
        glossary: projectGlossary
      });
      
      activePageTranslation = result;
      
      await window.api.savePageTranslation({
        project: currentProject,
        chapter: currentChapter,
        pageName: img.name,
        translationData: result
      });
      
      renderPageTranslation();
      renderThumbnails();
      
      await new Promise(r => setTimeout(r, 1000));
    }
    
    if (translateCount === 0) {
      alert('ทุกหน้าในโฟลเดอร์นี้แปลเสร็จสมบูรณ์อยู่แล้วครับ!');
    } else {
      alert('🎉 แปลภาษาการ์ตูนทุกหน้าเสร็จสมบูรณ์เรียบร้อยแล้วครับ!');
    }
  } catch (err) {
    alert(`การแปลแบบกลุ่มล้มเหลวระหว่างดำเนินการ: ${err.message}`);
  } finally {
    isTranslatingAll = false;
    translatePageBtn.disabled = false;
    translateAllBtn.disabled = false;
    translateAllBtn.textContent = '⚡ แปลทุกหน้าอัตโนมัติ';
  }
});

// 10. Glossary Editor Management
function renderGlossary() {
  glossaryList.innerHTML = '';
  Object.entries(projectGlossary).forEach(([eng, thai]) => {
    createGlossaryRow(eng, thai);
  });
}

function createGlossaryRow(eng = '', thai = '') {
  const row = document.createElement('div');
  row.className = 'glossary-row';

  const engInput = document.createElement('input');
  engInput.type = 'text';
  engInput.placeholder = 'En Word';
  engInput.value = eng;

  const thaiInput = document.createElement('input');
  thaiInput.type = 'text';
  thaiInput.placeholder = 'คำแปลไทย';
  thaiInput.value = thai;

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-glossary-btn';
  deleteBtn.textContent = '✕';

  const saveGlossary = () => {
    // Re-build glossary map
    const newGlossary = {};
    const rows = glossaryList.querySelectorAll('.glossary-row');
    rows.forEach(r => {
      const inputs = r.querySelectorAll('input');
      const eVal = inputs[0].value.trim();
      const tVal = inputs[1].value.trim();
      if (eVal) newGlossary[eVal] = tVal;
    });

    projectGlossary = newGlossary;
    window.api.saveMemory({ project: currentProject, memoryData: projectGlossary });
  };

  engInput.addEventListener('change', saveGlossary);
  thaiInput.addEventListener('change', saveGlossary);
  deleteBtn.addEventListener('click', () => {
    row.remove();
    saveGlossary();
  });

  row.appendChild(engInput);
  row.appendChild(thaiInput);
  row.appendChild(deleteBtn);
  glossaryList.appendChild(row);
}

addGlossaryBtn.addEventListener('click', () => {
  createGlossaryRow();
});

// 11. Typeset Preview and Export Management
let isPreviewMode = false;
previewToggleBtn.addEventListener('click', () => {
  isPreviewMode = !isPreviewMode;
  if (isPreviewMode) {
    previewToggleBtn.textContent = '👁️ ดูภาพต้นฉบับ';
    previewToggleBtn.classList.remove('btn-accent');
    previewToggleBtn.classList.add('btn-secondary');
  } else {
    previewToggleBtn.textContent = '👁️ ดูหน้าแปลไทย';
    previewToggleBtn.classList.remove('btn-secondary');
    previewToggleBtn.classList.add('btn-accent');
  }
  
  if (activeIndex !== -1) {
    selectPage(activeIndex);
  }
});

activeImage.addEventListener('load', () => {
  if (activeImage.src.startsWith('data:')) {
    return;
  }
  if (isPreviewMode && activePageTranslation.length > 0) {
    renderTypesetImage();
  }
});

async function renderTypesetImage() {
  canvasLoader.style.display = 'flex';
  const originalSrc = activeImage.src;
  const canvas = document.createElement('canvas');
  canvas.width = activeImage.naturalWidth;
  canvas.height = activeImage.naturalHeight;
  const ctx = canvas.getContext('2d');
  
  let cleanedImgElement = activeImage;
  let objectUrlToCleanup = null;
  
  try {
    const inpaintedBlob = await runAIInpaint(originalSrc, activePageTranslation, canvas.width, canvas.height);
    objectUrlToCleanup = URL.createObjectURL(inpaintedBlob);
    
    const cleanImg = new Image();
    cleanImg.src = objectUrlToCleanup;
    await new Promise((resolve, reject) => {
      cleanImg.onload = resolve;
      cleanImg.onerror = reject;
    });
    cleanedImgElement = cleanImg;
  } catch (err) {
    console.warn('[⚠️] AI Inpainting failed or offline. Falling back to smooth flat color erase. Error:', err.message);
  }
  
  ctx.drawImage(cleanedImgElement, 0, 0);
  
  if (objectUrlToCleanup) {
    URL.revokeObjectURL(objectUrlToCleanup);
  }
  
  activePageTranslation.forEach((bubble) => {
    if (!bubble.box_2d || bubble.box_2d.length !== 4) return;
    const [ymin, xmin, ymax, xmax] = bubble.box_2d;
    const x1 = (xmin / 1000) * canvas.width;
    const y1 = (ymin / 1000) * canvas.height;
    const x2 = (xmax / 1000) * canvas.width;
    const y2 = (ymax / 1000) * canvas.height;
    const w = x2 - x1;
    const h = y2 - y1;
    
    if (cleanedImgElement === activeImage) {
      const bgColor = sampleBubbleBackground(ctx, x1, y1, w, h);
      drawSmoothErase(ctx, x1, y1, w, h, bgColor);
    }
    
    const bgColorForContrast = (cleanedImgElement === activeImage)
      ? sampleBubbleBackground(ctx, x1, y1, w, h)
      : '#ffffff';
      
    if (bubble.translated_text) {
      drawTypesetText(ctx, bubble.translated_text, x1, y1, w, h, bgColorForContrast);
    }
  });
  
  activeImage.src = canvas.toDataURL('image/jpeg', 0.95);
  canvasLoader.style.display = 'none';
}

function sampleBubbleBackground(ctx, x, y, w, h) {
  try {
    const pixels = [
      ctx.getImageData(Math.max(0, Math.round(x + w * 0.15)), Math.max(0, Math.round(y + h * 0.15)), 1, 1).data,
      ctx.getImageData(Math.min(ctx.canvas.width - 1, Math.round(x + w * 0.85)), Math.max(0, Math.round(y + h * 0.15)), 1, 1).data,
      ctx.getImageData(Math.max(0, Math.round(x + w * 0.15)), Math.min(ctx.canvas.height - 1, Math.round(y + h * 0.85)), 1, 1).data,
      ctx.getImageData(Math.min(ctx.canvas.width - 1, Math.round(x + w * 0.85)), Math.min(ctx.canvas.height - 1, Math.round(y + h * 0.85)), 1, 1).data
    ];
    
    let r = 0, g = 0, b = 0;
    for (const p of pixels) {
      r += p[0];
      g += p[1];
      b += p[2];
    }
    r = Math.round(r / 4);
    g = Math.round(g / 4);
    b = Math.round(b / 4);
    
    if (r > 220 && g > 220 && b > 220) {
      return '#ffffff';
    }
    if (r < 35 && g < 35 && b < 35) {
      return '#000000';
    }
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  } catch (e) {
    return '#ffffff';
  }
}

function drawTypesetText(ctx, text, x, y, w, h, bgColor = '#ffffff') {
  // Check contrast of background to choose black or white text
  let textColor = '#000000';
  if (bgColor.startsWith('#')) {
    const r = parseInt(bgColor.slice(1, 3), 16) || 0;
    const g = parseInt(bgColor.slice(3, 5), 16) || 0;
    const b = parseInt(bgColor.slice(5, 7), 16) || 0;
    const luminance = r * 0.299 + g * 0.587 + b * 0.114;
    if (luminance < 130) textColor = '#ffffff';
  }

  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  let fontSize = Math.max(14, Math.round(h * 0.18));
  if (fontSize > 40) fontSize = 40;
  
  let lines = [];
  
  while (fontSize >= 6) {
    ctx.font = `bold ${fontSize}px 'Sarabun', 'Segoe UI', sans-serif`;
    lines = wrapThaiText(ctx, text, w * 0.85);
    const totalHeight = lines.length * (fontSize * 1.25);
    if (totalHeight <= h * 0.85) {
      break;
    }
    fontSize -= 1;
  }
  
  const lineHeight = fontSize * 1.25;
  const startY = y + (h / 2) - ((lines.length - 1) * lineHeight / 2);
  
  lines.forEach((line, idx) => {
    ctx.fillText(line, x + (w / 2), startY + (idx * lineHeight));
  });
}

function wrapThaiText(ctx, text, maxWidth) {
  const chars = Array.from(text);
  let lines = [];
  let currentLine = '';
  
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const testLine = currentLine + char;
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

function drawSmoothErase(ctx, x, y, w, h, bgColor) {
  ctx.save();
  const padding = Math.max(3, Math.min(8, w * 0.05, h * 0.05));
  const ex = x + padding;
  const ey = y + padding;
  const ew = w - padding * 2;
  const eh = h - padding * 2;
  
  if (ew <= 0 || eh <= 0) {
    ctx.restore();
    return;
  }
  
  ctx.filter = 'blur(4px)';
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(ex, ey, ew, eh, Math.min(ew, eh) * 0.25);
  ctx.fill();
  ctx.restore();
}

async function runAIInpaint(imgUrl, bubbles, canvasWidth, canvasHeight) {
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = canvasWidth;
  maskCanvas.height = canvasHeight;
  const mctx = maskCanvas.getContext('2d');
  
  mctx.fillStyle = '#000000';
  mctx.fillRect(0, 0, canvasWidth, canvasHeight);
  
  bubbles.forEach((bubble) => {
    if (!bubble.box_2d || bubble.box_2d.length !== 4) return;
    const [ymin, xmin, ymax, xmax] = bubble.box_2d;
    const x1 = (xmin / 1000) * canvasWidth;
    const y1 = (ymin / 1000) * canvasHeight;
    const x2 = (xmax / 1000) * canvasWidth;
    const y2 = (ymax / 1000) * canvasHeight;
    const w = x2 - x1;
    const h = y2 - y1;
    
    mctx.fillStyle = '#ffffff';
    mctx.beginPath();
    mctx.roundRect(x1, y1, w, h, Math.min(w, h) * 0.2);
    mctx.fill();
  });
  
  const originalBlob = await fetch(imgUrl).then(r => r.blob());
  const maskBlob = await new Promise(resolve => maskCanvas.toBlob(resolve, 'image/png'));
  
  const formData = new FormData();
  formData.append('image', originalBlob, 'image.jpg');
  formData.append('mask', maskBlob, 'mask.png');
  
  const res = await fetch('http://localhost:5000/inpaint', {
    method: 'POST',
    body: formData
  });
  
  if (!res.ok) {
    throw new Error(`Inpaint server returned HTTP ${res.status}`);
  }
  
  return await res.blob();
}

exportChapterBtn.addEventListener('click', async () => {
  exportChapterBtn.disabled = true;
  const oldText = exportChapterBtn.textContent;
  
  try {
    let exportedCount = 0;
    for (let i = 0; i < images.length; i++) {
      const imgObj = images[i];
      exportChapterBtn.textContent = `⏳ ส่งออกหน้า ${i+1}/${images.length}...`;
      
      const translation = await window.api.loadPageTranslation({
        project: currentProject,
        chapter: currentChapter,
        pageName: imgObj.name
      });
      
      const img = new Image();
      img.src = imgObj.fileUrl;
      await new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve;
      });
      
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 800;
      canvas.height = img.naturalHeight || 1200;
      const ctx = canvas.getContext('2d');
      
      let cleanedImg = img;
      let tempUrl = null;
      
      if (translation && translation.length > 0) {
        try {
          const inpaintedBlob = await runAIInpaint(imgObj.fileUrl, translation, canvas.width, canvas.height);
          tempUrl = URL.createObjectURL(inpaintedBlob);
          const cleanImg = new Image();
          cleanImg.src = tempUrl;
          await new Promise((resolve, reject) => {
            cleanImg.onload = resolve;
            cleanImg.onerror = reject;
          });
          cleanedImg = cleanImg;
        } catch (err) {
          console.warn('[⚠️] AI Inpainting failed or offline for export. Falling back to smooth erase. Error:', err.message);
        }
      }
      
      ctx.drawImage(cleanedImg, 0, 0);
      if (tempUrl) URL.revokeObjectURL(tempUrl);
      
      if (translation && translation.length > 0) {
        translation.forEach((bubble) => {
          if (!bubble.box_2d || bubble.box_2d.length !== 4) return;
          const [ymin, xmin, ymax, xmax] = bubble.box_2d;
          const x1 = (xmin / 1000) * canvas.width;
          const y1 = (ymin / 1000) * canvas.height;
          const x2 = (xmax / 1000) * canvas.width;
          const y2 = (ymax / 1000) * canvas.height;
          const w = x2 - x1;
          const h = y2 - y1;
          
          if (cleanedImg === img) {
            const bgColor = sampleBubbleBackground(ctx, x1, y1, w, h);
            drawSmoothErase(ctx, x1, y1, w, h, bgColor);
          }
          
          const bgColorForContrast = (cleanedImg === img)
            ? sampleBubbleBackground(ctx, x1, y1, w, h)
            : '#ffffff';
            
          if (bubble.translated_text) {
            drawTypesetText(ctx, bubble.translated_text, x1, y1, w, h, bgColorForContrast);
          }
        });
      }
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      
      const saveRes = await window.api.saveTypesetImage({
        project: currentProject,
        chapter: currentChapter,
        pageName: imgObj.name,
        dataUrl: dataUrl
      });
      
      if (saveRes.error) {
        throw new Error(saveRes.error);
      }
      exportedCount++;
    }
    
    alert(`🎉 ส่งออกตอนสำเร็จ!\nไฟล์ทั้งหมดบันทึกแล้วในโฟลเดอร์โครงการที่:\noutput/${currentProject}/${currentChapter}/`);
  } catch (err) {
    alert(`การส่งออกล้มเหลว: ${err.message}`);
  } finally {
    exportChapterBtn.disabled = false;
    exportChapterBtn.textContent = oldText;
  }
});
