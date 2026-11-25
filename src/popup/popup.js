(function initPopup() {
  'use strict';

  const storage = globalThis.PGYCartStorage;
  const xlsx = globalThis.PGYXlsx;
  const selectedRedIds = new Set();
  let snapshot;
  let selectedProjectId = '';
  let undoRemoval = null;
  let undoTimer = 0;

  const elements = {
    totalCount: document.querySelector('[data-total-count]'),
    projectSelect: document.querySelector('[data-project-select]'),
    deleteProject: document.querySelector('[data-delete-project]'),
    projectForm: document.querySelector('[data-project-form]'),
    projectName: document.querySelector('[data-project-name]'),
    projectSummary: document.querySelector('[data-project-summary]'),
    creatorList: document.querySelector('[data-creator-list]'),
    selectAll: document.querySelector('[data-select-all]'),
    clearSelection: document.querySelector('[data-clear-selection]'),
    clearCart: document.querySelector('[data-clear-cart]'),
    export: document.querySelector('[data-export]'),
    status: document.querySelector('[data-status]'),
    undoRemove: document.querySelector('[data-undo-remove]'),
    backup: document.querySelector('[data-backup]'),
    restoreBackup: document.querySelector('[data-restore-backup]'),
    backupFile: document.querySelector('[data-backup-file]')
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeFilenamePart(value) {
    return String(value || '').replace(/[\\/:*?"<>|]/g, '_').trim() || '默认项目';
  }

  function metricNumber(value) {
    const matches = String(value || '').match(/(?:\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(?:万|亿|[wWkK])?/g);
    return matches && matches.length ? matches[0].replace(/\s+/g, '') : '';
  }

  function storedMetric(creator, property, aliases) {
    if (creator && creator[property]) return creator[property];
    const fields = creator && creator.capturedFields && typeof creator.capturedFields === 'object'
      ? creator.capturedFields
      : {};
    for (const [key, values] of Object.entries(fields)) {
      if (!aliases.some((alias) => key.includes(alias))) continue;
      for (const value of values) {
        const result = metricNumber(value);
        if (result) return result;
      }
    }
    return '—';
  }

  function activeProject() {
    return snapshot.projects[snapshot.activeProjectId];
  }

  function activeCart() {
    return snapshot.carts[snapshot.activeProjectId];
  }

  function activeCreators() {
    return storage.creatorsAsList(activeCart());
  }

  function setStatus(message, isError) {
    elements.status.textContent = message;
    elements.status.style.color = isError ? '#ff2442' : '#148957';
  }

  function downloadJson(data, filename) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function downloadBackup(prefix = '蒲公英达人购物车备份') {
    const backup = await storage.createBackup();
    downloadJson(backup, `${prefix}_${backup.exportedAt.slice(0, 10)}.json`);
  }

  function offerRemovalUndo({ creator, projectId, index, excluded }) {
    clearTimeout(undoTimer);
    undoRemoval = () => storage.restoreRemovedCreator(creator, projectId, index);
    elements.undoRemove.hidden = false;
    setStatus(excluded ? `已将“${creator.name || creator.redId}”移除并排除` : `已移除“${creator.name || creator.redId}”`);
    undoTimer = setTimeout(() => { undoRemoval = null; elements.undoRemove.hidden = true; }, 6500);
  }

  function syncSelection(creators) {
    if (selectedProjectId !== snapshot.activeProjectId) {
      selectedProjectId = snapshot.activeProjectId;
      selectedRedIds.clear();
      creators.forEach((creator) => selectedRedIds.add(creator.redId));
      return;
    }
    const available = new Set(creators.map((creator) => creator.redId));
    for (const redId of [...selectedRedIds]) {
      if (!available.has(redId)) selectedRedIds.delete(redId);
    }
  }

  let reviewUI;
  function render() {
    renderContent();
    if (reviewUI) reviewUI.render();
  }
  function renderContent() {
    if (!snapshot) return;
    const project = activeProject();
    const creators = activeCreators();
    syncSelection(creators);
    const allCount = snapshot.projectOrder.reduce((sum, projectId) => sum + snapshot.carts[projectId].order.length, 0);
    elements.totalCount.textContent = String(allCount);
    elements.projectSelect.innerHTML = snapshot.projectOrder.map((projectId) => {
      const item = snapshot.projects[projectId];
      const count = snapshot.carts[projectId].order.length;
      const selected = projectId === snapshot.activeProjectId ? ' selected' : '';
      return `<option value="${escapeHtml(projectId)}"${selected}>${escapeHtml(item.name)}（${count}）</option>`;
    }).join('');
    elements.deleteProject.disabled = snapshot.projectOrder.length <= 1;
    elements.projectSummary.textContent = `${project.name}：${creators.length} 位达人，已选 ${selectedRedIds.size} 位`;
    elements.export.textContent = `下载 Excel（${selectedRedIds.size}）`;
    elements.export.disabled = selectedRedIds.size === 0;
    elements.clearCart.disabled = creators.length === 0;

    if (!creators.length) {
      elements.creatorList.innerHTML = `<div class="empty-state pgy-creator-empty">“${escapeHtml(project.name)}”还没有达人<br>请在蒲公英页面中点击“加入购物车”</div>`;
      return;
    }

    elements.creatorList.innerHTML = creators.map((creator) => {
      const followers = storedMetric(creator, 'followersCount', ['粉丝量', '粉丝数', '粉丝']);
      const likeCollect = storedMetric(creator, 'likeCollectCount', ['获赞与收藏', '赞藏量', '赞藏数', '赞藏中位数', '赞藏']);
      const addedAt = storage.formatLocalDateTime(creator.firstAddedAt || creator.lastUpdatedAt);
      const detailUpdatedAt = storage.formatLocalDateTime(creator.lastDetailUpdatedAt);
      const detailUrl = storage.cartDetailUrl(creator, snapshot.activeProjectId);
      const creatorName = escapeHtml(creator.name || creator.redId);
      const nameMarkup = detailUrl ? `<a class="creator-name pgy-creator-name pgy-creator-name-link" href="${escapeHtml(detailUrl)}" target="_blank" rel="noopener noreferrer" title="打开主页并自动更新数据">${creatorName}</a>` : `<div class="creator-name pgy-creator-name">${creatorName}</div>`;
      return `<div class="creator-item pgy-creator-row" data-red-id="${escapeHtml(creator.redId)}">
        <input class="pgy-creator-select" type="checkbox" aria-label="选择 ${escapeHtml(creator.name || creator.redId)}"${selectedRedIds.has(creator.redId) ? ' checked' : ''}>
        <div class="pgy-creator-content">${nameMarkup}<div class="creator-id pgy-creator-meta">小红书号：${escapeHtml(storage.displayRedId(creator) || '待详情页补充')}</div><div class="creator-stats pgy-creator-meta pgy-creator-meta-primary">粉丝量：${escapeHtml(followers)} · 获赞与收藏：${escapeHtml(likeCollect)}</div>${addedAt ? `<div class="creator-stats pgy-creator-meta pgy-creator-meta-primary">添加时间：${escapeHtml(addedAt)}</div>` : ''}${detailUpdatedAt ? `<div class="creator-stats creator-updated pgy-creator-meta pgy-creator-meta-success">已从主页更新 · ${escapeHtml(detailUpdatedAt)}</div>` : ''}</div>
        <div class="pgy-cart-row-actions pgy-creator-actions"><button type="button" class="remove-button pgy-creator-action" aria-label="移除 ${escapeHtml(creator.name || creator.redId)}">移除</button></div>
      </div>`;
    }).join('');

    for (const item of elements.creatorList.querySelectorAll('[data-red-id]')) {
      const redId = item.dataset.redId;
      item.querySelector('input').addEventListener('change', (event) => {
        if (event.target.checked) selectedRedIds.add(redId);
        else selectedRedIds.delete(redId);
        render();
      });
      item.querySelector('.remove-button').addEventListener('click', async () => {
        const creator = activeCart().creators[redId];
        const index = activeCart().order.indexOf(redId);
        await storage.removeCreator(redId, snapshot.activeProjectId);
        offerRemovalUndo({ creator, projectId: snapshot.activeProjectId, index, excluded: false });
      });
    }
  }

  elements.projectSelect.addEventListener('change', async (event) => {
    await storage.setActiveProject(event.target.value);
    setStatus('项目已切换');
  });

  elements.projectForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const name = elements.projectName.value.trim();
      await storage.createProject(name);
      elements.projectName.value = '';
      setStatus(`已创建项目“${name}”`);
    } catch (error) {
      setStatus(error.message || '创建失败', true);
    }
  });

  elements.deleteProject.addEventListener('click', async () => {
    const project = activeProject();
    if (!confirm(`确定删除项目“${project.name}”及其中的全部达人和排除记录吗？`)) return;
    try {
      await storage.removeProject(project.id);
      setStatus(`已删除项目“${project.name}”`);
    } catch (error) {
      setStatus(error.message || '删除失败', true);
    }
  });

  elements.selectAll.addEventListener('click', () => {
    activeCreators().forEach((creator) => selectedRedIds.add(creator.redId));
    render();
  });

  elements.clearSelection.addEventListener('click', () => {
    selectedRedIds.clear();
    render();
  });

  elements.clearCart.addEventListener('click', async () => {
    const project = activeProject();
    if (!confirm(`确定清空“${project.name}”中的购物车达人吗？排除名单将保留。`)) return;
    await storage.clearCart(project.id);
    setStatus(`已清空“${project.name}”`);
  });

  elements.export.addEventListener('click', () => {
    const project = activeProject();
    const creators = activeCreators().filter((creator) => selectedRedIds.has(creator.redId));
    if (!creators.length) return;
    xlsx.download(creators, `蒲公英_${safeFilenamePart(project.name)}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    setStatus(`已导出 ${creators.length} 位达人`);
  });

  elements.undoRemove.addEventListener('click', async () => {
    const action = undoRemoval;
    if (!action) return;
    undoRemoval = null;
    clearTimeout(undoTimer);
    elements.undoRemove.hidden = true;
    try { await action(); setStatus('已恢复达人'); } catch (error) { setStatus(error.message || '撤销失败，请重试', true); }
  });
  elements.backup.addEventListener('click', async () => {
    try { await downloadBackup(); setStatus('备份已下载'); } catch (error) { setStatus(error.message || '备份失败，请重试', true); }
  });
  elements.restoreBackup.addEventListener('click', () => elements.backupFile.click());
  elements.backupFile.addEventListener('change', async event => {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      if (!backup || backup.format !== 'pgy-creator-cart-backup' || !backup.state) throw new Error('备份文件格式不正确');
      if (!confirm('恢复备份将替换当前全部项目、购物车和排除记录。继续前会自动下载当前数据备份，是否恢复？')) return;
      await downloadBackup('恢复前自动备份');
      await storage.restoreBackup(backup);
      setStatus('备份恢复完成');
    } catch (error) { setStatus(error.message || '恢复失败，请检查备份文件', true); }
  });

  reviewUI = globalThis.PGYReviewUI({
    host: document.body,
    list: elements.creatorList,
    storage,
    xlsx,
    getSnapshot: () => snapshot,
    refresh: async () => { snapshot = await storage.getState(); render(); },
    getCartSelection: () => selectedRedIds,
    setCartSelection: (ids, checked) => {
      for (const id of ids) checked ? selectedRedIds.add(id) : selectedRedIds.delete(id);
      render();
    },
    onCartRemoved: offerRemovalUndo
  });
  storage.subscribe((nextSnapshot) => {
    snapshot = nextSnapshot;
    render();
  });

  storage.getState().then((initialSnapshot) => {
    snapshot = initialSnapshot;
    render();
  }).catch((error) => setStatus(error.message || '读取本地数据失败', true));
})();
