(function initPgyCartStorage(root) {
  'use strict';

  const STORAGE_KEY = 'pgyCreatorCartV2';
  const LEGACY_KEY = 'pgyCreatorCartV1';
  const BATCH_STORAGE_KEY = 'pgyCreatorCartBatchV1';
  const STORAGE_VERSION = 2;
  const DEFAULT_PROJECT_ID = 'default';

  function normalizeRedId(value) {
    return String(value || '')
      .normalize('NFC')
      .replace(/^小红书号\s*[:：]?\s*/u, '')
      .trim();
  }

  function profileId(creator) {
    if (!creator) return '';
    if (/^[a-f0-9]{24}$/i.test(creator.profileId || '')) return creator.profileId.toLowerCase();
    for (const value of [creator.pgyUrl, creator.homepageUrl, creator.profileUrl]) {
      try {
        const url = new URL(value);
        if (!/(^|\.)xiaohongshu\.com$/i.test(url.hostname)) continue;
        const match = url.pathname.match(/\/(?:blogger-detail|user\/profile)\/([a-f0-9]{24})(?:\/|$)/i);
        if (match) return match[1].toLowerCase();
      } catch { /* Older records may not contain a URL. */ }
    }
    return /^pgy:[a-f0-9]{24}$/i.test(creator.redId || '') ? creator.redId.slice(4).toLowerCase() : '';
  }

  function sameCreator(left, right) {
    if (!left || !right) return false;
    const a = profileId(left), b = profileId(right);
    if (a && b) return a === b;
    return Boolean(left.redId && normalizeRedId(left.redId) === normalizeRedId(right.redId));
  }

  function findCreator(records, creator) {
    return Object.values(records || {}).find(item => sameCreator(item, creator));
  }

  function displayRedId(creator) {
    return /^pgy:[a-f0-9]{24}$/i.test(creator?.redId || '') ? '' : (creator?.redId || '');
  }

  function formatLocalDateTime(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = number => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  function creatorDetailUrl(creator) {
    const id = profileId(creator);
    return id ? `https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/${id}` : '';
  }

  function cartDetailUrl(creator, projectId) {
    const detailUrl = creatorDetailUrl(creator);
    if (!detailUrl || !projectId) return '';
    const url = new URL(detailUrl);
    // A fragment stays in the browser; local project metadata is not sent to Pgy.
    url.hash = new URLSearchParams({'pgy-cart-project': projectId}).toString();
    return url.href;
  }

  function isMeaningful(value) {
    if (value == null) return false;
    if (typeof value === 'string') return !/^(?:\s*|--?|—|暂无|未加载|null|undefined)$/i.test(value.trim());
    if (Array.isArray(value)) return value.some(isMeaningful);
    return typeof value !== 'object' || Object.keys(value).length > 0;
  }

  async function updateExistingCreatorsInProjects(input, projectIds) {
    const state = await getState();
    const patch = Object.fromEntries(Object.entries(input).filter(([key,value]) =>
      !['projectId','projectName','firstAddedAt','lastUpdatedAt','lastDetailUpdatedAt'].includes(key) && isMeaningful(value)));
    const now = new Date().toISOString();
    let changed = false;
    for (const projectId of projectIds) {
      const cart = state.carts[projectId];
      const existing = cart && findCreator(cart.creators, input);
      // An open details tab must never recreate a removed/excluded creator.
      if (!existing) continue;
      const redId = displayRedId(input) ? normalizeRedId(input.redId) : existing.redId;
      const fields = {...existing.capturedFields};
      for (const [key,value] of Object.entries(input.capturedFields || {})) if (isMeaningful(value)) fields[key] = value;
      const updated = {...existing,...patch,redId,capturedFields:fields};
      if (JSON.stringify(updated) === JSON.stringify(existing)) continue;
      updated.lastUpdatedAt = now;
      updated.lastDetailUpdatedAt = now;
      updated.projectId = projectId;
      updated.projectName = state.projects[projectId].name;
      if (redId !== existing.redId) {
        delete cart.creators[existing.redId];
        cart.order = cart.order.map(key => key === existing.redId ? redId : key);
      }
      cart.creators[redId] = updated;
      state.projects[projectId].updatedAt = now;
      changed = true;
    }
    return changed ? writeState(state) : state;
  }

  function updateExistingCreator(input, projectId) {
    return updateExistingCreatorsInProjects(input, [projectId]);
  }

  async function updateMatchingCreators(input) {
    const state = await getState();
    return updateExistingCreatorsInProjects(input, state.projectOrder);
  }

  function defaultProject(now) {
    return {
      id: DEFAULT_PROJECT_ID,
      name: '默认项目',
      createdAt: now,
      updatedAt: now
    };
  }

  function emptyCart() {
    return { creators: {}, order: [], excluded: {}, hideExcluded: false, lastScreening: null };
  }

  function emptyState() {
    const now = new Date().toISOString();
    return {
      version: STORAGE_VERSION,
      activeProjectId: DEFAULT_PROJECT_ID,
      projects: { [DEFAULT_PROJECT_ID]: defaultProject(now) },
      projectOrder: [DEFAULT_PROJECT_ID],
      carts: { [DEFAULT_PROJECT_ID]: emptyCart() }
    };
  }

  function normalizeCart(input) {
    const cart = input && typeof input === 'object' ? input : emptyCart();
    const creators = cart.creators && typeof cart.creators === 'object' ? cart.creators : {};
    const order = Array.isArray(cart.order) ? cart.order : [];
    const normalizedCreators = {};

    for (const [key, value] of Object.entries(creators)) {
      const redId = normalizeRedId(value && value.redId ? value.redId : key);
      if (!redId || !value || typeof value !== 'object') continue;
      normalizedCreators[redId] = { ...value, redId };
    }

    const normalizedOrder = [];
    for (const value of order) {
      const redId = normalizeRedId(value);
      if (normalizedCreators[redId] && !normalizedOrder.includes(redId)) normalizedOrder.push(redId);
    }
    for (const redId of Object.keys(normalizedCreators)) {
      if (!normalizedOrder.includes(redId)) normalizedOrder.push(redId);
    }
    const excluded = {};
    for (const [key, value] of Object.entries(cart.excluded || {})) {
      const redId = normalizeRedId(key);
      if (redId && value && typeof value === 'object' && !normalizedCreators[redId]) excluded[redId] = { ...value, redId };
    }
    return { creators: normalizedCreators, order: normalizedOrder, excluded, hideExcluded: cart.hideExcluded === true,
      lastScreening: cart.lastScreening || null };
  }

  function normalizeState(input) {
    if (!input || typeof input !== 'object') return emptyState();
    const fallback = emptyState();
    const projects = {};
    const sourceProjects = input.projects && typeof input.projects === 'object' ? input.projects : {};

    for (const [key, value] of Object.entries(sourceProjects)) {
      const id = String(value && value.id ? value.id : key).trim();
      const name = String(value && value.name ? value.name : '').trim().slice(0, 30);
      if (!id || !name) continue;
      projects[id] = {
        id,
        name,
        createdAt: value.createdAt || new Date().toISOString(),
        updatedAt: value.updatedAt || value.createdAt || new Date().toISOString()
      };
    }

    if (!Object.keys(projects).length) projects[DEFAULT_PROJECT_ID] = fallback.projects[DEFAULT_PROJECT_ID];

    const projectOrder = [];
    const sourceOrder = Array.isArray(input.projectOrder) ? input.projectOrder : [];
    for (const value of sourceOrder) {
      const id = String(value);
      if (projects[id] && !projectOrder.includes(id)) projectOrder.push(id);
    }
    for (const id of Object.keys(projects)) {
      if (!projectOrder.includes(id)) projectOrder.push(id);
    }

    const carts = {};
    const sourceCarts = input.carts && typeof input.carts === 'object' ? input.carts : {};
    for (const id of projectOrder) carts[id] = normalizeCart(sourceCarts[id]);

    const requestedActiveId = String(input.activeProjectId || '');
    const activeProjectId = projects[requestedActiveId] ? requestedActiveId : projectOrder[0];
    return { version: STORAGE_VERSION, activeProjectId, projects, projectOrder, carts };
  }

  function migrateLegacy(legacy) {
    const state = emptyState();
    if (legacy && typeof legacy === 'object') state.carts[DEFAULT_PROJECT_ID] = normalizeCart(legacy);
    return state;
  }

  async function getState() {
    const result = await chrome.storage.local.get([STORAGE_KEY, LEGACY_KEY]);
    if (result[STORAGE_KEY]) return normalizeState(result[STORAGE_KEY]);
    const state = migrateLegacy(result[LEGACY_KEY]);
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
    return state;
  }

  async function writeState(state) {
    const normalized = normalizeState(state);
    await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
    return normalized;
  }

  async function getBatchJob() {
    const result = await chrome.storage.local.get([BATCH_STORAGE_KEY]);
    const job = result[BATCH_STORAGE_KEY];
    return job && typeof job === 'object' && job.id ? job : null;
  }

  async function updateBatchJob(jobId, update) {
    const current = await getBatchJob();
    if (jobId && current && current.id !== jobId) return current;
    const next = typeof update === 'function' ? update(current) : update;
    await chrome.storage.local.set({ [BATCH_STORAGE_KEY]: next || null });
    return next || null;
  }

  async function advanceBatchJob(jobId, expectedProfileId, patch) {
    return updateBatchJob(jobId, current => {
      if (!current || current.status !== 'running') return current;
      const expected = current.queue && current.queue[current.index];
      if (!expected || String(expected.profileId || '').toLowerCase() !== String(expectedProfileId || '').toLowerCase()) return current;
      return {
        ...current,
        ...(patch || {}),
        index: current.index + 1,
        success: (current.success || 0) + 1,
        updatedAt: new Date().toISOString()
      };
    });
  }

  async function getCart(projectIdInput) {
    const state = await getState();
    const projectId = projectIdInput && state.projects[projectIdInput] ? projectIdInput : state.activeProjectId;
    return { state, project: state.projects[projectId], projectId, cart: state.carts[projectId] };
  }

  async function setActiveProject(projectIdInput) {
    const projectId = String(projectIdInput || '');
    const state = await getState();
    if (!state.projects[projectId]) throw new Error('项目不存在');
    state.activeProjectId = projectId;
    return writeState(state);
  }

  async function createProject(nameInput) {
    const name = String(nameInput || '').trim().slice(0, 30);
    if (!name) throw new Error('请输入项目名称');
    const state = await getState();
    const randomPart = root.crypto && typeof root.crypto.randomUUID === 'function'
      ? root.crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
    const id = `project-${Date.now()}-${randomPart}`;
    const now = new Date().toISOString();
    state.projects[id] = { id, name, createdAt: now, updatedAt: now };
    state.projectOrder.push(id);
    state.carts[id] = emptyCart();
    state.activeProjectId = id;
    return writeState(state);
  }

  async function removeProject(projectIdInput) {
    const projectId = String(projectIdInput || '');
    const state = await getState();
    if (!state.projects[projectId]) return state;
    if (state.projectOrder.length <= 1) throw new Error('至少保留一个项目');
    delete state.projects[projectId];
    delete state.carts[projectId];
    state.projectOrder = state.projectOrder.filter((id) => id !== projectId);
    if (state.activeProjectId === projectId) state.activeProjectId = state.projectOrder[0];
    return writeState(state);
  }

  async function upsertCreator(input, projectIdInput) {
    let redId = normalizeRedId(input && input.redId);
    if (!redId) throw new Error('缺少小红书号，无法加入购物车');
    const state = await getState();
    const projectId = projectIdInput && state.projects[projectIdInput] ? projectIdInput : state.activeProjectId;
    const cart = state.carts[projectId];
    const now = new Date().toISOString();
    const existing = findCreator(cart.creators, input);
    if (existing && displayRedId(existing) && !displayRedId(input)) redId = existing.redId;
    for (const [key, item] of Object.entries(cart.excluded)) if (sameCreator(item, input)) delete cart.excluded[key];
    if (existing && existing.redId !== redId) {
      delete cart.creators[existing.redId];
      cart.order = cart.order.map(key => key === existing.redId ? redId : key);
    }
    cart.creators[redId] = {
      ...(existing || {}),
      ...input,
      redId,
      projectId,
      projectName: state.projects[projectId].name,
      firstAddedAt: existing && existing.firstAddedAt ? existing.firstAddedAt : now,
      lastUpdatedAt: now
    };
    if (!cart.order.includes(redId)) cart.order.push(redId);
    state.projects[projectId].updatedAt = now;
    return writeState(state);
  }

  async function removeCreator(redIdInput, projectIdInput) {
    const redId = normalizeRedId(redIdInput);
    const state = await getState();
    const projectId = projectIdInput && state.projects[projectIdInput] ? projectIdInput : state.activeProjectId;
    const cart = state.carts[projectId];
    delete cart.creators[redId];
    cart.order = cart.order.filter((item) => item !== redId);
    state.projects[projectId].updatedAt = new Date().toISOString();
    return writeState(state);
  }

  async function restoreRemovedCreator(input, projectIdInput, orderIndexInput) {
    if (!input || typeof input !== 'object') throw new Error('缺少待恢复的达人数据');
    const state = await getState();
    const projectId = projectIdInput && state.projects[projectIdInput] ? projectIdInput : state.activeProjectId;
    const cart = state.carts[projectId];
    const existing = findCreator(cart.creators, input);
    if (existing) return state;
    let redId = normalizeRedId(input.redId);
    if (!redId) throw new Error('缺少小红书号，无法恢复达人');
    for (const [key, item] of Object.entries(cart.excluded)) {
      if (sameCreator(item, input)) {
        if (displayRedId(item) && !displayRedId(input)) redId = item.redId;
        delete cart.excluded[key];
      }
    }
    const now = new Date().toISOString();
    cart.creators[redId] = {
      ...input,
      redId,
      projectId,
      projectName: state.projects[projectId].name,
      firstAddedAt: input.firstAddedAt || input.lastUpdatedAt || now,
      lastUpdatedAt: input.lastUpdatedAt || now
    };
    cart.order = cart.order.filter(key => key !== redId);
    const requestedIndex = Number(orderIndexInput);
    const index = Number.isInteger(requestedIndex)
      ? Math.max(0, Math.min(requestedIndex, cart.order.length))
      : cart.order.length;
    cart.order.splice(index, 0, redId);
    state.projects[projectId].updatedAt = now;
    return writeState(state);
  }

  async function clearCart(projectIdInput) {
    const state = await getState();
    const projectId = projectIdInput && state.projects[projectIdInput] ? projectIdInput : state.activeProjectId;
    state.carts[projectId] = { ...state.carts[projectId], creators: {}, order: [] };
    state.projects[projectId].updatedAt = new Date().toISOString();
    return writeState(state);
  }

  function creatorsAsList(cart) {
    const normalized = normalizeCart(cart);
    return normalized.order.map((redId) => normalized.creators[redId]).filter(Boolean);
  }

  async function reviewChange(projectId, change) {
    const state = await getState();
    if (!state.projects[projectId]) throw new Error('项目不存在，请重新选择项目');
    change(state.carts[projectId], state.projects[projectId]);
    state.projects[projectId].updatedAt = new Date().toISOString();
    return writeState(state);
  }

  function excludeCreators(creators, projectId, source = '本页筛选') {
    return reviewChange(projectId, (cart, project) => {
      const batchId = `${Date.now()}-${Math.random()}`;
      const ids = [];
      for (const input of creators) {
        const redId = normalizeRedId(input.redId);
        if (!redId || findCreator(cart.excluded, input)) continue;
        const added = findCreator(cart.creators, input);
        if (added && source !== '移除并排除') continue;
        const stored = added || input;
        if (added) delete cart.creators[added.redId];
        cart.order = cart.order.filter(id => id !== added?.redId);
        cart.excluded[redId] = { ...stored, redId, name: stored.name || redId, profileId: profileId(stored), pgyUrl: stored.pgyUrl || '',
          projectName: project.name, excludedAt: new Date().toISOString(), exclusionSource: source, batchId };
        ids.push(redId);
      }
      if (source === '本页筛选' && ids.length) cart.lastScreening = { batchId, ids };
    });
  }

  function restoreCreators(ids, projectId) {
    return reviewChange(projectId, cart => ids.forEach(id => { delete cart.excluded[normalizeRedId(id)]; }));
  }

  function undoScreening(projectId) {
    return reviewChange(projectId, cart => {
      const batch = cart.lastScreening;
      if (batch) for (const id of batch.ids) {
        if (cart.excluded[id]?.batchId === batch.batchId) delete cart.excluded[id];
      }
      cart.lastScreening = null;
    });
  }

  function setHideExcluded(value, projectId) {
    return reviewChange(projectId, cart => { cart.hideExcluded = Boolean(value); });
  }

  async function createBackup() {
    const state = await getState();
    const batchJob = await getBatchJob();
    return {
      format: 'pgy-creator-cart-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      state,
      batchJob
    };
  }

  async function restoreBackup(input) {
    if (!input || typeof input !== 'object' || input.format !== 'pgy-creator-cart-backup' || !input.state) {
      throw new Error('备份文件格式不正确');
    }
    const state = normalizeState(input.state);
    if (!state.projectOrder.length) throw new Error('备份中没有可恢复的项目');
    await chrome.storage.local.set({
      [STORAGE_KEY]: state,
      [BATCH_STORAGE_KEY]: input.batchJob && typeof input.batchJob === 'object' ? input.batchJob : null
    });
    return state;
  }

  function matchesSearch(creator, query) {
    const term = String(query || '').normalize('NFC').trim().toLocaleLowerCase();
    return [creator.name, displayRedId(creator)].some(value => String(value || '').normalize('NFC').toLocaleLowerCase().includes(term));
  }

  function subscribe(listener) {
    const handler = (changes, areaName) => {
      if (areaName !== 'local' || !changes[STORAGE_KEY]) return;
      listener(normalizeState(changes[STORAGE_KEY].newValue));
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }

  const api = {
    STORAGE_KEY,
    BATCH_STORAGE_KEY,
    normalizeRedId,
    getState,
    getCart,
    setActiveProject,
    createProject,
    removeProject,
    upsertCreator,
    removeCreator,
    restoreRemovedCreator,
    clearCart,
    creatorsAsList,
    subscribe,
    getBatchJob,
    updateBatchJob,
    advanceBatchJob,
    createBackup,
    restoreBackup
  };
  Object.assign(api, { excludeCreators, restoreCreators, undoScreening, setHideExcluded, matchesSearch, profileId, sameCreator, findCreator, displayRedId, formatLocalDateTime, creatorDetailUrl, cartDetailUrl, updateExistingCreator, updateMatchingCreators });
  // Serialize read/modify/write operations across extension pages and same-origin tabs.
  let pending = Promise.resolve();
  for (const name of ['setActiveProject', 'createProject', 'removeProject', 'upsertCreator', 'updateExistingCreator', 'updateMatchingCreators', 'removeCreator', 'restoreRemovedCreator', 'clearCart', 'excludeCreators', 'restoreCreators', 'undoScreening', 'setHideExcluded', 'updateBatchJob', 'advanceBatchJob', 'restoreBackup']) {
    const operation = api[name];
    api[name] = (...args) => {
      const run = () => root.navigator?.locks
        ? root.navigator.locks.request(STORAGE_KEY, () => operation(...args)) : operation(...args);
      const result = pending.then(run);
      pending = result.catch(() => {});
      return result;
    };
  }

  root.PGYCartStorage = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
