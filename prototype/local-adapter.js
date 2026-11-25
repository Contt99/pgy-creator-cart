/* The original shared store expects Chrome's Promise-based storage methods.
 * This adapter is loaded only by the demo; it never accesses extension data. */
(() => {
  'use strict';
  const key = 'pgy-cart-portfolio-demo-v1';
  const read = () => JSON.parse(localStorage.getItem(key) || '{}');
  const listeners = new Set();
  const emit = (before, after) => {
    const changes = {};
    for (const name of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (JSON.stringify(before[name]) !== JSON.stringify(after[name])) {
        changes[name] = { oldValue: before[name], newValue: after[name] };
      }
    }
    if (Object.keys(changes).length) for (const listener of listeners) listener(changes, 'local');
  };
  window.addEventListener('storage', event => {
    if (event.key === key) emit(JSON.parse(event.oldValue || '{}'), JSON.parse(event.newValue || '{}'));
  });
  window.chrome ??= {};
  window.chrome.storage = {
    local: {
      async get(keys) {
        const values = read();
        return Object.fromEntries(keys.filter(name => Object.hasOwn(values, name)).map(name => [name, values[name]]));
      },
      async set(patch) {
        const before = read();
        const after = { ...before, ...patch };
        localStorage.setItem(key, JSON.stringify(after));
        emit(before, after);
      }
    },
    onChanged: {
      addListener: listener => listeners.add(listener),
      removeListener: listener => listeners.delete(listener)
    }
  };
})();
