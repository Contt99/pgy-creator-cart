'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

let cloneCount = 0;
const payload = { data: { id: 1 } };
const response = {
  url: 'https://pgy.xiaohongshu.com/api/test',
  headers: { get: () => 'application/json' },
  clone() {
    cloneCount += 1;
    return { json: async () => payload };
  }
};
const window = { fetch: async () => response };
const context = vm.createContext({ window, console, Set });
vm.runInContext(fs.readFileSync('src/content/json-response-observer.js', 'utf8'), context);

const received = [];
window.__PGY_CART_JSON_RESPONSE_OBSERVER__.subscribe(value => received.push(['a', value]));
window.__PGY_CART_JSON_RESPONSE_OBSERVER__.subscribe(value => received.push(['b', value]));

(async () => {
  await window.fetch(response.url);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(cloneCount, 1, 'one response is cloned and parsed once for all subscribers');
  assert.equal(received.length, 2);
  assert.equal(received[0][1], payload);
  assert.equal(received[1][1], payload);
  console.log('json response observer tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
