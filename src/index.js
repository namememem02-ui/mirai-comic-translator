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
const cleanedBgCache = {}; // { pageName: dataUrl }
const recentColors = ['#000000', '#ffffff', '#ef4444', '#f59e0b', '#3b82f6'];

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

  // Load Saved Projects List on startup
  updateSavedProjectsList();

  if (cfg.lastFolderPath) {
    loadFolder(cfg.lastFolderPath, true);
  }
});

// Collapsible Saved Projects UI Toggles
const savedProjectsHeader = document.getElementById('savedProjectsHeader');
const savedProjectsList = document.getElementById('savedProjectsList');
const savedProjectsToggleIcon = document.getElementById('savedProjectsToggleIcon');

savedProjectsHeader.addEventListener('click', () => {
  const isHidden = savedProjectsList.style.display === 'none';
  if (isHidden) {
    savedProjectsList.style.display = 'flex';
    savedProjectsToggleIcon.textContent = '▼';
  } else {
    savedProjectsList.style.display = 'none';
    savedProjectsToggleIcon.textContent = '▶';
  }
});

// Collapsible Active Chapter Thumbnails UI Toggles
const projectInfoToggle = document.getElementById('projectInfo');
const thumbnailsToggleIcon = document.getElementById('thumbnailsToggleIcon');

projectInfoToggle.addEventListener('click', () => {
  const isHidden = thumbnailsList.style.display === 'none';
  if (isHidden) {
    thumbnailsList.style.display = 'block';
    thumbnailsToggleIcon.textContent = '▼';
  } else {
    thumbnailsList.style.display = 'none';
    thumbnailsToggleIcon.textContent = '▶';
  }
});

// Helper to list saved projects and render them
async function updateSavedProjectsList() {
  const list = await window.api.listProjects();
  if (list.length === 0) {
    savedProjectsList.innerHTML = '<div style="padding: 4px 0; color: #64748b;">ไม่มีประวัติโครงการที่เคยเปิด</div>';
    return;
  }
  
  savedProjectsList.innerHTML = '';
  list.forEach(project => {
    const projDiv = document.createElement('div');
    projDiv.style.marginBottom = '6px';
    
    const projTitle = document.createElement('div');
    projTitle.style.fontWeight = '600';
    projTitle.style.color = '#f1f5f9';
    projTitle.style.cursor = 'default';
    projTitle.style.display = 'flex';
    projTitle.style.alignItems = 'center';
    projTitle.style.gap = '4px';
    projTitle.textContent = `📁 ${project.name}`;
    
    const chaptersContainer = document.createElement('div');
    chaptersContainer.style.paddingLeft = '14px';
    chaptersContainer.style.marginTop = '2px';
    chaptersContainer.style.display = 'flex';
    chaptersContainer.style.flexDirection = 'column';
    chaptersContainer.style.gap = '4px';
    
    project.chapters.forEach(chap => {
      const chapLink = document.createElement('div');
      chapLink.style.cursor = 'pointer';
      chapLink.style.color = '#38bdf8';
      chapLink.style.textDecoration = 'underline';
      chapLink.style.fontSize = '11px';
      chapLink.textContent = `ตอนที่ ${chap.chapter}`;
      
      chapLink.addEventListener('click', (e) => {
        e.stopPropagation();
        loadFolder(chap.folderPath);
      });
      
      chaptersContainer.appendChild(chapLink);
    });
    
    projDiv.appendChild(projTitle);
    projDiv.appendChild(chaptersContainer);
    savedProjectsList.appendChild(projDiv);
  });
}

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

  // Refresh saved projects list
  updateSavedProjectsList();

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

  // Show studio toolbar and reset tool to select mode
  studioToolbar.style.display = 'flex';
  if (typeof switchTool === 'function') switchTool('select');

  // Load custom mask and paint layers when raw image is loaded
  activeImage.onload = async () => {
    if (activeImage.src.startsWith('data:')) return;
    
    brushMaskCanvas.width = activeImage.naturalWidth || 800;
    brushMaskCanvas.height = activeImage.naturalHeight || 1200;
    colorPaintCanvas.width = activeImage.naturalWidth || 800;
    colorPaintCanvas.height = activeImage.naturalHeight || 1200;
    
    const ctx = brushMaskCanvas.getContext('2d');
    ctx.clearRect(0, 0, brushMaskCanvas.width, brushMaskCanvas.height);
    
    const pctx = colorPaintCanvas.getContext('2d');
    pctx.clearRect(0, 0, colorPaintCanvas.width, colorPaintCanvas.height);
    
    try {
      const maskRes = await window.api.loadCustomMask({
        project: currentProject,
        chapter: currentChapter,
        pageName: activePage.name
      });
      if (maskRes && maskRes.exists) {
        const maskImg = new Image();
        const formattedPath = maskRes.absolutePath.replace(/\\/g, '/');
        maskImg.src = `file:///${formattedPath}`;
        maskImg.onload = () => {
          ctx.drawImage(maskImg, 0, 0);
        };
      }
    } catch (err) {
      console.warn('[⚠️] Failed to load custom mask:', err);
    }
    
    try {
      const paintRes = await window.api.loadCustomPaint({
        project: currentProject,
        chapter: currentChapter,
        pageName: activePage.name
      });
      if (paintRes && paintRes.exists) {
        const paintImg = new Image();
        const formattedPath = paintRes.absolutePath.replace(/\\/g, '/');
        paintImg.src = `file:///${formattedPath}`;
        paintImg.onload = () => {
          pctx.drawImage(paintImg, 0, 0);
        };
      }
    } catch (err) {
      console.warn('[⚠️] Failed to load custom paint layer:', err);
    }
  };

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
    // 1. Draw SVG Bounding Box Group with Resize Handle
    if (bubble.box_2d && bubble.box_2d.length === 4) {
      const [ymin, xmin, ymax, xmax] = bubble.box_2d;
      
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'bubble-group');
      g.setAttribute('data-id', bubble.bubble_id);
      
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', xmin);
      rect.setAttribute('y', ymin);
      rect.setAttribute('width', xmax - xmin);
      rect.setAttribute('height', ymax - ymin);
      rect.setAttribute('class', 'bubble-rect');
      rect.setAttribute('data-id', bubble.bubble_id);
      if (bubble.hidden) {
        rect.style.fill = 'rgba(239, 68, 68, 0.05)';
        rect.style.stroke = '#ef4444';
        rect.style.strokeDasharray = '4,4';
      } else {
        rect.style.fill = 'rgba(168, 85, 247, 0.15)';
        rect.style.stroke = '#a855f7';
      }
      rect.style.strokeWidth = '2px';
      rect.style.cursor = 'move';
      
      rect.addEventListener('mouseenter', () => highlightCard(bubble.bubble_id));
      rect.addEventListener('mouseleave', () => unhighlightCard(bubble.bubble_id));
      rect.addEventListener('click', () => focusCard(bubble.bubble_id));

      g.appendChild(rect);

      // Circle handle for resizing (placed at bottom-right corner)
      const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      handle.setAttribute('cx', xmax);
      handle.setAttribute('cy', ymax);
      handle.setAttribute('r', 8);
      handle.setAttribute('class', 'bubble-resize-handle');
      handle.setAttribute('data-id', bubble.bubble_id);
      
      if (bubble.hidden) {
        handle.style.fill = '#ef4444';
      } else {
        handle.style.fill = '#a855f7';
      }
      handle.style.stroke = '#ffffff';
      handle.style.strokeWidth = '2px';
      handle.style.cursor = 'se-resize';
      
      g.appendChild(handle);
      bubbleOverlay.appendChild(g);
    }

    // 2. Draw Dialogue Editor Card
    const card = document.createElement('div');
    card.className = 'bubble-editor-card';
    card.setAttribute('data-id', bubble.bubble_id);

    const header = document.createElement('div');
    header.className = 'card-header';
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    
    const idLabel = document.createElement('span');
    idLabel.className = 'bubble-id-label';
    idLabel.textContent = `บอลลูน #${bubble.bubble_id}`;
    header.appendChild(idLabel);
    
    // Show/Hide toggle button
    const hideBtn = document.createElement('button');
    hideBtn.className = 'hide-bubble-btn';
    hideBtn.textContent = bubble.hidden ? '🙈' : '👁️';
    hideBtn.title = bubble.hidden ? 'แสดงข้อความ' : 'ซ่อนข้อความ';
    hideBtn.style.background = 'none';
    hideBtn.style.border = 'none';
    hideBtn.style.color = bubble.hidden ? '#ef4444' : '#10b981';
    hideBtn.style.cursor = 'pointer';
    hideBtn.style.fontSize = '14px';
    hideBtn.style.padding = '0';
    hideBtn.style.marginLeft = 'auto';
    
    hideBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      bubble.hidden = !bubble.hidden;
      saveCurrentPageTranslation();
      renderPageTranslation();
      if (isPreviewMode) refreshTypesetView();
    });
    
    header.appendChild(hideBtn);

    const origText = document.createElement('div');
    origText.className = 'original-text-block';
    origText.textContent = bubble.original_text || '(ไม่มีอักษรตรวจพบ)';

    const transInput = document.createElement('textarea');
    transInput.className = 'translation-textarea';
    transInput.value = bubble.translated_text || '';
    
    // Auto-save on edit and update canvas preview in real-time
    transInput.addEventListener('input', (e) => {
      bubble.translated_text = e.target.value;
      saveCurrentPageTranslation();
      if (isPreviewMode) {
        refreshTypesetView();
      }
    });

    transInput.addEventListener('focus', () => {
      highlightOverlayRect(bubble.bubble_id);
      card.classList.add('active');
    });

    transInput.addEventListener('blur', () => {
      unhighlightOverlayRect(bubble.bubble_id);
      card.classList.remove('active');
    });

    // 1. Font Size Override controls row (Range Slider)
    const fontRow = document.createElement('div');
    fontRow.className = 'card-controls-row';
    fontRow.style.display = 'flex';
    fontRow.style.alignItems = 'center';
    fontRow.style.gap = '6px';
    fontRow.style.marginTop = '6px';
    
    const fontLabel = document.createElement('span');
    fontLabel.textContent = 'ขนาด:';
    fontLabel.style.fontSize = '12px';
    fontLabel.style.color = '#94a3b8';
    
    const sizeValLabel = document.createElement('span');
    sizeValLabel.style.fontSize = '11px';
    sizeValLabel.style.color = '#38bdf8';
    sizeValLabel.style.minWidth = '35px';
    sizeValLabel.textContent = bubble.font_size ? `${bubble.font_size}px` : 'ออโต้';
    
    const sizeSlider = document.createElement('input');
    sizeSlider.type = 'range';
    sizeSlider.min = '8';
    sizeSlider.max = '72';
    sizeSlider.value = bubble.font_size || '18';
    sizeSlider.style.flex = '1';
    sizeSlider.style.height = '4px';
    sizeSlider.style.cursor = 'pointer';
    if (!bubble.font_size) {
      sizeSlider.disabled = true;
      sizeSlider.style.opacity = '0.4';
    }
    
    const autoSizeLabel = document.createElement('label');
    autoSizeLabel.style.display = 'flex';
    autoSizeLabel.style.alignItems = 'center';
    autoSizeLabel.style.gap = '3px';
    autoSizeLabel.style.fontSize = '11px';
    autoSizeLabel.style.color = '#94a3b8';
    autoSizeLabel.style.cursor = 'pointer';
    
    const autoSizeCheck = document.createElement('input');
    autoSizeCheck.type = 'checkbox';
    autoSizeCheck.checked = !bubble.font_size;
    autoSizeCheck.style.cursor = 'pointer';
    
    autoSizeCheck.addEventListener('change', (e) => {
      if (e.target.checked) {
        delete bubble.font_size;
        sizeSlider.disabled = true;
        sizeSlider.style.opacity = '0.4';
        sizeValLabel.textContent = 'ออโต้';
      } else {
        bubble.font_size = 18;
        sizeSlider.disabled = false;
        sizeSlider.style.opacity = '1.0';
        sizeSlider.value = '18';
        sizeValLabel.textContent = '18px';
      }
      saveCurrentPageTranslation();
      if (isPreviewMode) refreshTypesetView();
    });
    
    sizeSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      bubble.font_size = val;
      sizeValLabel.textContent = `${val}px`;
      saveCurrentPageTranslation();
      if (isPreviewMode) renderTypesetImage();
    });
    
    autoSizeLabel.appendChild(autoSizeCheck);
    autoSizeLabel.appendChild(document.createTextNode('ออโต้'));
    
    fontRow.appendChild(fontLabel);
    fontRow.appendChild(sizeSlider);
    fontRow.appendChild(sizeValLabel);
    fontRow.appendChild(autoSizeLabel);

    // 2. Text Color Swatches & Recent Colors row
    const colorRow = document.createElement('div');
    colorRow.className = 'card-controls-row';
    colorRow.style.display = 'flex';
    colorRow.style.alignItems = 'center';
    colorRow.style.gap = '6px';
    colorRow.style.marginTop = '6px';
    
    const colorLabel = document.createElement('span');
    colorLabel.textContent = 'สีอักษร:';
    colorLabel.style.fontSize = '12px';
    colorLabel.style.color = '#94a3b8';
    
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = bubble.text_color || '#000000';
    colorInput.style.width = '24px';
    colorInput.style.height = '20px';
    colorInput.style.padding = '0';
    colorInput.style.border = '1px solid #475569';
    colorInput.style.background = 'none';
    colorInput.style.borderRadius = '3px';
    colorInput.style.cursor = 'pointer';
    if (!bubble.text_color) {
      colorInput.style.opacity = '0.3';
    }
    
    const autoColorLabel = document.createElement('label');
    autoColorLabel.style.display = 'flex';
    autoColorLabel.style.alignItems = 'center';
    autoColorLabel.style.gap = '3px';
    autoColorLabel.style.fontSize = '11px';
    autoColorLabel.style.color = '#94a3b8';
    autoColorLabel.style.cursor = 'pointer';
    
    const autoColorCheck = document.createElement('input');
    autoColorCheck.type = 'checkbox';
    autoColorCheck.checked = !bubble.text_color;
    autoColorCheck.style.cursor = 'pointer';
    
    const recentColorsContainer = document.createElement('div');
    recentColorsContainer.style.display = 'flex';
    recentColorsContainer.style.gap = '4px';
    recentColorsContainer.style.marginLeft = '6px';
    
    function renderRecentSwatches() {
      recentColorsContainer.innerHTML = '';
      recentColors.forEach(color => {
        const swatch = document.createElement('div');
        swatch.style.width = '14px';
        swatch.style.height = '14px';
        swatch.style.borderRadius = '50%';
        swatch.style.background = color;
        swatch.style.border = '1px solid #475569';
        swatch.style.cursor = 'pointer';
        swatch.title = color;
        
        swatch.addEventListener('click', () => {
          bubble.text_color = color;
          autoColorCheck.checked = false;
          colorInput.style.opacity = '1.0';
          colorInput.value = color;
          saveCurrentPageTranslation();
          if (isPreviewMode) refreshTypesetView();
          renderRecentSwatches();
        });
        recentColorsContainer.appendChild(swatch);
      });
    }
    
    autoColorCheck.addEventListener('change', (e) => {
      if (e.target.checked) {
        delete bubble.text_color;
        colorInput.style.opacity = '0.3';
      } else {
        bubble.text_color = colorInput.value;
        colorInput.style.opacity = '1.0';
      }
      saveCurrentPageTranslation();
      if (isPreviewMode) refreshTypesetView();
    });
    
    colorInput.addEventListener('input', (e) => {
      const val = e.target.value;
      bubble.text_color = val;
      autoColorCheck.checked = false;
      colorInput.style.opacity = '1.0';
      
      if (!recentColors.includes(val)) {
        recentColors.unshift(val);
        if (recentColors.length > 8) {
          recentColors.pop();
        }
      }
      
      saveCurrentPageTranslation();
      if (isPreviewMode) refreshTypesetView();
      renderRecentSwatches();
    });
    
    // Text outline toggle checkbox
    const outlineLabel = document.createElement('label');
    outlineLabel.style.display = 'flex';
    outlineLabel.style.alignItems = 'center';
    outlineLabel.style.gap = '3px';
    outlineLabel.style.fontSize = '11px';
    outlineLabel.style.color = '#94a3b8';
    outlineLabel.style.cursor = 'pointer';
    outlineLabel.style.marginLeft = '12px';
    
    const outlineCheck = document.createElement('input');
    outlineCheck.type = 'checkbox';
    outlineCheck.checked = !!bubble.outline;
    outlineCheck.style.cursor = 'pointer';
    
    outlineCheck.addEventListener('change', (e) => {
      bubble.outline = e.target.checked;
      saveCurrentPageTranslation();
      if (isPreviewMode) refreshTypesetView();
    });
    
    outlineLabel.appendChild(outlineCheck);
    outlineLabel.appendChild(document.createTextNode('ขอบอักษร'));

    autoColorLabel.appendChild(autoColorCheck);
    autoColorLabel.appendChild(document.createTextNode('ออโต้'));
    
    colorRow.appendChild(colorLabel);
    colorRow.appendChild(colorInput);
    colorRow.appendChild(autoColorLabel);
    colorRow.appendChild(recentColorsContainer);
    colorRow.appendChild(outlineLabel);
    
    renderRecentSwatches();

    card.appendChild(header);
    card.appendChild(origText);
    card.appendChild(transInput);
    card.appendChild(fontRow);
    card.appendChild(colorRow);

    bubblesList.appendChild(card);
  });
}

function updateSVGOverlayOnly() {
  activePageTranslation.forEach((bubble) => {
    const rect = bubbleOverlay.querySelector(`.bubble-rect[data-id="${bubble.bubble_id}"]`);
    if (rect && bubble.box_2d) {
      const [ymin, xmin, ymax, xmax] = bubble.box_2d;
      rect.setAttribute('x', xmin);
      rect.setAttribute('y', ymin);
      rect.setAttribute('width', xmax - xmin);
      rect.setAttribute('height', ymax - ymin);
    }
    const handle = bubbleOverlay.querySelector(`.bubble-resize-handle[data-id="${bubble.bubble_id}"]`);
    if (handle && bubble.box_2d) {
      const [ymin, xmin, ymax, xmax] = bubble.box_2d;
      handle.setAttribute('cx', xmax);
      handle.setAttribute('cy', ymax);
    }
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
    
    // Invalidate cache since new translation might contain different bounding boxes/masks
    delete cleanedBgCache[activePage.name];
    
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
      
      // Invalidate cache for this page
      delete cleanedBgCache[img.name];
      
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
    initBgSampler();
    renderTypesetTextLayer();
    return;
  }
  if (isPreviewMode && activePageTranslation.length > 0) {
    renderTypesetImage();
  }
});

let bgSamplerCanvas = null;

function initBgSampler() {
  bgSamplerCanvas = document.createElement('canvas');
  bgSamplerCanvas.width = activeImage.naturalWidth || 800;
  bgSamplerCanvas.height = activeImage.naturalHeight || 1200;
  const ctx = bgSamplerCanvas.getContext('2d');
  ctx.drawImage(activeImage, 0, 0);
}

function sampleImageBackgroundAt(x, y, w, h) {
  if (!bgSamplerCanvas) return '#ffffff';
  const ctx = bgSamplerCanvas.getContext('2d');
  return sampleBubbleBackground(ctx, x, y, w, h);
}

async function renderTypesetImage() {
  canvasLoader.style.display = 'flex';
  const originalSrc = activeImage.src;
  const canvas = document.createElement('canvas');
  canvas.width = activeImage.naturalWidth;
  canvas.height = activeImage.naturalHeight;
  
  let cleanedImgElement = activeImage;
  let objectUrlToCleanup = null;
  const activePage = images[activeIndex];
  const cacheKey = activePage ? activePage.name : null;
  
  if (cacheKey && cleanedBgCache[cacheKey]) {
    // Cache HIT: Load clean background instantly
    const cleanImg = new Image();
    cleanImg.src = cleanedBgCache[cacheKey];
    await new Promise((resolve) => {
      cleanImg.onload = resolve;
      cleanImg.onerror = resolve;
    });
    cleanedImgElement = cleanImg;
  } else {
    // Cache MISS: Run PyTorch AI Inpainter and store in cache
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
      
      // Store clean base64 image in memory cache
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tctx = tempCanvas.getContext('2d');
      tctx.drawImage(cleanedImgElement, 0, 0);
      if (cacheKey) {
        cleanedBgCache[cacheKey] = tempCanvas.toDataURL('image/jpeg', 0.95);
      }
    } catch (err) {
      console.warn('[⚠️] AI Inpainting failed or offline. Falling back to smooth flat color erase. Error:', err.message);
    }
  }
  
  // Handle smooth flat color erase fallback if clean background load failed
  if (cleanedImgElement === activeImage) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tctx = tempCanvas.getContext('2d');
    tctx.drawImage(activeImage, 0, 0);
    
    activePageTranslation.forEach((bubble) => {
      if (!bubble.box_2d || bubble.box_2d.length !== 4) return;
      const [ymin, xmin, ymax, xmax] = bubble.box_2d;
      const x1 = (xmin / 1000) * canvas.width;
      const y1 = (ymin / 1000) * canvas.height;
      const x2 = (xmax / 1000) * canvas.width;
      const y2 = (ymax / 1000) * canvas.height;
      const w = x2 - x1;
      const h = y2 - y1;
      
      const bgColor = sampleBubbleBackground(tctx, x1, y1, w, h);
      drawSmoothErase(tctx, x1, y1, w, h, bgColor);
    });
    activeImage.src = tempCanvas.toDataURL('image/jpeg', 0.95);
  } else {
    // Prefer loading from base64 cached background string
    if (cacheKey && cleanedBgCache[cacheKey]) {
      activeImage.src = cleanedBgCache[cacheKey];
    } else {
      activeImage.src = cleanedImgElement.src;
    }
  }
  
  if (objectUrlToCleanup) {
    // Defer revoking to allow browser to load the stream safely
    setTimeout(() => {
      try {
        URL.revokeObjectURL(objectUrlToCleanup);
      } catch (err) {}
    }, 1000);
  }
  
  canvasLoader.style.display = 'none';
}

function renderTypesetTextLayer() {
  const canvas = document.getElementById('typesetTextCanvas');
  if (!canvas) return;
  canvas.width = activeImage.naturalWidth || 800;
  canvas.height = activeImage.naturalHeight || 1200;
  
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  if (activePageTranslation.length === 0) return;
  
  activePageTranslation.forEach((bubble) => {
    if (bubble.hidden) return;
    if (!bubble.box_2d || bubble.box_2d.length !== 4) return;
    
    const [ymin, xmin, ymax, xmax] = bubble.box_2d;
    const x1 = (xmin / 1000) * canvas.width;
    const y1 = (ymin / 1000) * canvas.height;
    const x2 = (xmax / 1000) * canvas.width;
    const y2 = (ymax / 1000) * canvas.height;
    const w = x2 - x1;
    const h = y2 - y1;
    
    const bgColor = sampleImageBackgroundAt(x1, y1, w, h);
    
    if (bubble.translated_text) {
      drawTypesetText(ctx, bubble.translated_text, x1, y1, w, h, bgColor, bubble.font_size, bubble.text_color, bubble.outline);
    }
  });
}

function refreshTypesetView() {
  if (activeImage.src.startsWith('data:')) {
    renderTypesetTextLayer();
  } else {
    renderTypesetImage();
  }
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

function drawTypesetText(ctx, text, x, y, w, h, bgColor = '#ffffff', overrideFontSize = null, overrideTextColor = null, overrideOutline = false) {
  // Check contrast of background to choose black or white text
  let textColor = overrideTextColor || '#000000';
  if (!overrideTextColor && bgColor.startsWith('#')) {
    const r = parseInt(bgColor.slice(1, 3), 16) || 0;
    const g = parseInt(bgColor.slice(3, 5), 16) || 0;
    const b = parseInt(bgColor.slice(5, 7), 16) || 0;
    const luminance = r * 0.299 + g * 0.587 + b * 0.114;
    if (luminance < 130) textColor = '#ffffff';
  }

  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  let fontSize;
  let lines = [];
  
  if (overrideFontSize) {
    fontSize = overrideFontSize;
    ctx.font = `bold ${fontSize}px 'Sarabun', 'Segoe UI', sans-serif`;
    lines = wrapThaiText(ctx, text, w * 0.85);
  } else {
    fontSize = Math.max(14, Math.round(h * 0.18));
    if (fontSize > 40) fontSize = 40;
    
    while (fontSize >= 6) {
      ctx.font = `bold ${fontSize}px 'Sarabun', 'Segoe UI', sans-serif`;
      lines = wrapThaiText(ctx, text, w * 0.85);
      const totalHeight = lines.length * (fontSize * 1.25);
      if (totalHeight <= h * 0.85) {
        break;
      }
      fontSize -= 1;
    }
  }
  
  const lineHeight = fontSize * 1.25;
  const startY = y + (h / 2) - ((lines.length - 1) * lineHeight / 2);
  
  // Calculate high-contrast outline color if outline is checked
  let outlineColor = '#ffffff';
  if (overrideOutline) {
    if (textColor.startsWith('#')) {
      const r = parseInt(textColor.slice(1, 3), 16) || 0;
      const g = parseInt(textColor.slice(3, 5), 16) || 0;
      const b = parseInt(textColor.slice(5, 7), 16) || 0;
      const luminance = r * 0.299 + g * 0.587 + b * 0.114;
      if (luminance > 150) outlineColor = '#000000';
    } else {
      if (textColor === 'white' || textColor === '#ffffff') outlineColor = '#000000';
    }
  }
  
  lines.forEach((line, idx) => {
    const lineX = x + (w / 2);
    const lineY = startY + (idx * lineHeight);
    
    if (overrideOutline) {
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = Math.max(3, Math.round(fontSize * 0.2));
      ctx.lineJoin = 'round';
      ctx.strokeText(line, lineX, lineY);
    }
    
    ctx.fillText(line, lineX, lineY);
  });
}

function wrapThaiText(ctx, text, maxWidth) {
  // Use built-in Intl.Segmenter for grammatically correct Thai word breaking
  const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
  const segments = Array.from(segmenter.segment(text)).map(s => s.segment);
  
  let lines = [];
  let currentLine = '';
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const testLine = currentLine + segment;
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth && i > 0) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = segment;
      } else {
        // If a single word segment exceeds maxWidth, split by grapheme clusters (never break combining characters)
        const graphemeSegmenter = new Intl.Segmenter('th', { granularity: 'grapheme' });
        const graphemes = Array.from(graphemeSegmenter.segment(segment)).map(g => g.segment);
        
        for (const grapheme of graphemes) {
          const testGraphemeLine = currentLine + grapheme;
          if (ctx.measureText(testGraphemeLine).width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = grapheme;
          } else {
            currentLine = testGraphemeLine;
          }
        }
      }
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
    
    // Pad mask slightly to capture overflow text near borders
    const padX = Math.max(8, w * 0.04);
    const padY = Math.max(12, h * 0.08);
    const mx1 = x1 - padX;
    const my1 = y1 - padY;
    const mw = w + padX * 2;
    const mh = h + padY * 2;
    
    mctx.fillStyle = '#ffffff';
    mctx.beginPath();
    mctx.roundRect(mx1, my1, mw, mh, Math.min(mw, mh) * 0.2);
    mctx.fill();
  });
  
  // Combine manual brush strokes overlay
  const brushMaskCanvas = document.getElementById('brushMaskCanvas');
  if (brushMaskCanvas) {
    mctx.drawImage(brushMaskCanvas, 0, 0);
  }
  
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
      
      // Load and draw custom paint layer for export
      try {
        const paintRes = await window.api.loadCustomPaint({
          project: currentProject,
          chapter: currentChapter,
          pageName: imgObj.name
        });
        if (paintRes && paintRes.exists) {
          const paintImg = new Image();
          const formattedPath = paintRes.absolutePath.replace(/\\/g, '/');
          paintImg.src = `file:///${formattedPath}`;
          await new Promise((resolve) => {
            paintImg.onload = resolve;
            paintImg.onerror = resolve;
          });
          ctx.drawImage(paintImg, 0, 0);
        }
      } catch (err) {
        console.warn('[⚠️] Failed to load custom paint for export:', err);
      }
      
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
            
          if (bubble.translated_text && !bubble.hidden) {
            drawTypesetText(ctx, bubble.translated_text, x1, y1, w, h, bgColorForContrast, bubble.font_size, bubble.text_color, bubble.outline);
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

// ==========================================================
// Phase 3: Typesetting Studio Interactive Tools Implementation
// ==========================================================

let currentTool = 'select'; // 'select', 'add', 'brush', 'paint'
let isDragging = false;
let isResizing = false;
let isCreating = false;
let isPainting = false;
let isColorPainting = false;
let activeBubbleId = null;
let dragStartX = 0;
let dragStartY = 0;
let initialBox = null;

// Brush state
let brushSize = 20;
let lastBrushX = 0;
let lastBrushY = 0;

// Color Paint Brush state
let paintSize = 20;
let paintOpacity = 1.0;
let paintColor = '#ffffff';
let lastPaintX = 0;
let lastPaintY = 0;

// Grab DOM elements
const studioToolbar = document.getElementById('studioToolbar');
const toolSelectBtn = document.getElementById('toolSelectBtn');
const toolAddBtn = document.getElementById('toolAddBtn');
const toolBrushBtn = document.getElementById('toolBrushBtn');
const toolPaintBtn = document.getElementById('toolPaintBtn');

const brushOptions = document.getElementById('brushOptions');
const brushSizeRange = document.getElementById('brushSizeRange');
const brushSizeVal = document.getElementById('brushSizeVal');
const clearBrushBtn = document.getElementById('clearBrushBtn');
const brushMaskCanvas = document.getElementById('brushMaskCanvas');

const paintOptions = document.getElementById('paintOptions');
const paintColorInput = document.getElementById('paintColorInput');
const paintOpacityRange = document.getElementById('paintOpacityRange');
const paintOpacityVal = document.getElementById('paintOpacityVal');
const paintSizeRange = document.getElementById('paintSizeRange');
const paintSizeVal = document.getElementById('paintSizeVal');
const clearPaintBtn = document.getElementById('clearPaintBtn');
const colorPaintCanvas = document.getElementById('colorPaintCanvas');

// 1. Tool Switcher
function switchTool(tool) {
  currentTool = tool;
  
  // Highlight active buttons
  toolSelectBtn.className = (tool === 'select') ? 'btn btn-tool active' : 'btn btn-tool';
  toolAddBtn.className = (tool === 'add') ? 'btn btn-tool active' : 'btn btn-tool';
  toolBrushBtn.className = (tool === 'brush') ? 'btn btn-tool active' : 'btn btn-tool';
  toolPaintBtn.className = (tool === 'paint') ? 'btn btn-tool active' : 'btn btn-tool';
  
  // Apply styled color overrides to btn-tool dynamically
  const btns = [toolSelectBtn, toolAddBtn, toolBrushBtn, toolPaintBtn];
  btns.forEach(btn => {
    if (btn.className.includes('active')) {
      btn.style.background = '#3b82f6';
      btn.style.color = '#ffffff';
      btn.style.borderColor = '#3b82f6';
    } else {
      btn.style.background = '#1e293b';
      btn.style.color = '#94a3b8';
      btn.style.borderColor = '#334155';
    }
  });
  
  // Toggle Options & pointer events
  brushOptions.style.display = (tool === 'brush') ? 'flex' : 'none';
  paintOptions.style.display = (tool === 'paint') ? 'flex' : 'none';
  
  // Always display colorPaintCanvas so the user can see their background colors
  colorPaintCanvas.style.display = 'block';
  
  if (tool === 'brush') {
    brushMaskCanvas.style.display = 'block';
    brushMaskCanvas.style.pointerEvents = 'auto';
    colorPaintCanvas.style.pointerEvents = 'none';
    bubbleOverlay.style.pointerEvents = 'none';
  } else if (tool === 'paint') {
    brushMaskCanvas.style.display = 'none';
    brushMaskCanvas.style.pointerEvents = 'none';
    colorPaintCanvas.style.pointerEvents = 'auto';
    bubbleOverlay.style.pointerEvents = 'none';
  } else {
    brushMaskCanvas.style.display = 'none';
    brushMaskCanvas.style.pointerEvents = 'none';
    colorPaintCanvas.style.pointerEvents = 'none';
    bubbleOverlay.style.pointerEvents = 'auto';
  }
}

toolSelectBtn.addEventListener('click', () => switchTool('select'));
toolAddBtn.addEventListener('click', () => switchTool('add'));
toolBrushBtn.addEventListener('click', () => switchTool('brush'));
toolPaintBtn.addEventListener('click', () => switchTool('paint'));

brushSizeRange.addEventListener('input', (e) => {
  brushSize = parseInt(e.target.value);
  brushSizeVal.textContent = brushSize;
});

paintSizeRange.addEventListener('input', (e) => {
  paintSize = parseInt(e.target.value);
  paintSizeVal.textContent = paintSize;
});

paintOpacityRange.addEventListener('input', (e) => {
  paintOpacity = parseFloat(e.target.value) / 100;
  paintOpacityVal.textContent = paintOpacity.toFixed(1);
});

paintColorInput.addEventListener('input', (e) => {
  paintColor = e.target.value;
});

const paintShapeSelect = document.getElementById('paintShapeSelect');
let paintShape = 'brush';
let paintSnapshot = null;

paintShapeSelect.addEventListener('change', (e) => {
  paintShape = e.target.value;
});

// Clear custom mask
clearBrushBtn.addEventListener('click', async () => {
  const activePage = images[activeIndex];
  if (!activePage) return;
  
  const ctx = brushMaskCanvas.getContext('2d');
  ctx.clearRect(0, 0, brushMaskCanvas.width, brushMaskCanvas.height);
  
  try {
    await window.api.clearCustomMask({
      project: currentProject,
      chapter: currentChapter,
      pageName: activePage.name
    });
  } catch (err) {
    console.warn('[⚠️] Failed to clear mask from disk:', err);
  }
  
  delete cleanedBgCache[activePage.name];
  if (isPreviewMode) renderTypesetImage();
});

// Clear custom paint background
clearPaintBtn.addEventListener('click', async () => {
  const activePage = images[activeIndex];
  if (!activePage) return;
  
  const ctx = colorPaintCanvas.getContext('2d');
  ctx.clearRect(0, 0, colorPaintCanvas.width, colorPaintCanvas.height);
  
  try {
    await window.api.clearCustomPaint({
      project: currentProject,
      chapter: currentChapter,
      pageName: activePage.name
    });
  } catch (err) {
    console.warn('[⚠️] Failed to clear paint from disk:', err);
  }
  
  delete cleanedBgCache[activePage.name];
  if (isPreviewMode) renderTypesetImage();
});

// 2. Coordinate normalizer
function getSVGCoords(e) {
  const rect = bubbleOverlay.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 1000;
  const y = ((e.clientY - rect.top) / rect.height) * 1000;
  return { x: Math.max(0, Math.min(1000, x)), y: Math.max(0, Math.min(1000, y)) };
}

// 3. Mouse Event Listeners for Select/Add Bubble modes
bubbleOverlay.addEventListener('mousedown', (e) => {
  if (currentTool === 'brush') return;
  
  const target = e.target;
  const activePage = images[activeIndex];
  if (!activePage) return;

  if (currentTool === 'add') {
    isCreating = true;
    const coords = getSVGCoords(e);
    dragStartX = coords.x;
    dragStartY = coords.y;
    
    let tempRect = document.getElementById('tempAddRect');
    if (!tempRect) {
      tempRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      tempRect.setAttribute('id', 'tempAddRect');
      tempRect.style.fill = 'rgba(168, 85, 247, 0.1)';
      tempRect.style.stroke = '#a855f7';
      tempRect.style.strokeWidth = '2px';
      tempRect.style.strokeDasharray = '4,4';
      bubbleOverlay.appendChild(tempRect);
    }
    tempRect.setAttribute('x', dragStartX);
    tempRect.setAttribute('y', dragStartY);
    tempRect.setAttribute('width', 0);
    tempRect.setAttribute('height', 0);
    tempRect.style.display = 'block';
    return;
  }
  
  if (target.classList.contains('bubble-resize-handle')) {
    isResizing = true;
    activeBubbleId = parseInt(target.getAttribute('data-id'));
    const bubble = activePageTranslation.find(b => b.bubble_id === activeBubbleId);
    if (bubble) {
      initialBox = [...bubble.box_2d];
      const coords = getSVGCoords(e);
      dragStartX = coords.x;
      dragStartY = coords.y;
    }
    e.stopPropagation();
  } else if (target.classList.contains('bubble-rect')) {
    isDragging = true;
    activeBubbleId = parseInt(target.getAttribute('data-id'));
    const bubble = activePageTranslation.find(b => b.bubble_id === activeBubbleId);
    if (bubble) {
      initialBox = [...bubble.box_2d];
      const coords = getSVGCoords(e);
      dragStartX = coords.x;
      dragStartY = coords.y;
    }
    e.stopPropagation();
  }
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging && !isResizing && !isCreating) return;
  
  const coords = getSVGCoords(e);
  
  if (isCreating) {
    const tempRect = document.getElementById('tempAddRect');
    if (tempRect) {
      const x = Math.min(dragStartX, coords.x);
      const y = Math.min(dragStartY, coords.y);
      const w = Math.abs(coords.x - dragStartX);
      const h = Math.abs(coords.y - dragStartY);
      tempRect.setAttribute('x', x);
      tempRect.setAttribute('y', y);
      tempRect.setAttribute('width', w);
      tempRect.setAttribute('height', h);
    }
    return;
  }
  
  const dx = coords.x - dragStartX;
  const dy = coords.y - dragStartY;
  
  const bubble = activePageTranslation.find(b => b.bubble_id === activeBubbleId);
  if (!bubble || !initialBox) return;
  
  if (isDragging) {
    const [ymin, xmin, ymax, xmax] = initialBox;
    const w = xmax - xmin;
    const h = ymax - ymin;
    
    const newX = Math.max(0, Math.min(1000 - w, xmin + dx));
    const newY = Math.max(0, Math.min(1000 - h, ymin + dy));
    
    bubble.box_2d = [
      Math.round(newY),
      Math.round(newX),
      Math.round(newY + h),
      Math.round(newX + w)
    ];
    
    updateSVGOverlayOnly();
    if (isPreviewMode) refreshTypesetView();
  } else if (isResizing) {
    const [ymin, xmin, ymax, xmax] = initialBox;
    const newXmax = Math.max(xmin + 20, Math.min(1000, xmax + dx));
    const newYmax = Math.max(ymin + 20, Math.min(1000, ymax + dy));
    
    bubble.box_2d[2] = Math.round(newYmax);
    bubble.box_2d[3] = Math.round(newXmax);
    
    updateSVGOverlayOnly();
    if (isPreviewMode) refreshTypesetView();
  }
});

window.addEventListener('mouseup', async () => {
  if (!isDragging && !isResizing && !isCreating) return;
  
  const activePage = images[activeIndex];
  if (!activePage) return;
  
  if (isCreating) {
    isCreating = false;
    const tempRect = document.getElementById('tempAddRect');
    if (tempRect) {
      tempRect.style.display = 'none';
      const x = parseFloat(tempRect.getAttribute('x'));
      const y = parseFloat(tempRect.getAttribute('y'));
      const w = parseFloat(tempRect.getAttribute('width'));
      const h = parseFloat(tempRect.getAttribute('height'));
      
      if (w > 15 && h > 15) {
        const ymin = Math.round(y);
        const xmin = Math.round(x);
        const ymax = Math.round(y + h);
        const xmax = Math.round(x + w);
        
        const newId = activePageTranslation.length > 0
          ? Math.max(...activePageTranslation.map(b => b.bubble_id)) + 1
          : 1;
          
        activePageTranslation.push({
          bubble_id: newId,
          box_2d: [ymin, xmin, ymax, xmax],
          original_text: '(สร้างกล่องแมนนวล)',
          translated_text: 'กรอกคำแปลบทสนทนาใหม่ตรงนี้'
        });
        
        delete cleanedBgCache[activePage.name];
        await saveCurrentPageTranslation();
        renderPageTranslation();
        if (isPreviewMode) refreshTypesetView();
        
        setTimeout(() => {
          focusCard(newId);
        }, 100);
      }
    }
    return;
  }
  
  isDragging = false;
  isResizing = false;
  activeBubbleId = null;
  initialBox = null;
  
  delete cleanedBgCache[activePage.name];
  await saveCurrentPageTranslation();
  renderPageTranslation();
  if (isPreviewMode) refreshTypesetView();
});

// 4. Brush drawing event listeners on brushMaskCanvas
function getCanvasCoords(e) {
  const rect = brushMaskCanvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * brushMaskCanvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * brushMaskCanvas.height;
  return { x, y };
}

brushMaskCanvas.addEventListener('mousedown', (e) => {
  if (currentTool !== 'brush') return;
  isPainting = true;
  const coords = getCanvasCoords(e);
  lastBrushX = coords.x;
  lastBrushY = coords.y;
  
  drawBrushStroke(coords.x, coords.y);
});

brushMaskCanvas.addEventListener('mousemove', (e) => {
  if (currentTool !== 'brush' || !isPainting) return;
  const coords = getCanvasCoords(e);
  drawBrushStroke(coords.x, coords.y, true);
});

window.addEventListener('mouseup', async () => {
  if (isPainting) {
    isPainting = false;
    
    const activePage = images[activeIndex];
    if (activePage) {
      const dataUrl = brushMaskCanvas.toDataURL('image/png');
      try {
        await window.api.saveCustomMask({
          project: currentProject,
          chapter: currentChapter,
          pageName: activePage.name,
          dataUrl: dataUrl
        });
      } catch (err) {
        console.warn('[⚠️] Failed to save custom mask:', err);
      }
      
      delete cleanedBgCache[activePage.name];
      if (isPreviewMode) renderTypesetImage();
    }
  }
});

function drawBrushStroke(x, y, isMove = false) {
  const ctx = brushMaskCanvas.getContext('2d');
  ctx.strokeStyle = '#ffffff';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = brushSize;
  
  ctx.beginPath();
  if (isMove) {
    ctx.moveTo(lastBrushX, lastBrushY);
    ctx.lineTo(x, y);
    ctx.stroke();
  } else {
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
  
  lastBrushX = x;
  lastBrushY = y;
}

// 5. Color Paint drawing event listeners on colorPaintCanvas
function getColorCanvasCoords(e) {
  const rect = colorPaintCanvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * colorPaintCanvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * colorPaintCanvas.height;
  return { x, y };
}

colorPaintCanvas.addEventListener('mousedown', (e) => {
  if (currentTool !== 'paint') return;
  isColorPainting = true;
  const coords = getColorCanvasCoords(e);
  lastPaintX = coords.x;
  lastPaintY = coords.y;
  
  const ctx = colorPaintCanvas.getContext('2d');
  // Capture canvas snapshot for non-trail preview drawing
  paintSnapshot = ctx.getImageData(0, 0, colorPaintCanvas.width, colorPaintCanvas.height);
  
  if (paintShape === 'brush') {
    drawColorPaintStroke(coords.x, coords.y);
  }
});

colorPaintCanvas.addEventListener('mousemove', (e) => {
  if (currentTool !== 'paint' || !isColorPainting) return;
  const coords = getColorCanvasCoords(e);
  
  if (paintShape === 'brush') {
    drawColorPaintStroke(coords.x, coords.y, true);
  } else {
    drawColorShapePreview(coords.x, coords.y);
  }
});

window.addEventListener('mouseup', async () => {
  if (isColorPainting) {
    isColorPainting = false;
    paintSnapshot = null;
    
    const activePage = images[activeIndex];
    if (activePage) {
      const dataUrl = colorPaintCanvas.toDataURL('image/png');
      try {
        await window.api.saveCustomPaint({
          project: currentProject,
          chapter: currentChapter,
          pageName: activePage.name,
          dataUrl: dataUrl
        });
      } catch (err) {
        console.warn('[⚠️] Failed to save custom paint layer:', err);
      }
      
      delete cleanedBgCache[activePage.name];
      if (isPreviewMode) refreshTypesetView();
    }
  }
});

function drawColorShapePreview(x, y) {
  const ctx = colorPaintCanvas.getContext('2d');
  if (paintSnapshot) {
    ctx.putImageData(paintSnapshot, 0, 0);
  }
  
  ctx.fillStyle = paintColor;
  ctx.strokeStyle = paintColor;
  ctx.lineWidth = paintSize;
  ctx.globalAlpha = paintOpacity;
  
  const startX = lastPaintX;
  const startY = lastPaintY;
  
  const x1 = Math.min(startX, x);
  const y1 = Math.min(startY, y);
  const w = Math.abs(x - startX);
  const h = Math.abs(y - startY);
  
  ctx.beginPath();
  if (paintShape === 'rect') {
    ctx.fillRect(x1, y1, w, h);
  } else if (paintShape === 'oval') {
    const cx = startX + (x - startX) / 2;
    const cy = startY + (y - startY) / 2;
    const rx = Math.abs(x - startX) / 2;
    const ry = Math.abs(y - startY) / 2;
    ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;
}

function drawColorPaintStroke(x, y, isMove = false) {
  const ctx = colorPaintCanvas.getContext('2d');
  ctx.strokeStyle = paintColor;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = paintSize;
  ctx.globalAlpha = paintOpacity;
  
  ctx.beginPath();
  if (isMove) {
    ctx.moveTo(lastPaintX, lastPaintY);
    ctx.lineTo(x, y);
    ctx.stroke();
  } else {
    ctx.arc(x, y, paintSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = paintColor;
    ctx.fill();
  }
  
  ctx.globalAlpha = 1.0;
  
  lastPaintX = x;
  lastPaintY = y;
}
