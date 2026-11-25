const waitForAsync = require('./browser-wait.cjs');
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const path = require('node:path');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
 const page=await browser.newPage({viewport:{width:1280,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.resolve('tests/browser-fixture.html')).href);
 await page.waitForSelector('#pgy-cart-floating-button');
 await page.evaluate(async()=>{
   await PGYCartStorage.upsertCreator({redId:'000000101',name:'测试达人春禾',profileId:'000000000000000000000101',pgyUrl:'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/000000000000000000000101'});
   const row=document.querySelector('.creator-result-row').cloneNode(true);
   row.querySelector('.blogger-redid a').textContent='TestABC';
   row.querySelector('.blogger-name').textContent='小满';
   document.querySelector('tbody').append(row);
 });
 await page.waitForFunction(()=>/共 \d+ 位达人/.test(document.querySelector('#pgy-cart-floating-button')?.getAttribute('aria-label')||''));
 await page.locator('#pgy-cart-floating-button').click();
 const cartBulkUi=await page.locator('[data-cart-actions]').evaluate(actions=>({height:actions.getBoundingClientRect().height,buttonHeight:actions.querySelector('button').getBoundingClientRect().height,padding:getComputedStyle(actions).padding,gap:getComputedStyle(actions).gap}));
 const cartBoundaryUi=await page.evaluate(()=>{
   const area=document.querySelector('.pgy-review'),list=document.querySelector('[data-cart-list]'),actions=document.querySelector('[data-cart-actions]'),footer=document.querySelector('.pgy-cart-drawer-footer');
   const style=element=>getComputedStyle(element),rect=element=>element.getBoundingClientRect();
   return {
     separatorWidth:style(area).borderBottomWidth,
     separatorColor:style(area).borderBottomColor,
     listLeft:rect(list).left,
     listRight:rect(list).right,
     actionsLeft:rect(actions).left,
     actionsRight:rect(actions).right,
     actionsBackground:style(actions).backgroundColor,
     actionsBorderColor:style(actions).borderTopColor,
     actionsBottom:rect(actions).bottom,
     footerTop:rect(footer).top,
     footerBackground:style(footer).backgroundColor,
     footerBorderColor:style(footer).borderTopColor
   };
 });
 assert.equal(await page.locator('[data-backup-file]').evaluate(input=>getComputedStyle(input).display),'none');
 assert.match(await page.locator('[data-cart-list]').innerText(),/添加时间：\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
 assert.doesNotMatch(await page.locator('[data-cart-list]').innerText(),/已从主页更新/);
 assert.equal(await page.locator('.pgy-cart-creator-link').evaluate(link=>getComputedStyle(link).textDecorationLine),'none');
 assert.equal(await page.locator('.pgy-cart-drawer').getAttribute('role'),'dialog');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>document.querySelector('[data-backdrop]').dataset.open==='false');
 assert.equal(await page.evaluate(()=>document.activeElement.id),'pgy-cart-floating-button');
 await page.locator('#pgy-cart-floating-button').click();
 await page.locator('[data-cart-clear-visible]').click();
 assert.equal(await page.locator('[data-cart-list] input[type="checkbox"]').isChecked(),false);
 assert.equal(await page.locator('[data-export]').isDisabled(),true);
 await page.locator('[data-cart-select-visible]').click();
 assert.equal(await page.locator('[data-cart-list] input[type="checkbox"]').isChecked(),true);
 await page.locator('[data-remove]').click();
 await page.locator('[data-toast-action]').click();
 await waitForAsync(page, async()=>Boolean((await PGYCartStorage.getCart()).cart.creators['000000101']));
 await page.evaluate(()=>{window.batchOpenedUrl='';window.batchFakeWindow={closed:false,blur(){}};window.open=url=>{window.batchOpenedUrl=String(url);return window.batchFakeWindow;};});
 await page.locator('[data-batch-toggle]').click();
 assert.equal(await page.locator('[data-batch-panel]').isVisible(),true);
 await page.locator('[data-batch-start]').click();
 await waitForAsync(page, async()=>Boolean((await PGYCartStorage.getBatchJob())?.queue?.length));
 const batch=await page.evaluate(async()=>({job:await PGYCartStorage.getBatchJob(),url:window.batchOpenedUrl}));
 assert.equal(batch.job.queue.length,1);
 assert.equal(batch.job.status,'running');
 assert.match(batch.url,/pgy-cart-batch=/);
 assert.equal(await page.locator('[data-batch-floating]').isVisible(),true);
 await page.evaluate(()=>{window.batchFakeWindow.closed=true;});
 await waitForAsync(page, async()=>(await PGYCartStorage.getBatchJob())?.status==='error');
 await page.locator('[data-batch-panel] [data-batch-pause]').waitFor({state:'hidden'});
 assert.equal(await page.locator('[data-batch-panel] [data-batch-pause]').isVisible(),false);
 assert.equal(await page.locator('[data-batch-panel] [data-batch-resume]').isVisible(),true);
 await page.screenshot({path:'outputs/batch-floating-v0.3.8.png',fullPage:true});
 await page.evaluate(()=>{window.batchFakeWindow.closed=false;});
 await page.locator('[data-batch-panel] [data-batch-resume]').click();
 await waitForAsync(page, async()=>(await PGYCartStorage.getBatchJob())?.status==='running');
 await page.locator('[data-batch-panel] [data-batch-pause]').click();
 await waitForAsync(page, async()=>(await PGYCartStorage.getBatchJob())?.status==='paused');
 await page.locator('[data-batch-panel] [data-batch-cancel]').click();
 await waitForAsync(page, async()=>(await PGYCartStorage.getBatchJob())?.status==='cancelled');
 await page.locator('[data-finish]').click();
 await page.waitForFunction(()=>document.querySelector('.pgy-review-mark'));
 await page.evaluate(()=>{
   const row=document.querySelector('.pgy-cart-list-item'),name=row.querySelector('.pgy-creator-name-link'),action=row.querySelector('.pgy-creator-action'),select=row.querySelector('.pgy-creator-select'),meta=row.querySelector('.pgy-creator-meta');
   window.cartUi={firstColumn:getComputedStyle(row).gridTemplateColumns.split(' ')[0],gap:getComputedStyle(row).columnGap,padding:getComputedStyle(row).padding,decoration:getComputedStyle(name).textDecorationLine,nameFontSize:getComputedStyle(name).fontSize,selectMargin:getComputedStyle(select).margin,metaColor:getComputedStyle(meta).color,metaMargin:getComputedStyle(meta).marginTop,actionHeight:action.getBoundingClientRect().height,actionRadius:getComputedStyle(action).borderRadius};
 });
 await page.screenshot({path:'outputs/unified-cart-v0.3.16.png',fullPage:true});
 let cart=await page.evaluate(async()=>(await PGYCartStorage.getCart()).cart);
 assert.ok(cart.creators['000000101']);assert.ok(cart.excluded.TestABC);assert.equal(cart.excluded['000000101'],undefined);
 const before=await page.locator('table').boundingBox();
 await page.locator('[data-hide]').check();
 await page.waitForFunction(()=>document.querySelector('.pgy-review-hidden'));
 assert.equal((await page.locator('table').boundingBox()).height,before.height);
 await page.locator('[data-tab="excluded"]').click();
 await page.evaluate(async()=>{
   const state=await PGYCartStorage.getState();
   state.carts.default.excluded.TestABC.profileId='000000000000000000000101';
   for(let i=0;i<20;i++) state.carts.default.excluded[`extra-${i}`]={redId:`extra-${i}`,name:`补充达人${i}`,profileId:`${(i+1).toString(16).padStart(24,'0')}`,excludedAt:'2026-09-12T00:00:00Z',exclusionSource:'本页筛选'};
   state.carts.default.excluded['extra-0'].excludedAt='2027-01-02T03:04:05Z';
   await chrome.storage.local.set({[PGYCartStorage.STORAGE_KEY]:state});
 });
 await page.waitForFunction(()=>Boolean(document.querySelector('[data-excluded-list] a')));
 assert.equal(await page.locator('.pgy-review-entry-name').first().innerText(),'补充达人0');
 const excludedLink=page.locator('[data-excluded-list] a').filter({hasText:'小满'});
 assert.equal(await excludedLink.innerText(),'小满');
 assert.match(await excludedLink.getAttribute('href'),/blogger-detail\/000000000000000000000101$/);
 assert.equal(await excludedLink.getAttribute('target'),'_blank');
 assert.equal(await page.locator('[data-excluded-actions]').evaluate(actions=>actions.parentElement===document.querySelector('[data-excluded-list]').parentElement),true);
 assert.equal(await page.locator('[data-excluded-list]').evaluate(list=>getComputedStyle(list).overflowY),'auto');
 assert.equal(await page.locator('[data-excluded-list]').evaluate(list=>getComputedStyle(list).borderTopStyle),'solid');
 assert.equal(await page.locator('.pgy-review').evaluate(area=>getComputedStyle(area).overflow),'hidden');
 const layout=await page.evaluate(()=>{
   const area=document.querySelector('.pgy-review'), list=document.querySelector('[data-excluded-list]'), actions=document.querySelector('[data-excluded-actions]'), footer=document.querySelector('.pgy-cart-drawer-footer');
   return {activeTab:area.dataset.activeTab,areaHeight:area.getBoundingClientRect().height,listHeight:list.getBoundingClientRect().height,actionsBottom:actions.getBoundingClientRect().bottom,footerTop:footer.getBoundingClientRect().top};
 });
 assert.equal(layout.activeTab,'excluded');
 assert.ok(layout.areaHeight>400,'excluded area fills the drawer middle');
 assert.ok(layout.listHeight>180,'excluded list receives the remaining height');
 assert.ok(Math.abs(layout.footerTop-layout.actionsBottom)<18,`bulk actions stay directly above the footer: ${JSON.stringify(layout)}`);
 const excludedBulkUi=await page.locator('[data-excluded-actions]').evaluate(actions=>({height:actions.getBoundingClientRect().height,buttonHeight:actions.querySelector('button').getBoundingClientRect().height,padding:getComputedStyle(actions).padding,gap:getComputedStyle(actions).gap}));
 assert.deepEqual(excludedBulkUi,cartBulkUi,'cart and excluded list action bars use identical sizing');
 const excludedBoundaryUi=await page.evaluate(()=>{
   const area=document.querySelector('.pgy-review'),list=document.querySelector('[data-excluded-list]'),actions=document.querySelector('[data-excluded-actions]'),footer=document.querySelector('.pgy-cart-drawer-footer');
   const style=element=>getComputedStyle(element),rect=element=>element.getBoundingClientRect();
   return {
     areaBorderBottomWidth:style(area).borderBottomWidth,
     listBorderTopWidth:style(list).borderTopWidth,
     listBorderTopColor:style(list).borderTopColor,
     listLeft:rect(list).left,
     listRight:rect(list).right,
     actionsLeft:rect(actions).left,
     actionsRight:rect(actions).right,
     actionsBackground:style(actions).backgroundColor,
     actionsBorderColor:style(actions).borderTopColor,
     actionsBottom:rect(actions).bottom,
     footerTop:rect(footer).top,
     footerBackground:style(footer).backgroundColor,
     footerBorderColor:style(footer).borderTopColor
   };
 });
 assert.equal(excludedBoundaryUi.areaBorderBottomWidth,'0px','excluded view must not stack its own bottom border with the footer separator');
 assert.ok(Math.abs(excludedBoundaryUi.actionsBottom-excludedBoundaryUi.footerTop)<0.1,'excluded action bar must meet the footer without an extra border row');
 assert.equal(excludedBoundaryUi.listBorderTopWidth,cartBoundaryUi.separatorWidth,'cart and excluded list separators use the same width');
 assert.equal(excludedBoundaryUi.listBorderTopColor,cartBoundaryUi.separatorColor,'cart and excluded list separators use the same color');
 assert.deepEqual({left:excludedBoundaryUi.listLeft,right:excludedBoundaryUi.listRight},{left:cartBoundaryUi.listLeft,right:cartBoundaryUi.listRight},'cart and excluded lists use identical horizontal bounds');
 assert.deepEqual({left:excludedBoundaryUi.actionsLeft,right:excludedBoundaryUi.actionsRight},{left:cartBoundaryUi.actionsLeft,right:cartBoundaryUi.actionsRight},'cart and excluded action bars use identical horizontal bounds');
 assert.equal(excludedBoundaryUi.actionsBackground,cartBoundaryUi.actionsBackground,'cart and excluded action bars use the same background');
 assert.equal(excludedBoundaryUi.actionsBorderColor,cartBoundaryUi.actionsBorderColor,'cart and excluded action bars use the same separator color');
 assert.equal(excludedBoundaryUi.footerBackground,cartBoundaryUi.footerBackground,'footer background remains identical across tabs');
 assert.equal(excludedBoundaryUi.footerBorderColor,cartBoundaryUi.footerBorderColor,'footer separator remains identical across tabs');
 assert.equal(await page.locator('.pgy-review-entry').first().evaluate(row=>getComputedStyle(row).display),'grid');
 const unifiedUi=await page.locator('.pgy-review-entry').first().evaluate(row=>{const action=row.querySelector('.pgy-creator-action'),name=row.querySelector('.pgy-creator-name-link'),select=row.querySelector('.pgy-creator-select'),metas=[...row.querySelectorAll('.pgy-creator-meta')];return {firstColumn:getComputedStyle(row).gridTemplateColumns.split(' ')[0],gap:getComputedStyle(row).columnGap,padding:getComputedStyle(row).padding,nameFontSize:getComputedStyle(name).fontSize,selectMargin:getComputedStyle(select).margin,metaColors:metas.map(meta=>getComputedStyle(meta).color),metaMargins:metas.map(meta=>getComputedStyle(meta).marginTop),actionHeight:action.getBoundingClientRect().height,actionRadius:getComputedStyle(action).borderRadius,cart:window.cartUi};});
 assert.equal(unifiedUi.firstColumn,unifiedUi.cart.firstColumn);
 assert.equal(unifiedUi.gap,unifiedUi.cart.gap);
 assert.equal(unifiedUi.padding,unifiedUi.cart.padding);
 assert.equal(unifiedUi.nameFontSize,unifiedUi.cart.nameFontSize);
 assert.equal(unifiedUi.selectMargin,unifiedUi.cart.selectMargin);
 assert.ok(unifiedUi.metaColors.every(color=>color===unifiedUi.cart.metaColor),'excluded metadata uses the same muted color as cart identifiers');
 assert.ok(unifiedUi.metaMargins.every(margin=>margin===unifiedUi.cart.metaMargin),'cart and excluded metadata use the same vertical rhythm');
 assert.equal(unifiedUi.actionHeight,unifiedUi.cart.actionHeight);
 assert.equal(unifiedUi.actionRadius,unifiedUi.cart.actionRadius);
 assert.equal(unifiedUi.cart.decoration,'none');
 assert.equal(await page.locator('.pgy-review-entry-content').count()>0,true);
 assert.match(await page.locator('.pgy-review-entry small').first().innerText(),/^排除时间：\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} · 本页筛选$/);
 await page.locator('[data-search]').fill(' abc ');
 assert.match(await page.locator('[data-results]').innerText(),/1 \/ 21/);
 await page.locator('[data-search]').fill('不存在');
 assert.match(await page.locator('[data-results]').innerText(),/0 \/ 21/);
 await page.locator('[data-reset]').click();
 const selectAll=page.locator('[data-select-all]');
 assert.equal(await selectAll.evaluate(input=>Math.abs(input.closest('label').getBoundingClientRect().right-(input.closest('[data-excluded-actions]').getBoundingClientRect().right-20))<2),true);
 await selectAll.check();
 assert.equal(await page.locator('[data-select]').evaluateAll(items=>items.every(item=>item.checked)),true);
 assert.match(await page.locator('[data-restore]').innerText(),/（21）/);
 await selectAll.uncheck();
 await page.locator('[data-select]').first().check();
 assert.equal(await selectAll.evaluate(input=>input.indeterminate),true);
 await page.locator('[data-select]').first().uncheck();
 await page.evaluate(()=>{window.restoreButtonBeforeScan=[...document.querySelectorAll('.pgy-review-entry')].find(row=>row.textContent.includes('小满')).querySelector('[data-restore-one]');});
 await page.waitForTimeout(2200);
 assert.equal(await page.evaluate(()=>window.restoreButtonBeforeScan===[...document.querySelectorAll('.pgy-review-entry')].find(row=>row.textContent.includes('小满')).querySelector('[data-restore-one]')),true,'periodic scans must not replace restore button');
 await page.locator('.pgy-review-entry').filter({hasText:'小满'}).locator('[data-restore-one]').click();
 await page.waitForFunction(()=>!document.querySelector('.pgy-review-hidden'));
 await page.locator('[data-finish]').click();
 await page.locator('[data-undo]').click();
 await page.waitForFunction(()=>!document.querySelector('.pgy-review-mark'));
 await page.locator('[data-tab="cart"]').click();
 assert.equal(await page.locator('.pgy-review').getAttribute('data-active-tab'),'cart');
 assert.equal(await page.locator('.pgy-cart-row-actions').count()>0,true);
 await page.locator('[data-search]').fill('春禾');
 assert.match(await page.locator('[data-results]').innerText(),/1 \/ 1/);
 await page.locator('[data-search]').fill('缺失');
 assert.equal(await page.locator('[data-pgy-red-id]:visible').count(),0);
 await page.locator('[data-reset]').click();
 await page.locator('[data-reject]').click();
 await waitForAsync(page, async()=>Boolean((await PGYCartStorage.getCart()).cart.excluded['000000101']));
 await page.locator('[data-toast-action]').waitFor({state:'visible'});
 await page.locator('[data-toast-action]').click();
 await waitForAsync(page, async()=>Boolean((await PGYCartStorage.getCart()).cart.creators['000000101']));
 await page.locator('[data-reject]').click();
 await waitForAsync(page, async()=>Boolean((await PGYCartStorage.getCart()).cart.excluded['000000101']));
 // Simulate a virtual row being reused for another creator.
 await page.evaluate(()=>{document.querySelector('.blogger-redid a').textContent='next-page-id';});
 await page.waitForFunction(()=>!document.querySelector('.creator-result-row').classList.contains('pgy-review-hidden'));
 await page.locator('[data-tab="excluded"]').click();
 await page.screenshot({path:'outputs/review-v0.3.16.png',fullPage:true});
 assert.deepEqual(errors,[]);
 const popup=await browser.newPage({viewport:{width:480,height:900}});
 const popupErrors=[];popup.on('pageerror',e=>popupErrors.push(e.message));
 await popup.addInitScript({path:'tests/browser-fixture-chrome.js'});
 await popup.goto(pathToFileURL(path.resolve('src/popup/popup.html')).href);
 await popup.evaluate(async()=>{await PGYCartStorage.upsertCreator({redId:'AbC123',name:'搜索达人'});await PGYCartStorage.excludeCreators([{redId:'other',name:'排除达人'}],'default');});
 await popup.waitForFunction(()=>/添加时间：\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(document.querySelector('[data-creator-list]').innerText));
 const popupCartSeparator=await popup.locator('.pgy-review').evaluate(area=>({width:getComputedStyle(area).borderBottomWidth,color:getComputedStyle(area).borderBottomColor}));
 const popupCartActions=await popup.locator('[data-cart-actions]').evaluate(actions=>{const rect=actions.getBoundingClientRect();return {height:rect.height,left:rect.left,right:rect.right,padding:getComputedStyle(actions).padding,gap:getComputedStyle(actions).gap,background:getComputedStyle(actions).backgroundColor,borderColor:getComputedStyle(actions).borderTopColor};});
 assert.equal(await popup.locator('[data-backup-file]').evaluate(input=>getComputedStyle(input).display),'none');
 await popup.locator('[data-cart-select-visible]').click();
 assert.equal(await popup.locator('[data-creator-list] input[type="checkbox"]').isChecked(),true);
 await popup.locator('[data-cart-clear-visible]').click();
 assert.equal(await popup.locator('[data-creator-list] input[type="checkbox"]').isChecked(),false);
 await popup.locator('[data-cart-select-visible]').click();
 await popup.locator('[data-search]').fill('abc');
 assert.match(await popup.locator('[data-results]').innerText(),/1 \/ 1/);
 await popup.locator('[data-tab="excluded"]').click();
 const popupExcludedBoundary=await popup.evaluate(()=>{const area=document.querySelector('.pgy-review'),list=document.querySelector('[data-excluded-list]');return {areaBottomWidth:getComputedStyle(area).borderBottomWidth,listTopWidth:getComputedStyle(list).borderTopWidth,listTopColor:getComputedStyle(list).borderTopColor};});
 const popupExcludedActions=await popup.locator('[data-excluded-actions]').evaluate(actions=>{const rect=actions.getBoundingClientRect();return {height:rect.height,left:rect.left,right:rect.right,padding:getComputedStyle(actions).padding,gap:getComputedStyle(actions).gap,background:getComputedStyle(actions).backgroundColor,borderColor:getComputedStyle(actions).borderTopColor};});
 assert.equal(popupExcludedBoundary.areaBottomWidth,'0px','popup excluded view must not add a second footer separator');
 assert.equal(popupExcludedBoundary.listTopWidth,popupCartSeparator.width,'popup cart and excluded separators use the same width');
 assert.equal(popupExcludedBoundary.listTopColor,popupCartSeparator.color,'popup cart and excluded separators use the same color');
 assert.deepEqual(popupExcludedActions,popupCartActions,'popup cart and excluded action bars use identical geometry and colors');
 await popup.screenshot({path:'outputs/popup-excluded-v0.3.16.png',fullPage:true});
 await popup.locator('[data-search]').fill('排除');
 await popup.locator('[data-select]').check();
 await popup.locator('[data-restore]').click();
 await waitForAsync(popup, async()=>Object.keys((await PGYCartStorage.getCart()).cart.excluded).length===0);
 await popup.locator('[data-tab="cart"]').click();
 assert.equal(await popup.locator('[data-search]').inputValue(),'abc');
 await popup.screenshot({path:'outputs/popup-v0.3.16.png',fullPage:true});
 assert.deepEqual(popupErrors,[]);
 console.log('review browser tests passed');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
