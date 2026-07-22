(function settingsTabsModule(globalScope) {
  let rememberedActiveId = 'ai';

  function resolveTabIndex(currentIndex, key, count) {
    if (!Number.isInteger(count) || count <= 0) return currentIndex;
    if (key === 'Home') return 0;
    if (key === 'End') return count - 1;
    if (key === 'ArrowRight' || key === 'ArrowDown') return (currentIndex + 1) % count;
    if (key === 'ArrowLeft' || key === 'ArrowUp') return (currentIndex - 1 + count) % count;
    return currentIndex;
  }

  function initSettingsTabs(root) {
    const tabs = Array.from(root.querySelectorAll('[data-settings-tab]'));
    const panels = Array.from(root.querySelectorAll('[data-settings-panel]'));

    function activate(id, focus = false) {
      if (!tabs.some(tab => tab.dataset.settingsTab === id)) return;
      rememberedActiveId = id;
      tabs.forEach(tab => {
        const selected = tab.dataset.settingsTab === id;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
        if (selected && focus) tab.focus();
      });
      panels.forEach(panel => {
        panel.hidden = panel.dataset.settingsPanel !== id;
      });
    }

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activate(tab.dataset.settingsTab));
      tab.addEventListener('keydown', event => {
        const nextIndex = resolveTabIndex(index, event.key, tabs.length);
        if (nextIndex === index && !['Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        activate(tabs[nextIndex].dataset.settingsTab, true);
      });
    });

    activate(tabs.some(tab => tab.dataset.settingsTab === rememberedActiveId)
      ? rememberedActiveId
      : tabs[0]?.dataset.settingsTab);

    return { activate, activeId: () => rememberedActiveId };
  }

  const api = { resolveTabIndex, initSettingsTabs };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (globalScope) globalScope.SettingsTabs = api;
})(typeof window !== 'undefined' ? window : globalThis);
