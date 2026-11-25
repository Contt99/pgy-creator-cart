'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const entry = process.env.PROTOTYPE_URL || pathToFileURL(path.resolve(__dirname, '../prototype/index.html')).href;
  const screenshotDir = process.env.PROTOTYPE_SCREENSHOTS;
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(entry);
    const cart = page.getByRole('complementary', { name: '项目购物车' });
    const row = name => page.getByRole('row', { name: new RegExp(name) });
    await page.getByRole('heading', { name: '达人发现', exact: true }).waitFor();
    await cart.getByText('鹿野来信', { exact: true }).waitFor();
    if (screenshotDir) {
      await fs.mkdir(screenshotDir, { recursive: true });
      await page.screenshot({ path: path.join(screenshotDir, 'prototype-desktop.png'), fullPage: true });
    }

    await page.getByRole('button', { name: '美妆护肤', exact: true }).click();
    await row('林间配方').waitFor();
    assert.equal(await row('鹿野来信').count(), 0);
    const search = page.getByRole('searchbox');
    await search.fill('找不到的人');
    await page.getByText('没有符合条件的达人').waitFor();
    await search.fill('demo-101');
    await row('林间配方').getByRole('button', { name: '林间配方' }).click();
    const detail = page.getByRole('dialog', { name: '林间配方' });
    await detail.getByText('图文报价').waitFor();
    if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, 'prototype-detail.png') });
    await detail.getByRole('button', { name: '加入购物车' }).click();
    await cart.getByText('林间配方', { exact: true }).waitFor();
    await page.reload();
    await cart.getByText('林间配方', { exact: true }).waitFor();

    await cart.getByRole('checkbox', { name: '选择 鹿野来信' }).uncheck();
    const downloadReady = page.waitForEvent('download');
    await cart.getByRole('button', { name: '导出 Excel' }).click();
    const download = await downloadReady;
    assert.match(download.suggestedFilename(), /\.xlsx$/);
    const bytes = await fs.readFile(await download.path());
    assert.equal(bytes.subarray(0, 4).toString('hex'), '504b0304');
    assert.match(bytes.toString('utf8'), /林间配方/);
    assert.doesNotMatch(bytes.toString('utf8'), /鹿野来信/);

    await row('林间配方').getByRole('button', { name: '移出购物车' }).click();
    await row('林间配方').getByRole('button', { name: '排除' }).click();
    await page.getByRole('button', { name: /已排除 1/ }).click();
    await row('林间配方').getByRole('button', { name: '恢复' }).click();
    await page.getByText('还没有排除的达人').waitFor();

    await page.getByRole('button', { name: '新建项目' }).click();
    const create = page.getByRole('dialog', { name: '新建项目' });
    await create.getByLabel('项目名称').fill('面试测试项目');
    await create.getByRole('button', { name: '创建项目' }).click();
    await cart.getByText('购物车还是空的').waitFor();
    await page.getByLabel('当前项目').selectOption({ label: '春日生活方式企划' });
    await cart.getByText('鹿野来信', { exact: true }).waitFor();
    await page.getByRole('button', { name: '重置演示' }).click();
    await page.getByRole('dialog', { name: '重置演示' }).getByRole('button', { name: '确认重置' }).click();
    await page.getByRole('status').filter({ hasText: '已恢复演示初始数据' }).waitFor();
    assert.deepEqual(await page.getByLabel('当前项目').locator('option').allTextContents(), ['春日生活方式企划', '新品合作备选']);

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1, hasTouch: true });
    mobile.on('pageerror', e => errors.push(e.message));
    await mobile.goto(entry);
    await mobile.getByRole('complementary', { name: '项目购物车' }).getByText('鹿野来信', { exact: true }).waitFor();
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth), 390);
    if (screenshotDir) await mobile.screenshot({ path: path.join(screenshotDir, 'prototype-mobile.png'), fullPage: true });
    assert.deepEqual(errors, []);
    console.log('Prototype: discovery, detail, persisted projects, XLSX selection, screening, reset, mobile layout');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
