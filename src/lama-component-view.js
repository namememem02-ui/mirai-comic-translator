function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderHeaderLamaBadge(componentState = {}) {
  const st = componentState?.state || 'unavailable';
  if (st === 'ready-gpu' || st === 'ready-nvidia') {
    return { class: 'badge-ready-gpu', label: 'AI รีทัช · GPU' };
  }
  if (st === 'ready-cpu') {
    return { class: 'badge-ready-cpu', label: 'AI รีทัช · CPU' };
  }
  if (st === 'gpu-fallback') {
    return { class: 'badge-fallback', label: 'กำลังเปลี่ยน GPU → CPU' };
  }
  return { class: 'badge-unavailable', label: 'AI รีทัชไม่พร้อม' };
}

function renderLamaComponentSection(stateData = {}) {
  const st = stateData?.state || 'not-installed';
  const backend = stateData?.backend || 'cpu';
  const version = stateData?.installedVersion || 'ยังไม่ได้ติดตั้ง';
  const hardware = stateData?.hardware || {};
  const prefs = stateData?.preferences || { mode: 'auto', fallback: 'automatic' };
  const progress = stateData?.progress || null;
  const fallbackNotice = stateData?.fallbackNotice || null;

  const nvidiaInfo = hardware.nvidiaName
    ? escapeHtml(hardware.nvidiaName)
    : hardware.nvidiaAvailable
    ? 'รองรับ NVIDIA CUDA'
    : 'ไม่พบการ์ดจอ NVIDIA ที่รองรับ';

  const isDownloading = st === 'downloading' || st === 'installing';
  const isInstalled = st === 'ready-cpu' || st === 'ready-nvidia' || st === 'ready-gpu' || st === 'update-available';

  let progressHtml = '';
  if (progress && isDownloading) {
    const pct = Math.min(100, Math.max(0, Number(progress.percent) || 0));
    progressHtml = `
      <div class="lama-progress-container" aria-label="ความคืบหน้าการดาวน์โหลด">
        <div class="lama-progress-label">กำลังดาวน์โหลด Component: ${escapeHtml(progress.text || `${pct}%`)}</div>
        <div class="lama-progress-track">
          <div class="lama-progress-bar" style="width: ${pct}%;"></div>
        </div>
      </div>
    `;
  }

  let noticeHtml = '';
  if (fallbackNotice) {
    noticeHtml = `
      <div class="lama-fallback-notice" role="alert">
        <span class="notice-icon">⚠️</span>
        <span class="notice-text">${escapeHtml(fallbackNotice)}</span>
      </div>
    `;
  }

  let buttonsHtml = '';
  if (isDownloading) {
    buttonsHtml = `<button class="btn btn-secondary" data-action="cancel">ยกเลิก</button>`;
  } else {
    buttonsHtml = `
      <button class="btn btn-primary" data-action="install" ${isInstalled ? 'disabled' : ''}>ติดตั้ง AI รีทัช</button>
      <button class="btn btn-secondary" data-action="repair" ${!isInstalled ? 'disabled' : ''}>ซ่อมแซม (Repair)</button>
      <button class="btn btn-danger" data-action="remove" ${!isInstalled ? 'disabled' : ''}>ลบออก (Remove)</button>
    `;
  }

  return `
    <div class="lama-component-card">
      <div class="card-header">
        <h3>AI รีทัช (LaMa Component)</h3>
        <span class="lama-version-tag">เวอร์ชัน: ${escapeHtml(version)}</span>
      </div>

      ${noticeHtml}

      <div class="hardware-summary">
        <div class="hw-item">
          <span class="hw-label">การ์ดจอ (NVIDIA):</span>
          <span class="hw-value">${nvidiaInfo}</span>
        </div>
        <div class="hw-item">
          <span class="hw-label">หน่วยประมวลผลหลัก (CPU):</span>
          <span class="hw-value">พร้อมใช้งาน</span>
        </div>
      </div>

      <div class="lama-preferences-grid">
        <div class="pref-field">
          <label for="lama-pref-mode">โหมดการประมวลผลที่ต้องการ:</label>
          <select id="lama-pref-mode" class="input-select" data-pref="mode">
            <option value="auto" ${prefs.mode === 'auto' ? 'selected' : ''}>อัตโนมัติ (Auto) — แนะนำ</option>
            <option value="cpu" ${prefs.mode === 'cpu' ? 'selected' : ''}>ใช้ CPU เท่านั้น</option>
            <option value="nvidia" ${prefs.mode === 'nvidia' ? 'selected' : ''} ${!hardware.nvidiaAvailable ? 'disabled' : ''}>ใช้ NVIDIA GPU เท่านั้น</option>
          </select>
        </div>

        <div class="pref-field">
          <label for="lama-pref-fallback">นโยบายการสลับโหมดเมื่อ GPU มีปัญหา:</label>
          <select id="lama-pref-fallback" class="input-select" data-pref="fallback">
            <option value="automatic" ${prefs.fallback === 'automatic' ? 'selected' : ''}>สลับเป็น CPU อัตโนมัติ (Automatic)</option>
            <option value="ask" ${prefs.fallback === 'ask' ? 'selected' : ''}>ถามยืนยันก่อนสลับ (Ask)</option>
            <option value="never" ${prefs.fallback === 'never' ? 'selected' : ''}>ห้ามสลับ (Never)</option>
          </select>
        </div>
      </div>

      ${progressHtml}

      <div class="lama-actions-row">
        ${buttonsHtml}
      </div>
    </div>
  `;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderHeaderLamaBadge, renderLamaComponentSection, escapeHtml };
}
if (typeof window !== 'undefined') {
  window.LamaComponentView = { renderHeaderLamaBadge, renderLamaComponentSection, escapeHtml };
}
