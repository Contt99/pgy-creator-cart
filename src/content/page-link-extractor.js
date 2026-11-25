(function installPgyPageDataExtractor() {
  'use strict';

  if (window.__PGY_CART_PAGE_DATA_EXTRACTOR__) return;
  window.__PGY_CART_PAGE_DATA_EXTRACTOR__ = true;

  const REQUEST_EVENT = 'pgy-cart-resolve-link';
  const HOMEPAGE_ATTRIBUTE = 'data-pgy-resolved-homepage-url';
  const INSTITUTION_ATTRIBUTE = 'data-pgy-resolved-institution';
  const FAN_AGE_ATTRIBUTE = 'data-pgy-resolved-fan-age';
  const networkRecords = [];
  const FAN_AGE_SEGMENTS = [
    { key: 'fanAgeUnder18', patterns: [/(?:18岁?(?:以下|以内)|未满18岁?|小于18岁?|[<＜≤]\s*18岁?|0\s*[-~～至到]\s*17岁?)/iu, /(?:under|below|lt)[_-]?18/i] },
    { key: 'fanAge18To24', patterns: [/18岁?\s*[-~～至到]\s*24岁?/iu, /18[_-]?24/i] },
    { key: 'fanAge25To34', patterns: [/25岁?\s*[-~～至到]\s*34岁?/iu, /25[_-]?34/i] },
    { key: 'fanAge35To44', patterns: [/35岁?\s*[-~～至到]\s*44岁?/iu, /35[_-]?44/i] },
    { key: 'fanAge45Plus', patterns: [/(?:45岁?(?:以上|及以上)|大于44岁?|[>＞≥]\s*44岁?|45\s*\+)/iu, /(?:over|above|gt|gte)[_-]?44|45[_-]?(?:plus|up)/i] }
  ];
  const LOCATION_CONTEXT_PATTERN = /(?:北京|上海|天津|重庆|河北|山西|辽宁|吉林|黑龙江|江苏|浙江|安徽|福建|江西|山东|河南|湖北|湖南|广东|海南|四川|贵州|云南|陕西|甘肃|青海|内蒙古|广西|西藏|宁夏|新疆|香港|澳门|台湾|海外)/u;

  function compact(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function profileId(value) {
    const text = compact(value);
    return /^[a-z0-9_-]{16,64}$/i.test(text) ? text : '';
  }

  function homepageFromString(value) {
    if (typeof value !== 'string') return '';
    const cleaned = value.trim().replace(/\\\//g, '/');
    if (!cleaned) return '';
    const embedded = cleaned.match(/https?:\/\/[^\s"'<>]+/i);
    const candidate = embedded ? embedded[0] : cleaned;
    try {
      const url = candidate.startsWith('/user/profile/')
        ? new URL(candidate, 'https://www.xiaohongshu.com')
        : new URL(candidate, location.href);
      if (!/(^|\.)xiaohongshu\.com$/i.test(url.hostname) || /^pgy\./i.test(url.hostname)) return '';
      if (!/\/user\/profile\//i.test(url.pathname)) return '';
      return url.href;
    } catch {
      return '';
    }
  }

  function institutionValue(value) {
    const text = compact(value);
    if (!text || text.length > 100 || /^(?:null|undefined|--|—)$/i.test(text)) return '';
    return text;
  }

  function institutionFromLabeledText(valueInput) {
    const value = compact(valueInput);
    const match = value.match(/(?:所属机构|签约机构|MCN机构|机构名称|机构)[：:]\s*([^；;|]{1,100})/u);
    return match ? institutionValue(match[1]) : '';
  }

  function isInstitutionContainerKey(valueInput) {
    const value = compact(valueInput);
    return /mcn|org(?:anization)?|institution|agency/i.test(value);
  }

  function normalizePercentage(valueInput) {
    const text = compact(valueInput).replace(/％/g, '%');
    const match = text.match(/-?\d+(?:\.\d+)?/);
    if (!match) return '';
    let value = Number(match[0]);
    if (!Number.isFinite(value) || value < 0) return '';
    if (!text.includes('%') && value <= 1) value *= 100;
    if (value > 100) return '';
    return `${Number.isInteger(value) ? value : Number(value.toFixed(2))}%`;
  }

  function fanAgeSegmentKey(labelInput) {
    const label = compact(labelInput).replace(/[—–−]/g, '-');
    const segment = FAN_AGE_SEGMENTS.find((item) => item.patterns.some((pattern) => pattern.test(label)));
    return segment ? segment.key : '';
  }

  function mergeFanAgeSegments(target, source) {
    for (const segment of FAN_AGE_SEGMENTS) {
      if (!target[segment.key] && source && source[segment.key]) target[segment.key] = source[segment.key];
    }
    return target;
  }

  function fanAgeSegmentsFromText(valueInput) {
    const value = String(valueInput == null ? '' : valueInput).replace(/％/g, '%').replace(/[—–−]/g, '-');
    const result = {};
    for (const segment of FAN_AGE_SEGMENTS) {
      for (const pattern of segment.patterns) {
        const source = pattern.source;
        const after = value.match(new RegExp(`(?:${source})[^%\\d]{0,40}(\\d+(?:\\.\\d+)?)\\s*%`, 'iu'));
        const before = value.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*%[^%\\d]{0,40}(?:${source})`, 'iu'));
        const percentage = normalizePercentage(after ? `${after[1]}%` : before ? `${before[1]}%` : '');
        if (percentage) {
          result[segment.key] = percentage;
          break;
        }
      }
    }
    return result;
  }

  function profileIdFromUrl(valueInput) {
    try {
      const url = new URL(valueInput, location.href);
      const match = url.pathname.match(/\/blogger-detail\/([a-z0-9_-]{16,64})(?:\/|$)/i);
      return match ? match[1] : '';
    } catch {
      return '';
    }
  }

  function routeProfileId() {
    const match = location.pathname.match(/\/blogger-detail\/([a-z0-9_-]{16,64})(?:\/|$)/i);
    return match ? match[1] : '';
  }

  function addRecord(record) {
    const hasFanAge = record.fanAgeSegments && Object.keys(record.fanAgeSegments).length > 0;
    if (!record.redId && !record.userId && !record.homepageUrl && !record.institution && !hasFanAge) return;
    const key = `${record.redId}|${record.userId}|${record.homepageUrl}|${record.institution}|${JSON.stringify(record.fanAgeSegments || {})}`;
    if (networkRecords.some((item) => item.key === key)) return;
    networkRecords.push({ ...record, key });
    if (networkRecords.length > 300) networkRecords.shift();
  }

  function scanPayload(payload, sourceUrl) {
    if (!payload || typeof payload !== 'object') return;
    const sourceProfileId = profileIdFromUrl(sourceUrl) || routeProfileId();
    const queue = [{ value: payload, depth: 0, key: '' }];
    const seen = new WeakSet();
    let inspected = 0;
    while (queue.length && inspected < 6000) {
      const item = queue.shift();
      const value = item.value;
      if (!value || typeof value !== 'object' || seen.has(value) || item.depth > 12) continue;
      seen.add(value);
      inspected += 1;
      let entries;
      try {
        const allEntries = Object.entries(value);
        const priorityEntries = allEntries.filter(([key]) => isInstitutionContainerKey(key));
        const priorityKeys = new Set(priorityEntries.map(([key]) => key));
        entries = priorityEntries.concat(allEntries.slice(0, 250).filter(([key]) => !priorityKeys.has(key)));
      } catch { continue; }
      const record = { redId: '', userId: sourceProfileId, homepageUrl: '', institution: '', fanAgeSegments: {}, sourceUrl };
      let ageLabel = '';
      let ageValue = '';
      for (const [key, child] of entries) {
        if (typeof child === 'string' || typeof child === 'number') {
          const text = compact(child);
          if (!record.redId && /^(?:red_?id|redbook_?id|xhs_?(?:id|number)|xiaohongshu_?(?:id|number))$/i.test(key)) record.redId = text;
          if (!record.userId && !isInstitutionContainerKey(item.key) && /^(?:user_?id|blogger_?id|author_?id|xhs_?user_?id)$/i.test(key)) record.userId = profileId(text);
          if (!record.homepageUrl && /(?:home|profile|personal).*(?:url|link)|(?:url|link).*(?:home|profile|personal)/i.test(key)) record.homepageUrl = homepageFromString(text);
          if (!record.institution && /^(?:mcn(?:_?name)?|org(?:anization)?_?name|institution(?:_?name)?|agency(?:_?name)?|belong_?org)$/i.test(key)) record.institution = institutionValue(text);
          if (!record.institution && isInstitutionContainerKey(item.key) && /^(?:name|title|display_?name)$/i.test(key)) record.institution = institutionValue(text);
          if (!record.institution) record.institution = institutionFromLabeledText(text);
          const keySegment = fanAgeSegmentKey(key);
          if (keySegment) {
            const percentage = normalizePercentage(text);
            if (percentage) record.fanAgeSegments[keySegment] = percentage;
          }
          mergeFanAgeSegments(record.fanAgeSegments, fanAgeSegmentsFromText(text));
          if (/^(?:name|label|title|range|group|age_?range)$/i.test(key)) ageLabel = text;
          if (/^(?:value|ratio|rate|percent|percentage|portion|proportion)$/i.test(key)) ageValue = text;
        } else if (child && typeof child === 'object') {
          queue.push({ value: child, depth: item.depth + 1, key });
        }
      }
      const labeledAgeKey = fanAgeSegmentKey(ageLabel);
      const labeledAgeValue = normalizePercentage(ageValue);
      if (labeledAgeKey && labeledAgeValue) record.fanAgeSegments[labeledAgeKey] = labeledAgeValue;
      if (!record.homepageUrl && record.userId) record.homepageUrl = `https://www.xiaohongshu.com/user/profile/${record.userId}`;
      addRecord(record);
    }
  }

  function inspectComponent(anchor) {
    const result = { homepageUrl: '', institution: '', userId: '', fanAgeSegments: {} };
    const queue = [];
    const seen = new WeakSet();
    for (const property of Object.getOwnPropertyNames(anchor)) {
      if (!/(vue|react|fiber|component|props|vnode)/i.test(property)) continue;
      try { queue.push({ value: anchor[property], depth: 0, key: property, parentKey: '' }); } catch { /* ignore */ }
    }
    let inspected = 0;
    while (queue.length && inspected < 1800) {
      const item = queue.shift();
      const value = item.value;
      if (typeof value === 'string') {
        if (!result.homepageUrl) result.homepageUrl = homepageFromString(value);
        if (!result.userId && /^(?:user_?id|blogger_?id|author_?id|xhs_?user_?id)$/i.test(item.key)) result.userId = profileId(value);
        if (!result.institution && /mcn|org|institution|agency/i.test(item.key)) result.institution = institutionValue(value);
        if (!result.institution && isInstitutionContainerKey(item.parentKey) && /^(?:name|title|display_?name)$/i.test(item.key)) result.institution = institutionValue(value);
        if (!result.institution) result.institution = institutionFromLabeledText(value);
        const ageKey = fanAgeSegmentKey(item.key);
        if (ageKey) {
          const percentage = normalizePercentage(value);
          if (percentage) result.fanAgeSegments[ageKey] = percentage;
        }
        mergeFanAgeSegments(result.fanAgeSegments, fanAgeSegmentsFromText(value));
        continue;
      }
      if (!value || (typeof value !== 'object' && typeof value !== 'function')) continue;
      if (value === window || value === document || seen.has(value) || item.depth > 7) continue;
      seen.add(value);
      inspected += 1;
      let keys;
      try { keys = Object.keys(value).slice(0, 160); } catch { continue; }
      for (const key of keys) {
        let child;
        try { child = value[key]; } catch { continue; }
        if (typeof child === 'string') queue.push({ value: child, depth: item.depth + 1, key, parentKey: item.key });
        else if (child && (typeof child === 'object' || typeof child === 'function')) queue.push({ value: child, depth: item.depth + 1, key, parentKey: item.key });
      }
    }
    if (!result.homepageUrl && result.userId) result.homepageUrl = `https://www.xiaohongshu.com/user/profile/${result.userId}`;
    return result;
  }

  function domInstitution(anchor) {
    let scope = anchor.parentElement;
    for (let depth = 0; scope && depth < 7; depth += 1, scope = scope.parentElement) {
      const scopeText = compact(scope.innerText || scope.textContent);
      if (!scopeText || scopeText.length > 3000) continue;
      const company = scope.querySelector('.blogger-company__text, [class*="blogger-company"][class*="text"]');
      if (company) {
        const value = institutionValue(company.innerText || company.textContent);
        if (value && value !== '无机构') return value;
      }
      const semantic = scope.querySelector('[class*="mcn"], [class*="institution"], [class*="agency"], [class*="organization"]');
      if (semantic) {
        const value = institutionValue(semantic.innerText || semantic.textContent);
        if (value) return value;
      }
      const noInstitution = [...scope.querySelectorAll('span,div,p')].find((element) => compact(element.innerText || element.textContent) === '无机构');
      if (noInstitution) return '无机构';
      for (const element of scope.querySelectorAll('[title], [aria-label], [data-tooltip], [data-content], [data-title], [aria-describedby]')) {
        for (const name of ['title', 'aria-label', 'data-tooltip', 'data-content', 'data-title']) {
          const value = institutionFromLabeledText(element.getAttribute(name));
          if (value) return value;
        }
        const describedBy = element.getAttribute('aria-describedby');
        const tooltip = describedBy && document.getElementById(describedBy);
        const tooltipValue = tooltip && institutionFromLabeledText(tooltip.innerText || tooltip.textContent);
        if (tooltipValue) return tooltipValue;
      }
      const labeled = scopeText.match(/(?:所属机构|签约机构|MCN机构|机构名称|机构)[：:]?\s*([^\n；;]{1,100})/i);
      if (labeled) return institutionValue(labeled[1]);
      for (const element of scope.querySelectorAll('a, [role="link"]')) {
        const value = compact(element.innerText || element.textContent);
        if (!value || value.length > 50 || /^(?:详情|主页|蒲公英详情|小红书主页|查看更多|无机构)$/u.test(value)) continue;
        if (/^小红书号/u.test(value) || /^\d+(?:\.\d+)?(?:万|亿|w|k)?$/i.test(value)) continue;
        if (element.closest('[class*="redid"], [class*="red-id"], [class*="red_id"]')) continue;
        const href = compact(element.getAttribute('href') || element.href || '');
        if (/xiaohongshu\.com\/user\/profile\//i.test(href) || /pgy\.xiaohongshu\.com/i.test(href)) continue;
        let parent = element.parentElement;
        for (let parentDepth = 0; parent && parentDepth < 3; parentDepth += 1, parent = parent.parentElement) {
          const context = compact(parent.innerText || parent.textContent || '');
          if (context.length > 240) break;
          if (/小红书号|粉丝量|获赞与收藏/u.test(context)) break;
          if (LOCATION_CONTEXT_PATTERN.test(context) && context.includes(value)) return value;
        }
      }
    }
    return '';
  }

  function networkData(anchor) {
    const redId = compact(anchor.textContent);
    const routeId = routeProfileId();
    let best = null;
    let bestScore = -1;
    const fanAgeSegments = {};
    for (const record of networkRecords) {
      let score = 0;
      if (redId && record.redId === redId) score += 120;
      if (routeId && record.userId === routeId) score += 100;
      if (routeId && record.sourceUrl && record.sourceUrl.includes(routeId)) score += 40;
      if (record.homepageUrl) score += 15;
      if (record.institution) score += 10;
      if (score >= 40) mergeFanAgeSegments(fanAgeSegments, record.fanAgeSegments);
      if (score > bestScore) {
        best = record;
        bestScore = score;
      }
    }
    return { ...(best || {}), fanAgeSegments: mergeFanAgeSegments(fanAgeSegments, best && best.fanAgeSegments) };
  }

  function resolveData(anchor) {
    const component = inspectComponent(anchor);
    const network = networkData(anchor);
    const routeId = routeProfileId();
    const visibleInstitution = domInstitution(anchor);
    return {
      homepageUrl: component.homepageUrl
        || network.homepageUrl
        || (network.userId ? `https://www.xiaohongshu.com/user/profile/${network.userId}` : '')
        || (routeId ? `https://www.xiaohongshu.com/user/profile/${routeId}` : ''),
      institution: visibleInstitution || component.institution || network.institution,
      fanAgeSegments: mergeFanAgeSegments(component.fanAgeSegments || {}, network.fanAgeSegments)
    };
  }

  window.__PGY_CART_JSON_RESPONSE_OBSERVER__?.subscribe(scanPayload);

  document.addEventListener(REQUEST_EVENT, (event) => {
    const anchor = event.target && event.target.closest ? event.target.closest('a') : null;
    if (!anchor) return;
    const data = resolveData(anchor);
    anchor.setAttribute(HOMEPAGE_ATTRIBUTE, data.homepageUrl || '');
    anchor.setAttribute(INSTITUTION_ATTRIBUTE, data.institution || '');
    anchor.setAttribute(FAN_AGE_ATTRIBUTE, JSON.stringify(data.fanAgeSegments || {}));
  }, true);
})();
