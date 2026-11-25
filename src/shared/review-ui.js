(function (root) {
  'use strict';
  root.PGYReviewUI = function ({ host, list, storage, xlsx, getSnapshot, refresh, getPageCreators, getPageStatus, getCartSelection, setCartSelection, onCartRemoved }) {
    const area = document.createElement('section');
    area.className = 'pgy-review';
    list.before(area);
    area.innerHTML = `${getPageCreators ? '<div class="pgy-review-page-controls"><div class="pgy-review-actions"><button data-finish>本页筛选完成</button><button data-undo>撤销本次筛选</button></div><p data-page-summary></p><label class="pgy-review-hide"><input type="checkbox" data-hide> 隐藏已排除达人（保留占位）</label></div>' : ''}
      <div class="pgy-review-tabline"><div class="pgy-review-actions"><button data-tab="cart" aria-pressed="true">购物车</button><button data-tab="excluded" aria-pressed="false">已排除</button></div><p class="pgy-review-results" data-results aria-live="polite"></p></div>
      <div class="pgy-review-actions pgy-review-search"><input type="search" data-search aria-label="搜索昵称或小红书号" placeholder="搜索昵称或小红书号"><button data-reset>清空搜索</button></div>
      <p class="pgy-review-message" data-message role="status"></p><div data-excluded-list></div><div class="pgy-review-actions pgy-review-list-actions" data-excluded-actions><button data-restore>恢复所选</button><button data-export-excluded>导出全部排除名单</button><label class="pgy-review-select-all"><input type="checkbox" data-select-all> <span data-select-all-label>全选</span></label></div>`;
    const cartActions = document.createElement('div');
    cartActions.className = 'pgy-review-actions pgy-review-list-actions pgy-review-cart-actions';
    cartActions.dataset.cartActions = '';
    cartActions.innerHTML = '<button type="button" data-cart-select-visible>全选</button><button type="button" data-cart-clear-visible>取消选择</button><span data-cart-selected-summary></span>';
    if (setCartSelection) list.after(cartActions);
    const q = s => area.querySelector(s);
    let tab = 'cart', selection = new Set(), previousProject, lastExcludedMarkup;
    const queries = new Map();
    const queryKey = () => `${getSnapshot().activeProjectId}:${tab}`;
    const esc = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const run = async fn => { try { await fn(); await refresh(); } catch (error) { q('[data-message]').textContent = error.message || '操作失败，请重试'; } };
    function render() {
      const snapshot = getSnapshot();
      if (!snapshot) return;
      area.dataset.activeTab = tab;
      const id = snapshot.activeProjectId, cart = snapshot.carts[id];
      if (previousProject !== id) { selection.clear(); previousProject = id; }
      const excluded = Object.values(cart.excluded).map((item, index) => ({item, index})).sort((left, right) => {
        const rightTime = new Date(right.item.excludedAt || 0).getTime() || 0;
        const leftTime = new Date(left.item.excludedAt || 0).getTime() || 0;
        return rightTime - leftTime || left.index - right.index;
      }).map(entry => entry.item);
      const query = queries.get(queryKey()) || '';
      q('[data-search]').value = query;
      q('[data-reset]').disabled = !query;
      const items = tab === 'cart' ? storage.creatorsAsList(cart) : excluded;
      const visible = items.filter(item => storage.matchesSearch(item, query));
      q('[data-results]').textContent = `显示 ${visible.length} / ${items.length} 位`;
      for (const button of area.querySelectorAll('[data-tab]')) {
        button.setAttribute('aria-pressed', button.dataset.tab === tab);
        button.textContent = button.dataset.tab === 'cart' ? `购物车 ${cart.order.length}` : `已排除 ${excluded.length}`;
      }
      list.hidden = tab !== 'cart';
      for (const row of list.querySelectorAll('[data-pgy-red-id], [data-red-id]')) {
        const creator = cart.creators[row.dataset.pgyRedId || row.dataset.redId];
        row.hidden = !creator || !storage.matchesSearch(creator, query);
        if (!row.querySelector('[data-reject]')) {
          const button = document.createElement('button');
          button.type = 'button'; button.dataset.reject = creator?.redId || ''; button.textContent = '移除并排除';
          button.className = 'pgy-review-reject pgy-creator-action';
          button.onclick = () => run(async () => {
            const index = cart.order.indexOf(creator.redId);
            await storage.excludeCreators([creator], id, '移除并排除');
            if (onCartRemoved) onCartRemoved({ creator, projectId: id, index, excluded: true });
          });
          (row.querySelector('.pgy-cart-row-actions') || row).append(button);
        }
      }
      for (const selected of selection) if (!visible.some(item => item.redId === selected)) selection.delete(selected);
      q('[data-excluded-list]').hidden = tab !== 'excluded';
      q('[data-excluded-actions]').hidden = tab !== 'excluded';
      if (setCartSelection) {
        const selected = new Set(getCartSelection ? getCartSelection() : []);
        const selectedVisible = visible.filter(item => selected.has(item.redId)).length;
        cartActions.hidden = tab !== 'cart' || !items.length;
        cartActions.querySelector('[data-cart-select-visible]').textContent = query ? `全选搜索结果（${visible.length}）` : `全选（${visible.length}）`;
        cartActions.querySelector('[data-cart-select-visible]').disabled = !visible.length || selectedVisible === visible.length;
        cartActions.querySelector('[data-cart-clear-visible]').textContent = query ? '取消搜索结果' : '取消选择';
        cartActions.querySelector('[data-cart-clear-visible]').disabled = !selectedVisible;
        cartActions.querySelector('[data-cart-selected-summary]').textContent = `已选 ${selected.size} · 当前显示 ${visible.length}`;
      }
      const excludedMarkup = visible.length && tab === 'excluded' ? visible.map(item => {
        const detailUrl = storage.creatorDetailUrl(item);
        const name = esc(item.name);
        const nameMarkup = detailUrl ? `<a class="pgy-review-creator-link pgy-creator-name-link" href="${esc(detailUrl)}" target="_blank" rel="noopener noreferrer" title="打开 ${name} 的蒲公英主页">${name}</a>` : name;
        const excludedAt = storage.formatLocalDateTime(item.excludedAt) || String(item.excludedAt || '').slice(0, 10);
        return `<div class="pgy-review-entry pgy-creator-row"><input class="pgy-review-select pgy-creator-select" type="checkbox" data-select="${esc(item.redId)}" aria-label="选择 ${name}" ${selection.has(item.redId) ? 'checked' : ''}><div class="pgy-review-entry-content pgy-creator-content"><div class="pgy-review-entry-name pgy-creator-name">${nameMarkup}</div><div class="pgy-review-entry-id pgy-creator-meta">${storage.displayRedId(item) ? `小红书号：${esc(storage.displayRedId(item))}` : '红书号待详情页补充'}</div><small class="pgy-creator-meta">${excludedAt ? `排除时间：${esc(excludedAt)} · ` : ''}${esc(item.exclusionSource)}</small></div><button class="pgy-review-row-action pgy-creator-action" data-restore-one="${esc(item.redId)}">恢复</button></div>`;
      }).join('') : '<div class="pgy-creator-empty">暂无匹配达人</div>';
      // Keep live buttons in place during periodic page scans. Replacing them
      // while a pointer is pressed can discard a user's restore click.
      if (lastExcludedMarkup !== excludedMarkup) { q('[data-excluded-list]').innerHTML = excludedMarkup; lastExcludedMarkup = excludedMarkup; }
      q('[data-restore]').textContent = `恢复所选（${selection.size}）`;
      q('[data-restore]').disabled = !selection.size;
      q('[data-export-excluded]').disabled = !excluded.length;
      const selectAll = q('[data-select-all]');
      const selectedVisible = visible.filter(item => selection.has(item.redId)).length;
      selectAll.disabled = tab !== 'excluded' || !visible.length;
      selectAll.checked = visible.length > 0 && selectedVisible === visible.length;
      selectAll.indeterminate = selectedVisible > 0 && selectedVisible < visible.length;
      q('[data-select-all-label]').textContent = query ? `全选搜索结果（${visible.length}）` : `全选（${visible.length}）`;
      if (getPageCreators) {
        const page = getPageCreators();
        const added = page.filter(item => storage.findCreator(cart.creators, item)).length;
        const removed = page.filter(item => storage.findCreator(cart.excluded, item)).length;
        q('[data-page-summary]').textContent = `本页 ${page.length} 位 · 已添加 ${added} · ${cart.hideExcluded ? '已隐藏' : '已排除'} ${removed} · 待筛选 ${page.length - added - removed}`;
        q('[data-finish]').disabled = page.length - added - removed === 0;
        const unresolved = getPageStatus?.().unresolved || 0;
        if (unresolved) { q('[data-page-summary]').textContent += ` · 未识别 ${unresolved}（暂停批量筛选）`; q('[data-finish]').disabled = true; }
        q('[data-undo]').disabled = !cart.lastScreening;
        q('[data-hide]').checked = cart.hideExcluded;
      }
    }
    area.addEventListener('click', event => {
      const button = event.target.closest('button'); if (!button) return;
      const snapshot = getSnapshot(), id = snapshot.activeProjectId;
      if (button.dataset.tab) { tab = button.dataset.tab; selection.clear(); render(); }
      if (button.hasAttribute('data-reset')) { queries.set(queryKey(), ''); selection.clear(); render(); q('[data-search]').focus(); }
      if (button.hasAttribute('data-finish')) run(async () => {
        button.disabled = true;
        if (getPageStatus?.().unresolved) throw new Error('存在未识别达人，未执行批量排除');
        const next = await storage.excludeCreators(getPageCreators(), id);
        const batch = next.carts[id].lastScreening;
        q('[data-message]').textContent = `本页筛选完成，新增排除 ${batch?.ids.length || 0} 位；已添加达人已保留。`;
      });
      if (button.hasAttribute('data-undo')) run(async () => { await storage.undoScreening(id); q('[data-message]').textContent = '已撤销最近一次本页筛选新增的排除记录'; });
      if (button.hasAttribute('data-restore-one')) run(() => storage.restoreCreators([button.dataset.restoreOne], id));
      if (button.hasAttribute('data-restore')) run(() => storage.restoreCreators([...selection], id));
      if (button.hasAttribute('data-export-excluded')) xlsx.download(Object.values(snapshot.carts[id].excluded), `蒲公英_排除名单_${snapshot.projects[id].name.replace(/[\\/:*?"<>|]/g, '_')}.xlsx`, { excluded: true });
    });
    q('[data-search]').addEventListener('input', event => { queries.set(queryKey(), event.target.value); selection.clear(); render(); });
    cartActions.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button || !setCartSelection) return;
      const snapshot = getSnapshot(), id = snapshot.activeProjectId, cart = snapshot.carts[id];
      const query = queries.get(queryKey()) || '';
      const visibleIds = storage.creatorsAsList(cart).filter(item => storage.matchesSearch(item, query)).map(item => item.redId);
      if (button.hasAttribute('data-cart-select-visible')) setCartSelection(visibleIds, true);
      if (button.hasAttribute('data-cart-clear-visible')) setCartSelection(visibleIds, false);
    });
    area.addEventListener('change', event => {
      if (event.target.hasAttribute('data-select')) { event.target.checked ? selection.add(event.target.dataset.select) : selection.delete(event.target.dataset.select); render(); }
      if (event.target.hasAttribute('data-select-all')) {
        const snapshot = getSnapshot(), id = snapshot.activeProjectId;
        const query = queries.get(queryKey()) || '';
        const visible = Object.values(snapshot.carts[id].excluded).filter(item => storage.matchesSearch(item, query));
        for (const item of visible) event.target.checked ? selection.add(item.redId) : selection.delete(item.redId);
        render();
      }
      if (event.target.hasAttribute('data-hide')) run(() => storage.setHideExcluded(event.target.checked, getSnapshot().activeProjectId));
    });
    return { render };
  };
})(globalThis);
