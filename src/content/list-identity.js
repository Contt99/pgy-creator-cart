(function () {
  'use strict';
  // Resolve only the data belonging to the rendered creator component. Never
  // search the application root or use a nickname alone as an identity.
  const text = value => String(value ?? '').normalize('NFC').trim();
  const validId = value => /^[a-f0-9]{24}$/i.test(text(value)) ? text(value) : '';
  const avatarKey = value => { if (!value) return ''; try { return new URL(value, location.href).pathname; } catch { return ''; } };
  const records = new Map();
  function readRecord(value) {
    if (!value || typeof value !== 'object') return null;
    const entries = Object.entries(value).slice(0, 80);
    const field = pattern => entries.find(([key, v]) => pattern.test(key) && ['string', 'number'].includes(typeof v))?.[1];
    const name = text(field(/^(?:name|nickname|nick_name|user_?name|blogger_?name|kol_?name)$/i));
    const profileId = validId(field(/^(?:user_?id|blogger_?id|author_?id|kol_?id|xhs_?user_?id)$/i));
    if (!name || !profileId) return null;
    return {name,profileId,redId:text(field(/^(?:red_?id|redbook_?id|xhs_?number|xiaohongshu_?number)$/i)),
      avatar:avatarKey(field(/^(?:avatar(?:_?url)?|head_?(?:photo|image|url)|image(?:_?url)?)$/i))};
  }
  function observePayload(payload) {
    if (!/\/pre-trade\/note\/kol\/?$/.test(location.pathname)) return;
    const queue = [{value:payload,depth:0}]; let count=0;
    while(queue.length && count++ < 3000) {
      const {value,depth}=queue.shift();
      if (!value || typeof value !== 'object' || depth > 9) continue;
      const record=readRecord(value);
      if(record) records.set(record.profileId,record);
      for(const child of Object.values(value).slice(0,100)) if(child && typeof child==='object') queue.push({value:child,depth:depth+1});
    }
    while(records.size>500) records.delete(records.keys().next().value);
  }
  // Observe responses already requested by this page; do not issue extra requests.
  window.__PGY_CART_JSON_RESPONSE_OBSERVER__?.subscribe(observePayload);
  function resolve(anchor) {
    const name = text(anchor.textContent);
    const card = anchor.closest('.kol-info');
    if (!name || !card) return null;
    const avatar = avatarKey(card.querySelector('.head-photo')?.getAttribute('src'));
    const candidates = new Map();
    for(const record of records.values()) if(record.name===name && record.avatar && record.avatar===avatar) candidates.set(record.profileId,record);
    if (candidates.size) return candidates.size === 1 ? [...candidates.values()][0] : null;
    const seen = new WeakSet();
    let inspected = 0;
    function visit(value, depth) {
      if (!value || typeof value !== 'object' || value instanceof Node || seen.has(value) || depth > 5 || inspected++ > 300) return;
      seen.add(value);
      const entries = Object.entries(value).slice(0, 60);
      const field = pattern => entries.find(([key, v]) => pattern.test(key) && ['string', 'number'].includes(typeof v))?.[1];
      const candidateName = field(/^(?:name|nickname|nick_name|user_?name|blogger_?name|kol_?name)$/i);
      const id = validId(field(/^(?:user_?id|blogger_?id|author_?id|kol_?id|xhs_?user_?id)$/i));
      const candidateAvatar = field(/^(?:avatar(?:_?url)?|head_?(?:photo|image|url)|image(?:_?url)?)$/i);
      if (id && text(candidateName) === name && (!candidateAvatar || !avatar || avatarKey(candidateAvatar) === avatar)) {
        const redId = text(field(/^(?:red_?id|redbook_?id|xhs_?number|xiaohongshu_?number)$/i));
        candidates.set(id, { profileId: id, redId, name });
      }
      // Arrays are lists, not a single creator's props.
      for (const [key, child] of entries) if (!Array.isArray(child) && !/^(?:parent|root|appContext|provides|proxy|ctx|refs|subTree)$/i.test(key)) visit(child, depth + 1);
    }
    for (let element = anchor; element && element !== card.parentElement; element = element.parentElement) {
      for (const key of ['__vueParentComponent', '__vue__', '__vnode']) {
        const component = element[key];
        if (!component) continue;
        visit(component.props, 0);
        visit(component.$props, 0);
      }
    }
    return candidates.size === 1 ? [...candidates.values()][0] : null;
  }
  document.addEventListener('pgy-cart-resolve-list-identity', event => {
    const anchor = event.target;
    if (!anchor?.matches?.('.kol-name')) return;
    let result = null;
    try { result = resolve(anchor); } catch { /* Fail closed when the site's structure changes. */ }
    const encoded = JSON.stringify(result);
    if (anchor.getAttribute('data-pgy-list-identity') !== encoded) anchor.setAttribute('data-pgy-list-identity', encoded);
  }, true);
})();
