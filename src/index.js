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
const viewportContainer = document.getElementById('viewportContainer');
const activeImage = document.getElementById('activeImage');
const bubbleOverlay = document.getElementById('bubbleOverlay');
const placeholderView = document.getElementById('placeholderView');
const glossaryList = document.getElementById('glossaryList');
const addGlossaryBtn = document.getElementById('addGlossaryBtn');
const bubblesList = document.getElementById('bubblesList');

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
async function loadFolder(folderPath) {
  const res = await window.api.readFolder(folderPath);
  if (res.error) {
    alert(`ข้อผิดพลาด: ${res.error}`);
    return;
  }

  currentProject = res.project;
  currentChapter = res.chapter;
  images = res.images;

  // Show Project Info
  projName.textContent = currentProject;
  projChapter.textContent = currentChapter;
  projectInfo.style.display = 'block';

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
  
  // Render Image
  activeImage.src = activePage.fileUrl;
  placeholderView.style.display = 'none';
  viewportContainer.style.display = 'block';
  translatePageBtn.disabled = false;

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
    translatePageBtn.textContent = '⚡ แปลหน้านี้ด้วย Gemini';
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
