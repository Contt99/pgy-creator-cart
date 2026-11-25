const waitForAsync = require('./browser-wait.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    const page=await browser.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const html=fs.readFileSync('tests/browser-fixture.html','utf8').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]*>/g,'');
    await page.route('**/*',route=>route.request().resourceType()==='document'?route.fulfill({contentType:'text/html',body:html}):route.abort());
    await page.goto('https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/000000000000000000000101');
    for(const file of ['tests/browser-fixture-chrome.js','src/shared/storage.js','src/shared/xlsx.js','src/shared/review-ui.js']) await page.addScriptTag({path:file});
    await page.evaluate(async()=>{
      await PGYCartStorage.upsertCreator({redId:'000000101',name:'列表达人',pgyUrl:location.origin+location.pathname,imagePrice:'保留的报价'});
      const other=await PGYCartStorage.createProject('另一个项目');
      await PGYCartStorage.upsertCreator({redId:'000000101',name:'另一个项目旧数据'},other.activeProjectId);
      await PGYCartStorage.updateBatchJob(null,{id:'batch-auto',projectId:'default',projectName:'默认项目',queue:[{redId:'000000101',profileId:'000000000000000000000101',name:'测试达人春禾'}],index:0,success:0,failed:0,skipped:0,status:'running'});
      location.hash='pgy-cart-project=default&pgy-cart-batch=batch-auto';
    });
    await page.addScriptTag({path:'src/content/content.js'});
    await waitForAsync(page, async()=>Boolean((await PGYCartStorage.getCart('default')).cart.creators['000000101'].lastDetailUpdatedAt));
    const first=await page.evaluate(async()=>({original:(await PGYCartStorage.getCart('default')).cart.creators['000000101'],active:(await PGYCartStorage.getCart()).cart.creators['000000101']}));
    assert.ok(first.original.likeCollectCount,'automatically captures detail metrics');
    assert.equal(first.active.name,'测试达人春禾','direct detail visits update every project containing the creator');
    assert.ok(first.active.lastDetailUpdatedAt,'all matching projects receive detail updates');
    await waitForAsync(page, async()=>{
      const job=await PGYCartStorage.getBatchJob(); return job?.index===1 && job.success===1;
    });
    assert.equal(await page.locator('[data-batch-floating]').isVisible(),true,'detail pages show the floating batch controls');
    assert.match(await page.locator('[data-batch-floating-summary]').innerText(),/1\/1/);
    assert.equal(first.original.pgyUrl.includes('#'),false);
    await page.locator('#pgy-cart-floating-button').click();
    assert.match(await page.locator('[data-cart-list]').innerText(),/添加时间：\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
    assert.match(await page.locator('[data-cart-list]').innerText(),/已从主页更新 · \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
    await page.evaluate(()=>{
      const cell=[...document.querySelectorAll('td')].find(e=>e.textContent==='¥15,000');
      cell.textContent='¥18,000';
    });
    await waitForAsync(page, async()=>(await PGYCartStorage.getCart('default')).cart.creators['000000101']?.videoPrice?.includes('18,000'));
    await page.evaluate(async()=>{await PGYCartStorage.removeCreator('000000101','default');document.querySelector('td').append('延迟加载');});
    await page.waitForTimeout(2200);
    const afterRemoval=await page.evaluate(async()=>({removed:Boolean((await PGYCartStorage.getCart('default')).cart.creators['000000101']),other:(await PGYCartStorage.getCart()).cart.creators['000000101']}));
    assert.equal(afterRemoval.removed,false);
    assert.ok(afterRemoval.other.videoPrice.includes('18,000'),'remaining matching projects keep receiving delayed updates');
    assert.deepEqual(errors,[]);
    console.log('auto detail tests passed: any detail entry, all matching projects, delayed data, no resurrection');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
