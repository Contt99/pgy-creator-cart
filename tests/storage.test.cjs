'use strict';

const assert = require('node:assert/strict');

const memory = {};
const listeners = new Set();
global.chrome = {
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

const storage = require('../src/shared/storage.js');

(async () => {
  let state = await storage.getState();
  assert.equal(state.activeProjectId, 'default');
  assert.equal(state.projects.default.name, '默认项目');

  state = await storage.createProject('新品种草');
  const campaignId = state.activeProjectId;
  assert.equal(state.projects[campaignId].name, '新品种草');

  await storage.upsertCreator({ redId: ' TestFixture01 ', name: '测试达人青禾' }, campaignId);
  await storage.upsertCreator({ redId: 'TestFixture01', name: '测试达人青禾（更新）' }, campaignId);
  let campaign = await storage.getCart(campaignId);
  assert.deepEqual(campaign.cart.order, ['TestFixture01']);
  assert.equal(campaign.cart.creators.TestFixture01.name, '测试达人青禾（更新）');

  await storage.setActiveProject('default');
  await storage.upsertCreator({ redId: 'TestFixture01', name: '测试达人青禾' });
  const defaultCart = await storage.getCart('default');
  campaign = await storage.getCart(campaignId);
  assert.equal(defaultCart.cart.order.length, 1, '同一达人可存在于不同项目');
  assert.equal(campaign.cart.order.length, 1, '项目内以小红书号去重');

  await storage.removeCreator('TestFixture01', campaignId);
  campaign = await storage.getCart(campaignId);
  assert.equal(campaign.cart.order.length, 0);
  const removedCreator = defaultCart.cart.creators.TestFixture01;
  await storage.removeCreator('TestFixture01', 'default');
  await storage.restoreRemovedCreator(removedCreator, 'default', 0);
  const restoredDefault = await storage.getCart('default');
  assert.equal(restoredDefault.cart.order[0], 'TestFixture01');
  assert.equal(restoredDefault.cart.creators.TestFixture01.name, '测试达人青禾');

  await storage.upsertCreator({redId:'keep',name:'保留'}, campaignId);
  await storage.excludeCreators([{redId:'keep'}, {redId:'old',name:'旧记录'}], campaignId);
  await storage.excludeCreators([{redId:'new',name:'新记录'}], campaignId);
  campaign = await storage.getCart(campaignId);
  assert.ok(campaign.cart.creators.keep);
  assert.equal(campaign.cart.excluded.keep, undefined);
  await storage.undoScreening(campaignId);
  campaign = await storage.getCart(campaignId);
  assert.ok(campaign.cart.excluded.old);
  assert.equal(campaign.cart.excluded.new, undefined);
  assert.equal((await storage.getCart('default')).cart.excluded.old, undefined);
  await storage.excludeCreators([{redId:'new'}], campaignId);
  await storage.restoreCreators(['new'], campaignId);
  await storage.upsertCreator({redId:'new'}, campaignId);
  await storage.excludeCreators([{redId:'new'}], campaignId, '移除并排除');
  await storage.undoScreening(campaignId);
  assert.ok((await storage.getCart(campaignId)).cart.excluded.new, '撤销旧批次不能撤销后来重新排除的记录');
  await storage.upsertCreator({redId:'old'}, campaignId);
  assert.equal((await storage.getCart(campaignId)).cart.excluded.old, undefined);
  await storage.setHideExcluded(true,campaignId);
  await storage.clearCart(campaignId);
  campaign = await storage.getCart(campaignId);
  assert.ok(campaign.cart.excluded.new);
  assert.equal(campaign.cart.hideExcluded,true);
  assert.equal(campaign.cart.order.length,0);
  assert.ok(storage.matchesSearch({name:'林小满',redId:'AbC123'},' abc '));
  assert.ok(storage.matchesSearch({name:'林小满'},'小满'));
  assert.equal(storage.formatLocalDateTime(new Date(2026,8,12,15,24,8)),'2026-09-12 15:24:08');
  assert.equal(storage.formatLocalDateTime('无效时间'),'');
  await Promise.all(['a','b','c'].map(redId=>storage.excludeCreators([{redId}],campaignId)));
  assert.equal(Object.keys((await storage.getCart(campaignId)).cart.excluded).length,4);
  const stableId = '000000000000000000000303';
  await storage.upsertCreator({redId:'0000000303',name:'旧昵称',pgyUrl:`https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/${stableId}`},campaignId);
  await storage.excludeCreators([{redId:`pgy:${stableId}`,profileId:stableId,name:'新昵称'}],campaignId);
  assert.ok((await storage.getCart(campaignId)).cart.creators['0000000303'],'list ID must protect previously added red ID');
  assert.equal((await storage.getCart(campaignId)).cart.excluded[`pgy:${stableId}`],undefined);
  await storage.upsertCreator({redId:`pgy:${stableId}`,profileId:stableId,name:'新昵称'},campaignId);
  assert.ok((await storage.getCart(campaignId)).cart.creators['0000000303'],'never replace known red ID with internal key');
  const anotherId = '000000000000000000000099';
  await storage.upsertCreator({redId:`pgy:${anotherId}`,profileId:anotherId,name:'同名达人'},campaignId);
  await storage.upsertCreator({redId:'realRedId',profileId:anotherId,name:'同名达人'},campaignId);
  campaign=await storage.getCart(campaignId);
  assert.ok(campaign.cart.creators.realRedId);
  assert.equal(campaign.cart.creators[`pgy:${anotherId}`],undefined);
  assert.equal(campaign.cart.order.filter(id=>id==='realRedId').length,1);
  await storage.updateExistingCreator({redId:'realRedId',profileId:anotherId,imagePrice:'8000',followersCount:'20w',capturedFields:{报价:['8000']}},campaignId);
  await storage.updateExistingCreator({redId:'realRedId',profileId:anotherId,imagePrice:'--',followersCount:'',videoPrice:'15000',capturedFields:{报价:['--'],视频:['15000']}},campaignId);
  campaign=await storage.getCart(campaignId);
  assert.equal(campaign.cart.creators.realRedId.imagePrice,'8000');
  assert.equal(campaign.cart.creators.realRedId.followersCount,'20w');
  assert.deepEqual(campaign.cart.creators.realRedId.capturedFields.报价,['8000']);
  assert.ok(campaign.cart.creators.realRedId.lastDetailUpdatedAt);
  assert.ok(storage.cartDetailUrl(campaign.cart.creators.realRedId,campaignId).includes('#pgy-cart-project='));
  await storage.removeCreator('realRedId',campaignId);
  await storage.updateExistingCreator({redId:'realRedId',profileId:anotherId,videoPrice:'16000'},campaignId);
  assert.equal((await storage.getCart(campaignId)).cart.creators.realRedId,undefined,'auto update must not resurrect removed creator');
  const batch={id:'batch-test',projectId:campaignId,queue:[{redId:'a'}],index:0,status:'running'};
  await storage.updateBatchJob(null,batch);
  assert.equal((await storage.getBatchJob()).id,'batch-test');
  await storage.updateBatchJob('batch-test',current=>({...current,status:'paused'}));
  assert.equal((await storage.getBatchJob()).status,'paused');
  await storage.updateBatchJob('another-batch',current=>({...current,status:'cancelled'}));
  assert.equal((await storage.getBatchJob()).status,'paused','stale batch writers cannot replace a newer task');
  const concurrent={id:'batch-concurrent',projectId:campaignId,queue:[{redId:'a',profileId:'000000000000000000000001'}],index:0,success:0,status:'running'};
  await storage.updateBatchJob(null,concurrent);
  await Promise.all([
    storage.advanceBatchJob('batch-concurrent','000000000000000000000001',{nextAt:1}),
    storage.advanceBatchJob('batch-concurrent','000000000000000000000001',{nextAt:2})
  ]);
  const advanced=await storage.getBatchJob();
  assert.equal(advanced.index,1,'concurrent detail callbacks advance the queue once');
  assert.equal(advanced.success,1,'concurrent detail callbacks count one success');
  const backup=await storage.createBackup();
  assert.equal(backup.format,'pgy-creator-cart-backup');
  assert.equal(backup.version,1);
  await storage.createProject('临时项目');
  await storage.restoreBackup(backup);
  const restoredBackup=await storage.getState();
  assert.equal(restoredBackup.projects[restoredBackup.activeProjectId].name,'默认项目');
  assert.equal(restoredBackup.projects[campaignId].name,'新品种草');
  assert.equal(Object.values(restoredBackup.projects).some(project=>project.name==='临时项目'),false);
  await assert.rejects(()=>storage.restoreBackup({bad:true}),/备份文件格式不正确/);
  console.log('storage tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
