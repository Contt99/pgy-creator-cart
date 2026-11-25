(() => {
  'use strict';
  const db = window.PGYCartStorage;
  const { creators, initialBackup } = window.CreatorCartDemo;
  const $ = selector => document.querySelector(selector);
  const byId = new Map(creators.map(creator => [creator.redId, creator]));
  const categories = ['全部', ...new Set(creators.map(creator => creator.category))];
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const number = new Intl.NumberFormat('zh-CN');
  const fans = value => `${(value / 10000).toFixed(1)} 万`;
  const money = value => `¥${number.format(value)}`;
  const art = [
    ['#e6dafe', '#4c376d', '#f1b496', '#9b7bda', 'M8 27c-3-13 4-22 13-22 11 0 15 10 13 20l-5 5h-3V16c-7 5-11 5-14 7v7z'],
    ['#cde9de', '#3b5144', '#eda882', '#6ba885', 'M9 27C5 14 10 6 20 6c9 0 15 9 12 20l-6-3v-8c-6 4-10 6-14 7v5z'],
    ['#f9dfb9', '#473b36', '#ce8e64', '#c4784c', 'M9 23C8 13 9 9 17 8c8-2 15 2 15 13l-4 1-2-7-14 4-1 6z'],
    ['#f1d7df', '#43364c', '#d19175', '#985b76', 'M8 24C7 14 10 8 20 8c10 0 14 6 12 15l-3 3-2-8c-4 1-9-2-11-5l-4 9z'],
    ['#d5e4fb', '#35405c', '#ecb391', '#7394ce', 'M7 27C6 15 12 5 21 5c9 0 14 12 12 22l-6 4V17c-6 0-10-2-13-4l-2 17z'],
    ['#f2dec7', '#553d37', '#e8a67c', '#bb8256', 'M7 27C7 14 9 7 20 7c11 0 15 8 14 20l-6 2-1-10c-7 0-10-3-12-5l-3 14z']
  ];
  function avatar(creator) {
    const [background, hair, skin, shirt, shape] = art[creator.art - 1];
    return `<svg class="avatar" viewBox="0 0 42 42" aria-hidden="true">
      <rect width="42" height="42" fill="${background}"/><circle cx="33" cy="12" r="7" fill="#fff" opacity=".38"/>
      <path d="M3 42c1-8 8-13 18-13s17 5 18 13" fill="${shirt}"/><rect x="18" y="23" width="6" height="9" rx="3" fill="${skin}"/>
      <ellipse cx="21" cy="20" rx="9" ry="10" fill="${skin}"/><path d="${shape}" fill="${hair}"/>
      <path d="M18 21h.1m6 0h.1" stroke="#312b3e" stroke-width="1.2" stroke-linecap="round"/><path d="M19 25q2 1.5 4 0" stroke="#944f47" stroke-width=".8" fill="none" stroke-linecap="round"/>
    </svg>`;
  }

  let state;
  let view = 'all', category = '全部', query = '';
  let detailId = null, mutating = false, noticeTimeout;
  let unchecked = new Map();
  const cart = () => state.carts[state.activeProjectId];
  const project = () => state.projects[state.activeProjectId];
  const selection = () => {
    if (!unchecked.has(state.activeProjectId)) unchecked.set(state.activeProjectId, new Set());
    return unchecked.get(state.activeProjectId);
  };

  function announce(message, failure = false) {
    const notice = $('#notice');
    clearTimeout(noticeTimeout);
    notice.classList.toggle('failure', failure);
    notice.textContent = message;
    if (!failure) noticeTimeout = setTimeout(() => { notice.textContent = ''; }, 3700);
  }
  function button(action, creator, text, style, symbol = '') {
    return `<button type="button" class="${style}" data-action="${action}" data-creator="${creator.redId}">${symbol ? icon(symbol) : ''}${text}</button>`;
  }
  function actions(creator, detailed = false) {
    if (cart().excluded[creator.redId]) return button('restore', creator, '恢复', 'secondary', 'reset');
    if (cart().creators[creator.redId]) return button('remove', creator, '移出购物车', 'secondary saved');
    return button('add', creator, '加入购物车', detailed ? 'primary' : 'secondary add', 'plus') +
      button('exclude', creator, '排除', 'muted', detailed ? 'eye-off' : '');
  }
  function renderDirectory() {
    const excluded = cart().excluded;
    const visible = creators.filter(creator => ((view === 'excluded') === Boolean(excluded[creator.redId])) &&
      (category === '全部' || creator.category === category) && db.matchesSearch(creator, query));
    $('#total-count').textContent = creators.length - Object.keys(excluded).length;
    $('#excluded-count').textContent = Object.keys(excluded).length;
    for (const tab of ['all', 'excluded']) $(`#view-${tab}`).setAttribute('aria-pressed', String(view === tab));
    for (const filter of $('#categories').children) filter.setAttribute('aria-pressed', String(category === filter.dataset.category));
    $('#result-count').textContent = `${visible.length} 位达人`;
    $('#directory-table').hidden = !visible.length;
    $('#no-results').hidden = Boolean(visible.length);
    $('#no-results').textContent = view === 'excluded' && !Object.keys(excluded).length ? '还没有排除的达人' : '没有符合条件的达人';
    $('#creators').innerHTML = visible.map(creator => `<tr>
      <td class="identity-cell">${avatar(creator)}<span><button type="button" class="name" data-action="detail" data-creator="${creator.redId}">${creator.name}</button><small>${creator.redId} / ${creator.city}</small></span></td>
      <td class="category-cell"><span class="category-label" data-kind="${creator.category}">${creator.category}</span></td>
      <td class="metric" data-label="粉丝量">${fans(creator.followers)}</td><td class="metric" data-label="互动中位数">${number.format(creator.interactions)}</td>
      <td class="row-actions">${actions(creator)}</td></tr>`).join('');
  }
  function renderCart() {
    const list = db.creatorsAsList(cart());
    $('#cart-count').textContent = list.length;
    $('#empty-cart').hidden = Boolean(list.length);
    $('#select-all-label').hidden = !list.length;
    $('#cart-list').innerHTML = list.map(creator => `<li>
      <input type="checkbox" data-action="select" data-creator="${creator.redId}" aria-label="选择 ${creator.name}" ${selection().has(creator.redId) ? '' : 'checked'}>
      ${avatar(creator)}<div><button type="button" class="name" data-action="detail" data-creator="${creator.redId}">${creator.name}</button><small>${creator.category} / ${fans(creator.followers)} 粉丝</small></div>
      <button type="button" class="icon-button cart-remove" data-action="remove" data-creator="${creator.redId}" aria-label="移出 ${creator.name}" title="移出购物车">${icon('x')}</button>
    </li>`).join('');
    renderSelection();
  }
  function renderSelection() {
    const list = db.creatorsAsList(cart());
    const selected = list.filter(creator => !selection().has(creator.redId)).length;
    $('#select-all').checked = list.length > 0 && selected === list.length;
    $('#select-all').indeterminate = selected > 0 && selected < list.length;
    $('#export').disabled = !selected;
    $('#selection-summary').textContent = list.length ? `已选 ${selected} / ${list.length} 位，仅导出已勾选达人` : '仅导出当前项目中勾选的达人';
  }
  function render() {
    $('#project-select').innerHTML = state.projectOrder.map(id => `<option value="${escape(id)}">${escape(state.projects[id].name)}</option>`).join('');
    $('#project-select').value = state.activeProjectId;
    const focused = document.activeElement;
    const { action, creator } = focused.dataset;
    const zone = focused.closest('#cart-list') ? '#cart-list' : '#creators';
    renderDirectory();
    renderCart();
    if (action && creator && !focused.isConnected) {
      const replacement = $(`${zone} [data-action="${action}"][data-creator="${creator}"]`) || $(`${zone} .name[data-creator="${creator}"]`);
      (replacement || $(view === 'excluded' ? '#view-excluded' : '#view-all')).focus({ preventScroll: true });
    }
  }

  function openDetail(creator) {
    detailId = creator.redId;
    $('#detail-content').innerHTML = `
      <div class="detail-profile">${avatar(creator)}<div><p class="detail-label">达人档案 / 演示数据</p><h2 id="detail-title">${creator.name}</h2><p>${creator.redId} / ${creator.city} / ${creator.category}</p></div></div>
      <p class="detail-bio">${creator.bio}</p>
      <dl class="detail-metrics"><div><dt>粉丝量</dt><dd>${fans(creator.followers)}</dd></div><div><dt>互动中位数</dt><dd>${number.format(creator.interactions)}</dd></div><div><dt>图文报价</dt><dd>${money(creator.image)}</dd></div><div><dt>视频报价</dt><dd>${money(creator.video)}</dd></div></dl>
      <div class="audience"><h3>粉丝画像</h3><div class="audience-split"><span>女性 ${creator.female}%</span><span>男性 ${100 - creator.female}%</span></div><div class="audience-bar" aria-hidden="true"><span style="width:${creator.female}%"></span></div><p>${creator.fanRegionDistribution}</p></div>
      <div class="dialog-actions"><span class="detail-project">当前项目：${escape(project().name)}</span>${actions(creator, true)}</div>`;
    $('#detail').showModal();
  }
  async function mutate(operation, after = () => {}) {
    if (mutating || !state) return;
    mutating = true;
    try {
      state = await operation();
      after();
      render();
    } catch (error) {
      announce(`未能保存：${error.message}`, true);
    } finally {
      mutating = false;
    }
  }
  const transitions = {
    add: [creator => db.upsertCreator(creator), '已加入购物车'],
    remove: [creator => db.removeCreator(creator.redId), '已移出购物车'],
    exclude: [creator => db.excludeCreators([creator], state.activeProjectId, '手动排除'), '已排除'],
    restore: [creator => db.restoreCreators([creator.redId], state.activeProjectId), '已恢复到达人目录']
  };

  async function init() {
    const stored = await chrome.storage.local.get([db.STORAGE_KEY]);
    state = stored[db.STORAGE_KEY] ? await db.getState() : await db.restoreBackup(initialBackup());
    $('#categories').innerHTML = categories.map(name => `<button type="button" data-category="${name}">${name}</button>`).join('');
    $('#project-select').disabled = $('#open-create').disabled = false;
    render();
  }

  document.addEventListener('click', event => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.hasAttribute('data-dismiss')) return target.closest('dialog').close();
    if (!state) return;
    const { action, creator: id, category: nextCategory } = target.dataset;
    if (nextCategory) {
      category = nextCategory;
      return renderDirectory();
    }
    if (target.id === 'view-all' || target.id === 'view-excluded') {
      view = target.id === 'view-all' ? 'all' : 'excluded';
      return renderDirectory();
    }
    const creator = byId.get(id);
    if (action === 'detail') return openDetail(creator);
    if (creator && Object.hasOwn(transitions, action)) {
      const [operation, message] = transitions[action];
      return mutate(() => operation(creator), () => {
        selection().delete(id);
        if ($('#detail').open && detailId === id) $('#detail').close();
        announce(`${creator.name}${message}`);
      });
    }
    if (target.id === 'open-create') {
      $('#create-form').reset();
      $('#create-error').textContent = '';
      return $('#create').showModal();
    }
    if (target.id === 'open-reset') return $('#reset').showModal();
    if (target.id === 'confirm-reset') return mutate(() => db.restoreBackup(initialBackup()), () => {
      unchecked = new Map();
      view = 'all'; category = '全部'; query = '';
      $('.search input').value = '';
      $('#reset').close();
      announce('已恢复演示初始数据');
    });
    if (target.id === 'export') {
      const list = db.creatorsAsList(cart()).filter(creator => !selection().has(creator.redId));
      if (!list.length) return;
      const name = project().name;
      PGYXlsx.download(list, `${name.replace(/[<>:"/\\|?*]/g, '-')}-达人名单.xlsx`, { projectName: name });
      announce(`已导出 ${list.length} 位达人`);
    }
  });
  $('.search input').addEventListener('input', event => {
    query = event.target.value;
    if (state) renderDirectory();
  });
  $('#project-select').addEventListener('change', event => {
    const id = event.target.value;
    mutate(() => db.setActiveProject(id), () => announce(`已切换至${project().name}`));
  });
  $('#select-all').addEventListener('change', event => {
    selection().clear();
    if (!event.target.checked) for (const id of cart().order) selection().add(id);
    for (const checkbox of $('#cart-list').querySelectorAll('input')) checkbox.checked = event.target.checked;
    renderSelection();
  });
  $('#cart-list').addEventListener('change', event => {
    if (event.target.dataset.action !== 'select') return;
    const id = event.target.dataset.creator;
    if (event.target.checked) selection().delete(id);
    else selection().add(id);
    renderSelection();
  });
  $('#create-form').addEventListener('submit', event => {
    event.preventDefault();
    const name = $('#project-name').value.trim();
    if (!name) {
      $('#create-error').textContent = '请输入项目名称';
      $('#project-name').focus();
      return;
    }
    mutate(() => db.createProject(name), () => {
      view = 'all';
      $('#create').close();
      announce(`已创建项目「${project().name}」`);
    });
  });
  init().catch(() => announce('演示无法使用浏览器本地存储。请允许网站保存数据后重新打开。', true));
})();
