(function installChromeStorageFixture(root) {
  'use strict';
  const memory = {};
  const listeners = new Set();
  root.chrome = {
    storage: {
      local: {
        async get(keys) {
          const result = {};
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            if (Object.prototype.hasOwnProperty.call(memory, key)) result[key] = memory[key];
          }
          return result;
        },
        async set(values) {
          const changes = {};
          for (const [key, value] of Object.entries(values)) {
            changes[key] = { oldValue: memory[key], newValue: value };
            memory[key] = value;
          }
          for (const listener of listeners) listener(changes, 'local');
        }
      },
      onChanged: {
        addListener(listener) { listeners.add(listener); },
        removeListener(listener) { listeners.delete(listener); }
      }
    }
  };
})(globalThis);
