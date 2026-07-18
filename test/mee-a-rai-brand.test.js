const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const modulePath = path.join(__dirname, '../src/mee-a-rai-brand.js');

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  toggle(value, force) {
    if (force === true) this.values.add(value);
    else if (force === false) this.values.delete(value);
    else if (this.values.has(value)) this.values.delete(value);
    else this.values.add(value);
    return this.values.has(value);
  }
  contains(value) { return this.values.has(value); }
}

class FakeTarget {
  constructor(name) {
    this.name = name;
    this.listeners = new Map();
  }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }
  dispatch(type, properties = {}) {
    const event = {
      type,
      target: this,
      pointerType: '',
      pointerId: 0,
      key: '',
      relatedTarget: null,
      defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() {},
      ...properties,
    };
    for (const listener of this.listeners.get(type) || []) listener(event);
    return event;
  }
}

class FakeElement extends FakeTarget {
  constructor(name) {
    super(name);
    this.classList = new FakeClassList();
    this.dataset = {};
    this.attributes = new Map();
    this.capturedPointers = new Set();
    this.children = new Set();
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name); }
  contains(target) { return target === this || this.children.has(target); }
  setPointerCapture(pointerId) { this.capturedPointers.add(pointerId); }
  hasPointerCapture(pointerId) { return this.capturedPointers.has(pointerId); }
  releasePointerCapture(pointerId) { this.capturedPointers.delete(pointerId); }
}

function loadApi() {
  assert.equal(fs.existsSync(modulePath), true, 'brand module must exist');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function createHarness() {
  const documentRoot = new FakeTarget('document');
  const brand = new FakeElement('brand');
  const trigger = new FakeElement('trigger');
  const extension = new FakeElement('extension');
  const label = new FakeElement('label');
  const outside = new FakeElement('outside');
  brand.children.add(trigger);
  brand.children.add(extension);
  brand.children.add(label);
  documentRoot.activeElement = outside;
  documentRoot.defaultView = { setTimeout, clearTimeout };
  documentRoot.querySelector = selector => ({
    '#meeARaiBrand': brand,
    '#meeARaiBrandToggle': trigger,
    '#meeARaiBrandName': extension,
  })[selector] || null;
  const api = loadApi();
  const controller = api.initMeeARaiBrand(documentRoot);
  return { api, controller, documentRoot, brand, trigger, extension, label, outside };
}

test('initializes idle state and only the M trigger toggles click state', () => {
  const h = createHarness();
  assert.equal(h.controller.isExpanded(), false);
  assert.equal(h.brand.dataset.expanded, 'false');
  assert.equal(h.trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(h.extension.getAttribute('aria-hidden'), 'true');

  h.brand.dispatch('click', { target: h.label });
  assert.equal(h.controller.isExpanded(), false);
  h.trigger.dispatch('click');
  assert.equal(h.controller.isExpanded(), true);
  h.trigger.dispatch('click');
  assert.equal(h.controller.isExpanded(), false);
});

test('mouse and pen hover, focus, Escape, and outside pointers update state', () => {
  const h = createHarness();
  h.trigger.dispatch('pointerenter', { pointerType: 'mouse' });
  assert.equal(h.controller.isExpanded(), true);
  h.brand.dispatch('pointerleave', { pointerType: 'mouse' });
  assert.equal(h.controller.isExpanded(), false);

  h.trigger.dispatch('pointerenter', { pointerType: 'pen' });
  assert.equal(h.controller.isExpanded(), true);
  h.documentRoot.dispatch('keydown', { key: 'Escape', target: h.trigger });
  assert.equal(h.controller.isExpanded(), false);

  h.documentRoot.activeElement = h.trigger;
  h.trigger.dispatch('focusin');
  h.brand.dispatch('pointerleave', { pointerType: 'mouse' });
  assert.equal(h.controller.isExpanded(), true, 'hover leave must preserve focused state');
  h.documentRoot.activeElement = h.outside;
  h.trigger.dispatch('focusout', { relatedTarget: h.outside });
  assert.equal(h.controller.isExpanded(), false);

  h.trigger.dispatch('click');
  h.documentRoot.dispatch('pointerdown', { pointerType: 'mouse', target: h.outside });
  assert.equal(h.controller.isExpanded(), false);
});

test('touch taps toggle after pointerleave while cancelled or lost sequences do nothing', () => {
  const h = createHarness();
  const down = h.trigger.dispatch('pointerdown', { pointerType: 'touch', pointerId: 7 });
  assert.equal(down.defaultPrevented, true);
  assert.equal(h.trigger.hasPointerCapture(7), true);
  h.brand.dispatch('pointerleave', { pointerType: 'touch', pointerId: 7 });
  assert.equal(h.controller.isExpanded(), false);
  h.trigger.dispatch('pointerup', { pointerType: 'touch', pointerId: 7 });
  assert.equal(h.controller.isExpanded(), true);

  h.trigger.dispatch('pointerdown', { pointerType: 'touch', pointerId: 8 });
  h.trigger.dispatch('pointerup', { pointerType: 'touch', pointerId: 8 });
  assert.equal(h.controller.isExpanded(), false);

  h.trigger.dispatch('pointerdown', { pointerType: 'touch', pointerId: 9 });
  h.trigger.dispatch('pointercancel', { pointerType: 'touch', pointerId: 9 });
  h.trigger.dispatch('pointerup', { pointerType: 'touch', pointerId: 9 });
  assert.equal(h.controller.isExpanded(), false);

  h.trigger.dispatch('pointerdown', { pointerType: 'touch', pointerId: 10 });
  h.trigger.dispatch('lostpointercapture', { pointerType: 'touch', pointerId: 10 });
  h.trigger.dispatch('pointerup', { pointerType: 'touch', pointerId: 10 });
  assert.equal(h.controller.isExpanded(), false);
});

test('destroy removes listeners, releases capture, and returns the mark to idle', () => {
  const h = createHarness();
  h.trigger.dispatch('click');
  h.trigger.dispatch('pointerdown', { pointerType: 'touch', pointerId: 11 });
  h.controller.destroy();
  assert.equal(h.controller.isExpanded(), false);
  assert.equal(h.trigger.hasPointerCapture(11), false);
  h.trigger.dispatch('click');
  h.documentRoot.dispatch('keydown', { key: 'Escape' });
  assert.equal(h.controller.isExpanded(), false);
});
