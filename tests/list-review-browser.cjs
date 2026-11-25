const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({channel:'chrome', headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[]; page.on('pageerror', e=>errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve('tests/browser-fixture.html')).href);
    await page.addScriptTag({path:'src/content/list-identity.js'});
    await page.evaluate(() => {
      document.querySelector('table').innerHTML = '<thead><tr><th data-key="kolInfo">博主信息</th><th data-key="fansCount">粉丝数</th></tr></thead><tbody></tbody>';
      for (let i=0;i<3;i++) {
        const row=document.createElement('tr');
        row.innerHTML=`<td style="padding:24px"><div class="kol-info" style="height:110px"><span class="kol-name">${i===2?'未知达人':'同名达人'}</span></div></td><td>12.3w</td>`;
        document.querySelector('tbody').append(row);
        if(i<2) row.querySelector('.kol-name').__vueParentComponent={props:{kolInfo:{userId:String(i+1).padStart(24,'0'),name:'同名达人'}}};
      }
    });
    await page.waitForSelector('.pgy-row-actions');
    assert.equal(await page.locator('[data-page-finish]').isEnabled(),false,'unresolved rows stop batch exclusion');
    const before=await page.locator('table').boundingBox();
    await page.evaluate(()=>document.querySelectorAll('.kol-name')[2].__vueParentComponent={props:{kolInfo:{userId:'000000000000000000000003',name:'未知达人'}}});
    await page.waitForFunction(()=>!document.querySelector('[data-page-finish]').disabled);
    await page.locator('.pgy-row-actions [data-action="add"]').first().click();
    await page.waitForSelector('.pgy-row-added');
    await page.locator('[data-page-finish]').click();
    await page.waitForFunction(()=>document.querySelector('[data-page-info]').textContent.includes('已排除 2'));
    const stored=await page.evaluate(async()=>(await PGYCartStorage.getCart()).cart);
    assert.equal(stored.order.length,1); assert.equal(Object.keys(stored.excluded).length,2);
    await page.locator('[data-page-hide]').check();
    await page.waitForFunction(()=>document.querySelectorAll('.pgy-review-hidden').length===2);
    assert.equal((await page.locator('table').boundingBox()).height,before.height);
    // The same DOM row is recycled for a different creator on the next page.
    await page.evaluate(()=>{
      const anchor=document.querySelectorAll('.kol-name')[1]; anchor.textContent='下一页达人';
      anchor.__vueParentComponent.props.kolInfo={userId:'000000000000000000000004',name:'下一页达人'};
    });
    await page.waitForFunction(()=>document.querySelectorAll('.pgy-review-hidden').length===1);
    await page.locator('[data-page-undo]').click();
    await page.waitForFunction(()=>document.querySelectorAll('.pgy-review-hidden').length===0);
    assert.equal((await page.locator('table').boundingBox()).height,before.height);
    assert.deepEqual(errors,[]);
    console.log('list review tests passed: unresolved, duplicate names, protect added, hide geometry, recycled rows, undo');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
