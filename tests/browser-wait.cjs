'use strict';
const { setTimeout } = require('node:timers/promises');

// Playwright's page.waitForFunction treats a returned Promise as truthy.
// Await storage-backed predicates before deciding whether to keep polling.
module.exports = async function waitForAsync(page, predicate) {
  const deadline = Date.now() + 5000;
  do {
    if (await page.evaluate(predicate)) return;
    await setTimeout(30);
  } while (Date.now() < deadline);
  throw new Error(`Timed out waiting for ${predicate}`);
};
