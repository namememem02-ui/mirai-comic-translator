(function exposeMeeARaiBrand(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MeeARaiBrand = api;
})(typeof window !== 'undefined' ? window : globalThis, function createMeeARaiBrandApi() {
  const instances = new WeakMap();

  function initMeeARaiBrand(root = document) {
    if (!root || typeof root.querySelector !== 'function') {
      throw new TypeError('Mee-a-rai brand requires a document-like root');
    }

    const existing = instances.get(root);
    if (existing) return existing;

    const brand = root.querySelector('#meeARaiBrand');
    const trigger = root.querySelector('#meeARaiBrandToggle');
    const extension = root.querySelector('#meeARaiBrandName');
    if (!brand || !trigger || !extension) {
      throw new Error('Mee-a-rai brand markup is incomplete');
    }

    const listeners = [];
    const view = root.defaultView || globalThis;
    let expanded = false;
    let destroyed = false;
    let touchPointerId = null;
    let suppressClick = false;
    let suppressClickTimer = null;

    function listen(target, type, listener, options) {
      target.addEventListener(type, listener, options);
      listeners.push(() => target.removeEventListener(type, listener, options));
    }

    function setExpanded(next) {
      expanded = Boolean(next);
      brand.dataset.expanded = String(expanded);
      brand.classList.toggle('is-expanded', expanded);
      trigger.setAttribute('aria-expanded', String(expanded));
      extension.setAttribute('aria-hidden', String(!expanded));
      return expanded;
    }

    function toggleExpanded() {
      return setExpanded(!expanded);
    }

    function releaseTouchCapture(pointerId = touchPointerId) {
      if (pointerId === null || pointerId === undefined) return;
      try {
        if (typeof trigger.hasPointerCapture !== 'function' || trigger.hasPointerCapture(pointerId)) {
          trigger.releasePointerCapture?.(pointerId);
        }
      } catch (_) {
        // Capture may already have been released by the browser.
      }
    }

    function clearTouchSequence(event, releaseCapture = true) {
      if (touchPointerId === null || (event && event.pointerId !== touchPointerId)) return false;
      const pointerId = touchPointerId;
      touchPointerId = null;
      if (releaseCapture) releaseTouchCapture(pointerId);
      return true;
    }

    function suppressCompatibilityClick() {
      suppressClick = true;
      if (suppressClickTimer !== null) view.clearTimeout?.(suppressClickTimer);
      suppressClickTimer = view.setTimeout?.(() => {
        suppressClick = false;
        suppressClickTimer = null;
      }, 0) ?? null;
    }

    function onClick(event) {
      if (suppressClick) {
        suppressClick = false;
        if (suppressClickTimer !== null) view.clearTimeout?.(suppressClickTimer);
        suppressClickTimer = null;
        event.preventDefault();
        return;
      }
      toggleExpanded();
    }

    function onPointerEnter(event) {
      if (event.pointerType !== 'touch') setExpanded(true);
    }

    function onPointerLeave(event) {
      if (event.pointerType === 'touch') return;
      if (brand.contains(root.activeElement)) return;
      setExpanded(false);
    }

    function onTouchPointerDown(event) {
      if (event.pointerType !== 'touch') return;
      if (touchPointerId !== null && touchPointerId !== event.pointerId) {
        releaseTouchCapture(touchPointerId);
      }
      touchPointerId = event.pointerId;
      event.preventDefault();
      try {
        trigger.setPointerCapture?.(event.pointerId);
      } catch (_) {
        // Pointer capture is optional in document-like test roots and older Chromium.
      }
    }

    function onTouchPointerUp(event) {
      if (event.pointerType !== 'touch' || !clearTouchSequence(event)) return;
      event.preventDefault();
      suppressCompatibilityClick();
      toggleExpanded();
    }

    function onTouchPointerCancelled(event) {
      if (event.pointerType !== 'touch') return;
      clearTouchSequence(event, event.type !== 'lostpointercapture');
    }

    function onFocusIn() {
      setExpanded(true);
    }

    function onFocusOut(event) {
      if (!brand.contains(event.relatedTarget)) setExpanded(false);
    }

    function onDocumentPointerDown(event) {
      if (!brand.contains(event.target)) setExpanded(false);
    }

    function onDocumentKeyDown(event) {
      if (event.key !== 'Escape' || !expanded) return;
      event.preventDefault();
      setExpanded(false);
    }

    listen(trigger, 'click', onClick);
    listen(trigger, 'pointerenter', onPointerEnter);
    listen(trigger, 'pointerdown', onTouchPointerDown);
    listen(trigger, 'pointerup', onTouchPointerUp);
    listen(trigger, 'pointercancel', onTouchPointerCancelled);
    listen(trigger, 'lostpointercapture', onTouchPointerCancelled);
    listen(trigger, 'focusin', onFocusIn);
    listen(trigger, 'focusout', onFocusOut);
    listen(brand, 'pointerleave', onPointerLeave);
    listen(root, 'pointerdown', onDocumentPointerDown, true);
    listen(root, 'keydown', onDocumentKeyDown);

    setExpanded(false);

    const controller = {
      isExpanded: () => expanded,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        if (suppressClickTimer !== null) view.clearTimeout?.(suppressClickTimer);
        suppressClickTimer = null;
        suppressClick = false;
        releaseTouchCapture();
        touchPointerId = null;
        listeners.splice(0).reverse().forEach(remove => remove());
        setExpanded(false);
        instances.delete(root);
      },
    };
    instances.set(root, controller);
    return controller;
  }

  return { initMeeARaiBrand };
});
