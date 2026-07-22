const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { renderHeaderLamaBadge, renderLamaComponentSection } = require('../src/lama-component-view');

test('renderHeaderLamaBadge maps public states to badge tokens and Thai labels', () => {
  assert.deepEqual(renderHeaderLamaBadge({ state: 'ready-gpu' }), {
    class: 'badge-ready-gpu',
    label: 'AI รีทัช · GPU',
  });

  assert.deepEqual(renderHeaderLamaBadge({ state: 'ready-cpu' }), {
    class: 'badge-ready-cpu',
    label: 'AI รีทัช · CPU',
  });

  assert.deepEqual(renderHeaderLamaBadge({ state: 'gpu-fallback' }), {
    class: 'badge-fallback',
    label: 'กำลังเปลี่ยน GPU → CPU',
  });

  assert.deepEqual(renderHeaderLamaBadge({ state: 'unavailable' }), {
    class: 'badge-unavailable',
    label: 'AI รีทัชไม่พร้อม',
  });
});

test('renderLamaComponentSection generates structured HTML view with accessibility hooks', () => {
  const view = renderLamaComponentSection({
    state: 'ready-cpu',
    backend: 'cpu',
    installedVersion: '1.0.0',
    hardware: { nvidiaAvailable: true, nvidiaName: 'NVIDIA GeForce RTX 3060' },
    preferences: { mode: 'auto', fallback: 'automatic' },
    progress: null,
  });

  assert.ok(view.includes('AI รีทัช (LaMa Component)'));
  assert.ok(view.includes('NVIDIA GeForce RTX 3060'));
  assert.ok(view.includes('1.0.0'));
  assert.ok(view.includes('data-action="install"'));
  assert.ok(view.includes('data-action="repair"'));
  assert.ok(view.includes('data-action="remove"'));
});

test('renderLamaComponentSection includes progress elements during downloading', () => {
  const view = renderLamaComponentSection({
    state: 'downloading',
    backend: 'cpu',
    progress: { percent: 45, text: '45% (150 MB / 330 MB)' },
    preferences: { mode: 'auto', fallback: 'automatic' },
  });

  assert.ok(view.includes('progress-bar'));
  assert.ok(view.includes('45%'));
  assert.ok(view.includes('data-action="cancel"'));
});

test('renderLamaComponentSection displays notice on GPU fallback', () => {
  const view = renderLamaComponentSection({
    state: 'gpu-fallback',
    backend: 'cpu',
    sessionFallbackReason: 'cuda-out-of-memory',
    fallbackNotice: 'สลับมาใช้ CPU เนื่องจากหน่วยความจำการ์ดจอ (VRAM) ไม่เพียงพอ',
    preferences: { mode: 'auto', fallback: 'automatic' },
  });

  assert.ok(view.includes('fallback-notice'));
  assert.ok(view.includes('สลับมาใช้ CPU เนื่องจากหน่วยความจำการ์ดจอ'));
});
