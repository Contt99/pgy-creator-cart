(function initPgyCreatorCart() {
  'use strict';

  if (window.top !== window.self || document.getElementById('pgy-cart-extension-root')) return;

  const storage = globalThis.PGYCartStorage;
  const xlsx = globalThis.PGYXlsx;
  if (!storage || !xlsx) return;

  const RED_ID_SELECTORS = [
    '.base-info-item.blogger-redid a',
    '.blogger-redid a',
    '[class*="blogger-redid"] a',
    '[class*="blogger_redid"] a',
    '[class*="red-id"] a'
  ];
  const CREATOR_SCOPE_SELECTORS = [
    'tr',
    '[role="row"]',
    '[class*="blogger-card"]',
    '[class*="blogger-item"]',
    '[class*="blogger-row"]',
    '[class*="author-card"]',
    '[class*="creator-card"]',
    '[class*="creator-item"]'
  ].join(',');
  const NAME_SELECTORS = [
    '.kol-name',
    '[class*="blogger-name"]',
    '[class*="author-name"]',
    '[class*="creator-name"]',
    '[class*="user-name"]',
    '[class*="nickname"]'
  ];
  const CORE_FIELD_SPECS = [
    { key: 'contentCategories', label: '达人内容类别', aliases: ['达人内容类别', '内容类别', '内容类目', '达人类目', '内容领域', '垂类'], selectors: ['[class*="category"]', '[class*="categories"]'] },
    { key: 'creatorTags', label: '达人标签', aliases: ['达人标签', '博主标签', '特色标签'], selectors: ['[class*="tag"]'] },
    { key: 'fanGenderDistribution', label: '粉丝性别分布', aliases: ['粉丝性别分布', '粉丝性别', '性别分布'], selectors: ['[class*="gender"]'] },
    { key: 'fanAgeDistribution', label: '粉丝年龄分布', aliases: ['粉丝年龄分布', '粉丝年龄', '年龄分布'], selectors: ['[class*="age"]'] },
    { key: 'fanRegionDistribution', label: '粉丝地域分布', aliases: ['粉丝地域分布', '粉丝地域', '地域分布'], selectors: ['[class*="region"]', '[class*="province"]'] },
    { key: 'creatorLocation', label: '达人所在地', aliases: ['达人所在地', '博主所在地', '常驻地', '所在地'], selectors: ['[class*="location"]', '[class*="city"]'] },
    { key: 'institution', label: '所属机构', aliases: ['所属机构', '签约机构', 'MCN机构', '机构名称'], selectors: ['.blogger-company__text', '[class*="blogger-company"][class*="text"]', '[class*="mcn"]', '[class*="institution"]', '[class*="agency"]', '[class*="organization"]'] },
    { key: 'medianImpressions', label: '曝光中位数', aliases: ['曝光中位数', '曝光量中位数'], selectors: ['[class*="exposure"]', '[class*="impression"]'] },
    { key: 'medianReads', label: '阅读中位数', aliases: ['阅读中位数', '阅读量中位数'], selectors: ['[class*="read"]', '[class*="view"]'] },
    { key: 'medianInteractions', label: '互动中位数', aliases: ['互动中位数', '互动量中位数'], selectors: ['[class*="interaction"]', '[class*="engagement"]'] },
    { key: 'imagePrice', label: '图文笔记一口价', aliases: ['图文笔记一口价', '图文一口价', '图文笔记报价', '图文报价'], selectors: ['[class*="image-price"]', '[class*="picture-price"]'] },
    { key: 'videoPrice', label: '视频笔记一口价', aliases: ['视频笔记一口价', '视频一口价', '视频笔记报价', '视频报价'], selectors: ['[class*="video-price"]'] }
  ];
  const FAN_AGE_SEGMENTS = [
    { key: 'fanAgeUnder18', label: '18岁以下占比', patterns: [/(?:18岁?(?:以下|以内)|未满18岁?|小于18岁?|[<＜≤]\s*18岁?|0\s*[-~～至到]\s*17岁?)/iu, /(?:under|below|lt)[_-]?18/i] },
    { key: 'fanAge18To24', label: '18-24岁占比', patterns: [/18岁?\s*[-~～至到]\s*24岁?/iu, /18[_-]?24/i] },
    { key: 'fanAge25To34', label: '25-34岁占比', patterns: [/25岁?\s*[-~～至到]\s*34岁?/iu, /25[_-]?34/i] },
    { key: 'fanAge35To44', label: '35-44岁占比', patterns: [/35岁?\s*[-~～至到]\s*44岁?/iu, /35[_-]?44/i] },
    { key: 'fanAge45Plus', label: '45岁以上占比', patterns: [/(?:45岁?(?:以上|及以上)|大于44岁?|[>＞≥]\s*44岁?|45\s*\+)/iu, /(?:over|above|gt|gte)[_-]?44|45[_-]?(?:plus|up)/i] }
  ];
  const LOCATION_CONTEXT_PATTERN = /(?:北京|上海|天津|重庆|河北|山西|辽宁|吉林|黑龙江|江苏|浙江|安徽|福建|江西|山东|河南|湖北|湖南|广东|海南|四川|贵州|云南|陕西|甘肃|青海|内蒙古|广西|西藏|宁夏|新疆|香港|澳门|台湾|海外)/u;
  const BATCH_LIMIT = 50;
  const BATCH_STALE_MS = 7 * 24 * 60 * 60 * 1000;
  const BATCH_STEP_MIN_MS = 4000;
  const BATCH_STEP_MAX_MS = 7000;
  const BATCH_BREAK_MIN_MS = 15000;
  const BATCH_BREAK_MAX_MS = 25000;
  const state = {
    snapshot: null,
    selectedRedIds: new Set(),
    selectedProjectId: '',
    scanTimer: null,
    sidePositionFrame: 0,
    viewportFrame: 0,
    activeRedIdLink: null,
    toastTimer: null,
    toastAction: null,
    drawerReturnFocus: null,
    batchJob: null,
    batchTimer: 0,
    batchWindow: null
  };

  function compactText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function normalizePercentage(valueInput) {
    const text = compactText(valueInput).replace(/％/g, '%');
    const match = text.match(/-?\d+(?:\.\d+)?/);
    if (!match) return '';
    let value = Number(match[0]);
    if (!Number.isFinite(value) || value < 0) return '';
    if (!text.includes('%') && value <= 1) value *= 100;
    if (value > 100) return '';
    const formatted = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
    return `${formatted}%`;
  }

  function fanAgeSegmentForLabel(labelInput) {
    const label = compactText(labelInput).replace(/[—–−]/g, '-');
    return FAN_AGE_SEGMENTS.find((segment) => segment.patterns.some((pattern) => pattern.test(label))) || null;
  }

  function extractFanAgeSegments(scope, rawDistribution, initialValues) {
    const result = {};
    for (const segment of FAN_AGE_SEGMENTS) {
      const initial = initialValues && normalizePercentage(initialValues[segment.key]);
      if (initial) result[segment.key] = initial;
    }

    const candidates = [rawDistribution, scope && (scope.innerText || scope.textContent || '')].filter(Boolean);
    if (scope && scope.querySelectorAll) {
      let inspected = 0;
      for (const element of scope.querySelectorAll('[title], [aria-label], [data-tooltip], [data-content], [data-label], [data-title]')) {
        if (inspected >= 3000) break;
        inspected += 1;
        for (const name of ['title', 'aria-label', 'data-tooltip', 'data-content', 'data-label', 'data-title']) {
          const value = element.getAttribute(name);
          if (value) candidates.push(value);
        }
      }
    }

    for (const candidateInput of candidates) {
      const candidate = String(candidateInput).replace(/％/g, '%').replace(/[—–−]/g, '-');
      for (const segment of FAN_AGE_SEGMENTS) {
        if (result[segment.key]) continue;
        for (const pattern of segment.patterns) {
          const source = pattern.source;
          const after = candidate.match(new RegExp(`(?:${source})[^%\\d]{0,40}(\\d+(?:\\.\\d+)?)\\s*%`, 'iu'));
          const before = candidate.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*%[^%\\d]{0,40}(?:${source})`, 'iu'));
          const percentage = normalizePercentage(after ? `${after[1]}%` : before ? `${before[1]}%` : '');
          if (percentage) {
            result[segment.key] = percentage;
            break;
          }
        }
      }
    }

    if (scope && scope.querySelectorAll) {
      let inspected = 0;
      for (const element of scope.querySelectorAll('span, div, p, li, text')) {
        if (inspected >= 6000) break;
        inspected += 1;
        const ownText = compactText(element.innerText || element.textContent || '');
        const segment = fanAgeSegmentForLabel(ownText);
        if (!segment || result[segment.key]) continue;
        const nearby = [element, element.nextElementSibling, element.parentElement]
          .filter(Boolean)
          .map((item) => compactText(item.innerText || item.textContent || ''))
          .join(' ');
        const match = nearby.replace(/％/g, '%').match(/\d+(?:\.\d+)?\s*%/);
        const percentage = normalizePercentage(match && match[0]);
        if (percentage) result[segment.key] = percentage;
      }
    }
    return result;
  }

  function cleanMultilineText(value) {
    return String(value || '')
      .split(/\r?\n/)
      .map(compactText)
      .filter(Boolean)
      .join('\n');
  }

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

  function findCreatorScope(redIdLink) {
    const direct = redIdLink.closest(CREATOR_SCOPE_SELECTORS);
    if (direct) return direct;

    const redId = storage.normalizeRedId(redIdLink.textContent);
    let current = redIdLink.parentElement;
    let best = current;
    let bestScore = -1;
    for (let depth = 0; current && depth < 10; depth += 1, current = current.parentElement) {
      const text = cleanMultilineText(current.innerText || current.textContent || '');
      if (text.length < 8 || text.length > 30000) continue;
      const redIdOccurrences = redId ? text.split(redId).length - 1 : 0;
      if (redIdOccurrences > 1) break;
      const className = typeof current.className === 'string' ? current.className : '';
      let score = Math.min(text.split('\n').length, 8);
      if (current.querySelector('img')) score += 5;
      if (/粉丝|赞藏|获赞与收藏/u.test(text)) score += 14;
      if (/(card|item|row|list)/i.test(className)) score += 6;
      if (text.length > 12000) score -= 8;
      if (score > bestScore) {
        bestScore = score;
        best = current;
      }
    }
    return best || redIdLink.parentElement;
  }

  function findCreatorName(scope, redId) {
    for (const selector of NAME_SELECTORS) {
      const candidates = scope.querySelectorAll(selector);
      for (const candidate of candidates) {
        const text = compactText(candidate.innerText || candidate.textContent || '');
        if (text && text !== redId && !text.includes('小红书号') && text.length <= 60) return text;
      }
    }

    const lines = cleanMultilineText(scope.innerText || scope.textContent || '').split('\n');
    const redIdIndex = lines.findIndex((line) => line.includes(redId));
    if (redIdIndex > 0) {
      const candidate = lines[redIdIndex - 1];
      if (candidate && !candidate.includes('小红书号') && candidate.length <= 60) return candidate;
    }
    return redId;
  }

  function appendField(target, keyInput, valueInput) {
    const key = compactText(keyInput).slice(0, 80);
    const value = compactText(valueInput).slice(0, 2000);
    if (!key || !value) return;
    const existing = target[key] || [];
    if (!existing.includes(value)) existing.push(value);
    target[key] = existing.slice(0, 20);
  }

  function captureFields(scope) {
    const fields = {};
    const lines = cleanMultilineText(scope.innerText || scope.textContent || '').split('\n');
    for (const line of lines) {
      const match = line.match(/^([^：:]{1,30})[：:]\s*(.+)$/u);
      if (match) appendField(fields, match[1], match[2]);
    }

    const semanticPattern = /(blogger|author|creator|fans|follower|price|quote|city|location|institution|agency|company|tag|score|rate|count|note|name|redid|advantage|category)/i;
    const elements = scope.querySelectorAll('[class]');
    let captured = 0;
    for (const element of elements) {
      if (captured >= 250) break;
      const className = typeof element.className === 'string' ? element.className : '';
      const semanticClasses = className.split(/\s+/).filter((item) => semanticPattern.test(item) && !/^d-/i.test(item));
      if (!semanticClasses.length) continue;
      const text = compactText(element.innerText || element.textContent || '');
      if (!text || text.length > 300) continue;
      appendField(fields, semanticClasses.slice(0, 2).join('.'), text);
      captured += 1;
    }
    return fields;
  }

  function metricNumber(value) {
    const text = compactText(value);
    const matches = text.match(/(?:\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(?:万|亿|[wWkK])?/g);
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

  function tableColumnText(scope, aliases) {
    const tableRow = scope.matches && scope.matches('tr') ? scope : scope.closest && scope.closest('tr');
    if (tableRow) {
      const table = tableRow.closest('table');
      if (table) {
        const headers = [...table.querySelectorAll('thead th')].map((header) => compactText(header.innerText || header.textContent));
        const cells = [...tableRow.querySelectorAll(':scope > td')];
        const index = headers.findIndex((header) => aliases.some((alias) => header.includes(alias)));
        if (index >= 0 && cells[index]) {
          const value = cleanMultilineText(cells[index].innerText || cells[index].textContent);
          if (value) return value;
        }
      }
    }

    const ariaRow = scope.matches && scope.matches('[role="row"]') ? scope : scope.closest && scope.closest('[role="row"]');
    const grid = ariaRow && ariaRow.closest('[role="table"], [role="grid"]');
    if (ariaRow && grid) {
      const headers = [...grid.querySelectorAll('[role="columnheader"]')].map((header) => compactText(header.innerText || header.textContent));
      const cells = [...ariaRow.querySelectorAll(':scope > [role="cell"], :scope > [role="gridcell"]')];
      const index = headers.findIndex((header) => aliases.some((alias) => header.includes(alias)));
      if (index >= 0 && cells[index]) {
        const value = cleanMultilineText(cells[index].innerText || cells[index].textContent);
        if (value) return value;
      }
    }
    return '';
  }

  function directText(element) {
    return [...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent || '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function cleanLabeledValue(valueInput, aliases) {
    let value = cleanMultilineText(valueInput);
    for (const alias of aliases) value = value.replace(alias, '');
    return value
      .replace(/^[\s：:·|-]+|[\s：:·|-]+$/g, '')
      .split('\n')
      .filter((line) => line && !aliases.includes(line) && !/^(查看详情|查看更多|数据说明)$/u.test(line))
      .join('；')
      .slice(0, 2000);
  }

  function extractLabeledValue(scope, spec, capturedFields) {
    const tableValue = tableColumnText(scope, spec.aliases);
    if (tableValue) return cleanLabeledValue(tableValue, spec.aliases);

    for (const [key, values] of Object.entries(capturedFields)) {
      if (!spec.aliases.some((alias) => key.includes(alias))) continue;
      const combined = values.map((value) => cleanLabeledValue(value, spec.aliases)).filter(Boolean).join('；');
      if (combined) return combined.slice(0, 2000);
    }

    const labelElements = scope.querySelectorAll('span, div, p, label, dt, th');
    let inspected = 0;
    for (const element of labelElements) {
      if (inspected >= 5000) break;
      inspected += 1;
      const ownText = directText(element);
      const fullText = compactText(element.innerText || element.textContent || '');
      const alias = spec.aliases.find((item) => ownText === item || fullText === item);
      if (!alias) continue;
      const candidates = [element.nextElementSibling, element.parentElement, element.parentElement && element.parentElement.parentElement];
      for (const candidate of candidates) {
        if (!candidate) continue;
        const value = cleanLabeledValue(candidate.innerText || candidate.textContent || '', spec.aliases);
        if (value && value.length <= 2000) return value;
      }
    }

    const lines = cleanMultilineText(scope.innerText || scope.textContent || '').split('\n');
    const allLabels = CORE_FIELD_SPECS.flatMap((item) => item.aliases).concat(['粉丝量', '粉丝数', '获赞与收藏', '赞藏量', '赞藏数']);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const alias = spec.aliases.find((item) => line.includes(item));
      if (!alias) continue;
      const inline = cleanLabeledValue(line.slice(line.indexOf(alias) + alias.length), spec.aliases);
      if (inline) return inline;
      const following = [];
      for (let next = index + 1; next < Math.min(lines.length, index + 7); next += 1) {
        if (allLabels.some((label) => lines[next] === label || lines[next].startsWith(`${label}：`) || lines[next].startsWith(`${label}:`))) break;
        following.push(lines[next]);
      }
      const value = cleanLabeledValue(following.join('\n'), spec.aliases);
      if (value) return value;
    }

    for (const selector of spec.selectors || []) {
      for (const element of scope.querySelectorAll(selector)) {
        const text = cleanMultilineText(element.innerText || element.textContent || '');
        if (!text || text.length > 2000) continue;
        const value = cleanLabeledValue(text, spec.aliases);
        if (value) return value;
      }
    }
    return '';
  }

  function pageHasSingleCreator() {
    const redIds = new Set();
    for (const selector of RED_ID_SELECTORS) {
      for (const element of document.querySelectorAll(selector)) {
        const redId = storage.normalizeRedId(element.textContent);
        if (redId) redIds.add(redId);
      }
    }
    return redIds.size === 1;
  }

  function httpUrl(value) {
    if (!value || typeof value !== 'string') return '';
    try {
      const url = new URL(value, location.href);
      return /^https?:$/i.test(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  }

  function elementUrls(element) {
    if (!element) return [];
    const values = [
      element.getAttribute('href'),
      element.href,
      element.getAttribute('data-href'),
      element.getAttribute('data-url'),
      element.getAttribute('data-link'),
      element.getAttribute('data-target'),
      element.getAttribute('data-jump-url'),
      element.getAttribute('data-profile-url'),
      element.getAttribute('data-homepage-url')
    ];
    return [...new Set(values.map(httpUrl).filter(Boolean))];
  }

  function isXhsHomepage(urlInput) {
    try {
      const url = new URL(urlInput);
      return /(^|\.)xiaohongshu\.com$/i.test(url.hostname)
        && !/^pgy\./i.test(url.hostname)
        && /\/user\/profile\//i.test(url.pathname);
    } catch {
      return false;
    }
  }

  function isPgyUrl(urlInput) {
    try { return /^pgy\.xiaohongshu\.com$/i.test(new URL(urlInput).hostname); } catch { return false; }
  }

  function creatorPgyUrl(creator) {
    const fields = creator && creator.capturedFields && typeof creator.capturedFields === 'object'
      ? creator.capturedFields
      : {};
    const capturedUrls = [];
    for (const [key, values] of Object.entries(fields)) {
      if (!/(?:蒲公英.*链接|pgy)/iu.test(key)) continue;
      if (Array.isArray(values)) capturedUrls.push(...values);
      else capturedUrls.push(values);
    }
    const sourceUrl = httpUrl(creator && creator.sourceUrl);
    const candidates = [
      creator && creator.pgyUrl,
      creator && creator.profileUrl,
      ...capturedUrls,
      /\/blogger-detail\//i.test(sourceUrl) ? sourceUrl : ''
    ];
    for (const candidate of candidates) {
      const url = httpUrl(candidate);
      if (url && isPgyUrl(url)) return url;
    }
    return '';
  }

  function homepageFromPgyDetailUrl(urlInput) {
    try {
      const url = new URL(urlInput, location.href);
      if (!isPgyUrl(url.href)) return '';
      const match = url.pathname.match(/\/blogger-detail\/([a-z0-9_-]{16,64})(?:\/|$)/i);
      return match ? `https://www.xiaohongshu.com/user/profile/${match[1]}` : '';
    } catch {
      return '';
    }
  }

  function pageWorldCreatorData(redIdLink) {
    const homepageAttribute = 'data-pgy-resolved-homepage-url';
    const institutionAttribute = 'data-pgy-resolved-institution';
    const fanAgeAttribute = 'data-pgy-resolved-fan-age';
    redIdLink.removeAttribute(homepageAttribute);
    redIdLink.removeAttribute(institutionAttribute);
    redIdLink.removeAttribute(fanAgeAttribute);
    redIdLink.dispatchEvent(new Event('pgy-cart-resolve-link'));
    const homepageUrl = httpUrl(redIdLink.getAttribute(homepageAttribute));
    const institution = compactText(redIdLink.getAttribute(institutionAttribute));
    let fanAgeSegments = {};
    try { fanAgeSegments = JSON.parse(redIdLink.getAttribute(fanAgeAttribute) || '{}'); } catch { fanAgeSegments = {}; }
    redIdLink.removeAttribute(homepageAttribute);
    redIdLink.removeAttribute(institutionAttribute);
    redIdLink.removeAttribute(fanAgeAttribute);
    return {
      homepageUrl: isXhsHomepage(homepageUrl) ? homepageUrl : '',
      institution: institution.length <= 100 ? institution : '',
      fanAgeSegments
    };
  }

  function institutionFromLabeledText(valueInput) {
    const value = compactText(valueInput);
    const match = value.match(/(?:所属机构|签约机构|MCN机构|机构名称|机构)[：:]\s*([^；;|]{1,100})/u);
    return match && match[1] ? compactText(match[1]) : '';
  }

  function visibleInstitution(scope, allowGenericLink) {
    for (const selector of ['.blogger-company__text', '[class*="blogger-company"][class*="text"]']) {
      for (const element of scope.querySelectorAll(selector)) {
        const value = compactText(element.innerText || element.textContent);
        if (value && value !== '无机构' && value.length <= 100) return value;
      }
    }
    for (const selector of ['[class*="mcn"]', '[class*="institution"]', '[class*="agency"]', '[class*="organization"]']) {
      for (const element of scope.querySelectorAll(selector)) {
        const value = compactText(element.innerText || element.textContent);
        if (value && value.length <= 100 && !/^(所属机构|签约机构|MCN机构|机构名称)$/u.test(value)) return value;
      }
    }
    for (const element of scope.querySelectorAll('[title], [aria-label], [data-tooltip], [data-content], [data-title], [aria-describedby]')) {
      for (const name of ['title', 'aria-label', 'data-tooltip', 'data-content', 'data-title']) {
        const value = institutionFromLabeledText(element.getAttribute(name));
        if (value) return value;
      }
      const describedBy = element.getAttribute('aria-describedby');
      if (describedBy) {
        const tooltip = document.getElementById(describedBy);
        const value = tooltip && institutionFromLabeledText(tooltip.innerText || tooltip.textContent);
        if (value) return value;
      }
    }
    const exact = [...scope.querySelectorAll('span,div,p')].find((element) => compactText(element.innerText || element.textContent) === '无机构');
    if (exact) return '无机构';
    const lines = cleanMultilineText(scope.innerText || scope.textContent || '').split('\n');
    for (const line of lines) {
      const match = line.match(/^(?:所属机构|签约机构|MCN机构|机构名称|机构)[：:]?\s*(.{1,100})$/u);
      if (match && match[1]) return compactText(match[1]);
    }
    if (allowGenericLink !== false) {
      for (const element of scope.querySelectorAll('a, [role="link"]')) {
        const value = compactText(element.innerText || element.textContent);
        if (!value || value.length > 50 || /^(?:详情|主页|蒲公英详情|小红书主页|查看更多|无机构)$/u.test(value)) continue;
        if (/^小红书号/u.test(value) || /^\d+(?:\.\d+)?(?:万|亿|w|k)?$/i.test(value)) continue;
        if (element.closest('[class*="redid"], [class*="red-id"], [class*="red_id"]')) continue;
        const href = httpUrl(element.getAttribute('href') || element.href || '');
        if (href && (isXhsHomepage(href) || isPgyUrl(href))) continue;
        let parent = element.parentElement;
        for (let depth = 0; parent && depth < 3; depth += 1, parent = parent.parentElement) {
          const context = compactText(parent.innerText || parent.textContent || '');
          if (context.length > 240) break;
          if (/小红书号|粉丝量|获赞与收藏/u.test(context)) break;
          if (LOCATION_CONTEXT_PATTERN.test(context) && context.includes(value)) return value;
        }
      }
    }
    return '';
  }

  function findCreatorLinks(scope, redIdLink) {
    const redId = storage.normalizeRedId(redIdLink.textContent);
    const sameRedIdLinks = [];
    for (const selector of RED_ID_SELECTORS) {
      for (const candidate of document.querySelectorAll(selector)) {
        if (storage.normalizeRedId(candidate.textContent) === redId) sameRedIdLinks.push(candidate);
      }
    }
    const anchors = [...new Set([...sameRedIdLinks, redIdLink, ...scope.querySelectorAll('a')])];
    let homepageUrl = '';
    let institution = '';
    const fanAgeSegments = {};
    for (const anchor of sameRedIdLinks) {
      const pageData = pageWorldCreatorData(anchor);
      homepageUrl = homepageUrl || elementUrls(anchor).find(isXhsHomepage) || pageData.homepageUrl;
      institution = institution || pageData.institution;
      for (const segment of FAN_AGE_SEGMENTS) {
        if (!fanAgeSegments[segment.key] && pageData.fanAgeSegments[segment.key]) fanAgeSegments[segment.key] = pageData.fanAgeSegments[segment.key];
      }
    }
    if (!homepageUrl) {
      for (const anchor of anchors) {
        const text = compactText(anchor.textContent);
        const candidate = elementUrls(anchor).find((url) => isXhsHomepage(url)
          && (/小红书主页|主页/u.test(text) || /\/user\/profile\//i.test(url)));
        if (candidate) {
          homepageUrl = candidate;
          break;
        }
      }
    }
    const allUrls = anchors.flatMap(elementUrls);
    const pgyUrl = allUrls.find(isPgyUrl)
      || (isPgyUrl(location.href) ? location.href : '');
    homepageUrl = homepageUrl
      || homepageFromPgyDetailUrl(pgyUrl)
      || homepageFromPgyDetailUrl(location.href);
    return {
      homepageUrl,
      pgyUrl,
      institution,
      fanAgeSegments
    };
  }

  function metricFromTable(scope, aliases) {
    return metricNumber(tableColumnText(scope, aliases));
  }

  function extractMetric(scope, aliases, selectors, capturedFields) {
    const tableValue = metricFromTable(scope, aliases);
    if (tableValue) return tableValue;

    const lines = cleanMultilineText(scope.innerText || scope.textContent || '').split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const alias = aliases.find((item) => line.includes(item));
      if (!alias) continue;
      const afterLabel = line.slice(line.indexOf(alias) + alias.length).replace(/^\s*[:：]?\s*/, '');
      const inlineValue = metricNumber(afterLabel);
      if (inlineValue) return inlineValue;
      const nextLineValue = metricNumber(lines[index + 1] || '');
      if (nextLineValue) return nextLineValue;
    }

    for (const selector of selectors) {
      for (const element of scope.querySelectorAll(selector)) {
        const text = compactText(element.innerText || element.textContent || '');
        if (!text || text.length > 100) continue;
        const value = metricNumber(text);
        if (value) return value;
      }
    }

    for (const [key, values] of Object.entries(capturedFields)) {
      if (!aliases.some((alias) => key.includes(alias))) continue;
      for (const value of values) {
        const result = metricNumber(value);
        if (result) return result;
      }
    }
    return '';
  }

  function collectCreator(redIdLink) {
    const redId = storage.normalizeRedId(redIdLink.textContent);
    if (!redId) throw new Error('未识别到小红书号');
    const creatorScope = findCreatorScope(redIdLink);
    const metricScope = pageHasSingleCreator() && document.body ? document.body : creatorScope;
    const image = creatorScope.querySelector('img');
    const capturedFields = captureFields(metricScope);
    const followersCount = extractMetric(
      creatorScope,
      ['粉丝量', '粉丝数', '粉丝'],
      ['[class*="fans"]', '[class*="follower"]'],
      capturedFields
    ) || (metricScope !== creatorScope ? extractMetric(
      metricScope,
      ['粉丝量', '粉丝数', '粉丝'],
      ['[class*="fans"]', '[class*="follower"]'],
      capturedFields
    ) : '');
    const likeCollectCount = extractMetric(
      creatorScope,
      ['获赞与收藏', '赞藏量', '赞藏数', '赞藏中位数', '赞藏'],
      ['[class*="like-collect"]', '[class*="like_collect"]', '[class*="engagement"]', '[class*="interaction"]', '[class*="median"]'],
      capturedFields
    ) || (metricScope !== creatorScope ? extractMetric(
      metricScope,
      ['获赞与收藏', '赞藏量', '赞藏数', '赞藏中位数', '赞藏'],
      ['[class*="like-collect"]', '[class*="like_collect"]', '[class*="engagement"]', '[class*="interaction"]', '[class*="median"]'],
      capturedFields
    ) : '');
    const coreFields = {};
    for (const spec of CORE_FIELD_SPECS) {
      let value = extractLabeledValue(creatorScope, spec, capturedFields);
      if (!value && metricScope !== creatorScope && spec.key !== 'institution') value = extractLabeledValue(metricScope, spec, capturedFields);
      coreFields[spec.key] = value;
      if (value) appendField(capturedFields, spec.label, value);
    }
    const links = findCreatorLinks(metricScope, redIdLink);
    if (!coreFields.institution) {
      coreFields.institution = visibleInstitution(creatorScope, true) || links.institution;
    }
    const fanAgeSegments = extractFanAgeSegments(metricScope, coreFields.fanAgeDistribution, links.fanAgeSegments);
    Object.assign(coreFields, fanAgeSegments);
    if (!coreFields.fanAgeDistribution && Object.keys(fanAgeSegments).length) {
      coreFields.fanAgeDistribution = FAN_AGE_SEGMENTS
        .filter((segment) => fanAgeSegments[segment.key])
        .map((segment) => `${segment.label.replace('占比', '')} ${fanAgeSegments[segment.key]}`)
        .join('；');
    }
    if (coreFields.institution) appendField(capturedFields, '所属机构', coreFields.institution);
    for (const segment of FAN_AGE_SEGMENTS) {
      if (coreFields[segment.key]) appendField(capturedFields, segment.label, coreFields[segment.key]);
    }
    if (followersCount) appendField(capturedFields, '粉丝量', followersCount);
    if (likeCollectCount) appendField(capturedFields, '获赞与收藏', likeCollectCount);
    return {
      redId,
      name: findCreatorName(creatorScope, redId),
      followersCount,
      likeCollectCount,
      ...coreFields,
      homepageUrl: links.homepageUrl,
      pgyUrl: links.pgyUrl,
      profileUrl: links.homepageUrl || links.pgyUrl,
      avatarUrl: image ? (image.currentSrc || image.src || '') : '',
      sourceUrl: location.href,
      sourceTitle: document.title,
      rawVisibleText: cleanMultilineText(creatorScope.innerText || creatorScope.textContent || '').slice(0, 30000),
      capturedFields
    };
  }

  function getRedIdLinks() {
    const links = new Map();
    for (const selector of RED_ID_SELECTORS) {
      for (const element of document.querySelectorAll(selector)) {
        const redId = storage.normalizeRedId(element.textContent);
        if (!redId) continue;
        const existing = links.get(redId);
        if (!existing) {
          links.set(redId, element);
          continue;
        }
        const existingIsPgyLink = /^https:\/\/pgy\.xiaohongshu\.com\//i.test(existing.href || '');
        const candidateIsPgyLink = /^https:\/\/pgy\.xiaohongshu\.com\//i.test(element.href || '');
        if (!existingIsPgyLink && candidateIsPgyLink) links.set(redId, element);
      }
    }
    return [...links.values()];
  }

  function currentCart() {
    if (!state.snapshot) return { creators: {}, order: [] };
    return state.snapshot.carts[state.snapshot.activeProjectId] || { creators: {}, order: [] };
  }

  function findActiveCreatorLink() {
    const links = getRedIdLinks();
    if (!links.length) return null;
    if (links.length === 1) return links[0].closest('.pgy-review-hidden') ? null : links[0];

    const targetY = window.innerHeight * 0.42;
    const visible = links.filter(link => !link.closest('.pgy-review-hidden')).map((link) => {
      const rect = findCreatorScope(link).getBoundingClientRect();
      return { link, rect, distance: Math.abs((rect.top + rect.bottom) / 2 - targetY) };
    }).filter(({ rect }) => rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight);
    visible.sort((left, right) => left.distance - right.distance);
    return visible[0] ? visible[0].link : links.find(link => !link.closest('.pgy-review-hidden')) || null;
  }

  function updateAddButton() {
    const button = document.getElementById('pgy-cart-add-button');
    if (!button) return;
    const redIdLink = state.activeRedIdLink && state.activeRedIdLink.isConnected
      ? state.activeRedIdLink
      : findActiveCreatorLink();
    state.activeRedIdLink = redIdLink;
    button.hidden = !redIdLink;
    if (!redIdLink) return;

    const redId = storage.normalizeRedId(redIdLink.textContent);
    const isAdded = Boolean(currentCart().creators[redId]);
    const creatorName = findCreatorName(findCreatorScope(redIdLink), redId);
    button.dataset.redId = redId;
    button.dataset.added = String(isAdded);
    button.title = isAdded ? `${creatorName} 已在当前购物车中` : `将 ${creatorName} 加入购物车`;
    button.setAttribute('aria-label', button.title);
    button.setAttribute('aria-pressed', String(isAdded));
  }

  function findNativeFeedbackAnchor() {
    const candidates = [];
    const iterator = document.evaluate(
      '//*[normalize-space(text())="反馈"]',
      document,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );
    let element = iterator.snapshotItem(0);
    let matched = 0;
    while (element && matched < 20) {
      let current = element;
      for (let depth = 0; current && depth < 5; depth += 1, current = current.parentElement) {
        if (current.closest && current.closest('#pgy-cart-extension-root')) break;
        const rect = current.getBoundingClientRect();
        const text = compactText(current.innerText || current.textContent || '');
        const visible = text === '反馈'
          && rect.width >= 44
          && rect.width <= 110
          && rect.height >= 44
          && rect.height <= 130
          && rect.right > window.innerWidth * 0.65
          && rect.top >= 0
          && rect.bottom <= window.innerHeight + 1;
        if (visible) candidates.push({ element: current, rect });
      }
      matched += 1;
      element = iterator.snapshotItem(matched);
    }
    candidates.sort((left, right) => {
      const rightDistance = Math.abs(window.innerWidth - left.rect.right) - Math.abs(window.innerWidth - right.rect.right);
      if (rightDistance) return rightDistance;
      const targetArea = 48 * 58;
      return Math.abs(left.rect.width * left.rect.height - targetArea) - Math.abs(right.rect.width * right.rect.height - targetArea);
    });
    return candidates[0] || null;
  }

  function positionFloatingActions() {
    const actions = document.getElementById('pgy-cart-floating-actions');
    if (!actions) return;
    const metricProperties = [
      '--pgy-cart-side-width',
      '--pgy-cart-side-height',
      '--pgy-cart-side-radius',
      '--pgy-cart-side-gap',
      '--pgy-cart-side-icon-size',
      '--pgy-cart-side-icon-color',
      '--pgy-cart-side-text',
      '--pgy-cart-side-font-size',
      '--pgy-cart-side-line-height'
    ];
    const anchor = findNativeFeedbackAnchor();
    if (!anchor) {
      delete actions.dataset.nativeAnchor;
      actions.style.removeProperty('top');
      actions.style.removeProperty('right');
      actions.style.removeProperty('bottom');
      for (const property of metricProperties) actions.style.removeProperty(property);
      return;
    }

    const nativeButton = anchor.element.closest('.sidebar-wrapper') || anchor.element;
    const nativeRect = nativeButton.getBoundingClientRect();
    const nativeStyle = getComputedStyle(nativeButton);
    const nativeIcon = nativeButton.querySelector('.sidebar-item-icon, svg');
    const nativeIconStyle = nativeIcon && getComputedStyle(nativeIcon);
    const nativeIconRect = nativeIcon && nativeIcon.getBoundingClientRect();
    const nativeLabel = nativeButton.querySelector('.sidebar-item-text');
    const nativeLabelStyle = nativeLabel && getComputedStyle(nativeLabel);
    const nativeGap = Math.max(8, Number.parseFloat(nativeStyle.marginTop) || 12);

    actions.style.setProperty('--pgy-cart-side-width', `${nativeRect.width}px`);
    actions.style.setProperty('--pgy-cart-side-height', `${nativeRect.height}px`);
    actions.style.setProperty('--pgy-cart-side-radius', nativeStyle.borderRadius || '8px');
    actions.style.setProperty('--pgy-cart-side-gap', `${nativeGap}px`);
    actions.style.setProperty('--pgy-cart-side-icon-size', `${nativeIconRect && nativeIconRect.width ? nativeIconRect.width : 20}px`);
    actions.style.setProperty('--pgy-cart-side-icon-color', nativeIconStyle ? nativeIconStyle.color : '#4b4b52');
    actions.style.setProperty('--pgy-cart-side-text', nativeLabelStyle ? nativeLabelStyle.color : 'rgba(1, 1, 11, 0.71)');
    actions.style.setProperty('--pgy-cart-side-font-size', nativeLabelStyle ? nativeLabelStyle.fontSize : '12px');
    actions.style.setProperty('--pgy-cart-side-line-height', nativeLabelStyle ? nativeLabelStyle.lineHeight : '20px');

    const actionsRect = actions.getBoundingClientRect();
    const right = Math.max(12, Math.round(window.innerWidth - nativeRect.right));
    const top = Math.max(8, Math.round(nativeRect.top - actionsRect.height - nativeGap));
    actions.dataset.nativeAnchor = 'true';
    actions.style.right = `${right}px`;
    actions.style.top = `${top}px`;
    actions.style.bottom = 'auto';
  }

  function positionSideActions() {
    state.sidePositionFrame = 0;
    positionFloatingActions();
  }

  function scheduleSideActionPositions() {
    if (state.sidePositionFrame) return;
    state.sidePositionFrame = window.requestAnimationFrame(positionSideActions);
  }

  function scheduleViewportUpdate() {
    if (state.viewportFrame) return;
    state.viewportFrame = window.requestAnimationFrame(() => {
      state.viewportFrame = 0;
      state.activeRedIdLink = findActiveCreatorLink();
      updateAddButton();
      scheduleSideActionPositions();
    });
  }

  async function addActiveCreator(button) {
    const redIdLink = findActiveCreatorLink();
    state.activeRedIdLink = redIdLink;
    if (!redIdLink) {
      showToast('当前页面未识别到达人');
      updateAddButton();
      return;
    }
    button.disabled = true;
    try {
      const redId = storage.normalizeRedId(redIdLink.textContent);
      const cart = currentCart();
      const project = state.snapshot.projects[state.snapshot.activeProjectId];
      if (cart.creators[redId]) {
        showToast(`${redId} 已在“${project.name}”中`);
      } else {
        await storage.upsertCreator(collectCreator(redIdLink), state.snapshot.activeProjectId);
        showToast(`${redId} 已加入“${project.name}”`);
      }
    } catch (error) {
      showToast(error.message || '操作失败');
    } finally {
      button.disabled = false;
    }
  }

  let reviewUI;
  const markedScopes = new Set();
  function listAnchors() {
    return [...document.querySelectorAll('table .kol-info .kol-name')].filter(anchor => {
      const row = anchor.closest('tr');
      return row && row.getBoundingClientRect().height > 0 && row.closest('table').getBoundingClientRect().width > 0;
    });
  }
  function listCreator(anchor) {
    anchor.dispatchEvent(new CustomEvent('pgy-cart-resolve-list-identity', { bubbles: true }));
    let identity;
    try { identity = JSON.parse(anchor.getAttribute('data-pgy-list-identity')); } catch { return null; }
    if (!identity || identity.name !== compactText(anchor.textContent) || !/^[a-f0-9]{24}$/i.test(identity.profileId)) return null;
    const row = anchor.closest('tr');
    const creator = { name: identity.name, profileId: identity.profileId,
      redId: identity.redId || `pgy:${identity.profileId}`,
      pgyUrl: `https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/${identity.profileId}`,
      avatarUrl: row.querySelector('.head-photo')?.src || '', sourceUrl: location.href };
    const cart = currentCart();
    const saved = storage.findCreator(cart.creators, creator) || storage.findCreator(cart.excluded, creator);
    if (saved && storage.displayRedId(saved)) creator.redId = saved.redId;
    const headers = [...row.closest('table').querySelectorAll('thead th')];
    const fields = { fansCount: 'followersCount', accumCommonImpMedinNum30d: 'medianImpressions', clickNum: 'medianReads', mEngagementNum: 'medianInteractions' };
    headers.forEach((header, index) => {
      const field = fields[header.dataset.key];
      if (field) creator[field] = compactText(row.cells[index]?.textContent);
    });
    creator.creatorLocation = compactText(row.querySelector('.kol-location')?.textContent);
    creator.contentCategories = [...row.querySelectorAll('.kol-tag-item:not(.more)')].map(el => compactText(el.textContent)).join('、');
    return creator;
  }
  function entryCreator(anchor) {
    if (anchor.matches('.kol-name')) return listCreator(anchor);
    const redId = storage.normalizeRedId(anchor.textContent);
    return { redId, name: findCreatorName(findCreatorScope(anchor), redId),
      pgyUrl: anchor.href || '', profileId: storage.profileId({pgyUrl: anchor.href || location.href}) };
  }
  function pageStatus() {
    const anchors = listAnchors();
    const unresolved = anchors.filter(anchor => !listCreator(anchor)).length;
    return { total: anchors.length || pageEntries().length, unresolved };
  }
  async function finishPage() {
    if (pageStatus().unresolved) throw new Error('本页有达人尚未可靠识别，请刷新页面后重试；未执行批量排除。');
    const creators = pageCreators();
    if (!creators.length) throw new Error('当前没有可筛选的达人列表');
    await storage.excludeCreators(creators, state.snapshot.activeProjectId);
    await applySnapshot(await storage.getState());
    showToast('本页筛选完成，已添加达人已保留；可撤销');
  }
  function pageEntries() {
    return [...listAnchors(), ...getRedIdLinks().filter(link => {
      if (link.closest('#pgy-cart-extension-root')) return false;
      const scope = link.closest(CREATOR_SCOPE_SELECTORS);
      if (!scope) return false;
      const ids = new Set([...scope.querySelectorAll(RED_ID_SELECTORS.join(','))].map(el => storage.normalizeRedId(el.textContent)));
      if (ids.size !== 1) return false;
      const rect = scope.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && (getComputedStyle(scope).visibility !== 'hidden' || scope.classList.contains('pgy-review-hidden'));
    })];
  }
  function pageCreators() {
    return pageEntries().map(entryCreator).filter(Boolean);
  }
  function markPage() {
    if (!state.snapshot) return;
    const cart = currentCart(), active = new Set();
    for (const link of pageEntries()) {
      const scope = link.closest(CREATOR_SCOPE_SELECTORS);
      const creator = entryCreator(link);
      const excluded = Boolean(creator && storage.findCreator(cart.excluded, creator));
      const added = Boolean(creator && storage.findCreator(cart.creators, creator));
      active.add(scope); markedScopes.add(scope);
      scope.classList.toggle('pgy-review-hidden', excluded && cart.hideExcluded);
      if (link.matches('.kol-name')) {
        const card = link.closest('.kol-info');
        let controls = card.querySelector('.pgy-row-actions');
        if (!controls) {
          controls = document.createElement('div'); controls.className = 'pgy-row-actions';
          card.append(controls);
          controls.addEventListener('click', async event => {
            const button = event.target.closest('button'); if (!button) return;
            event.preventDefault(); event.stopPropagation();
            const current = listCreator(link); if (!current) return showToast('未能可靠识别该达人');
            button.disabled = true;
            try {
              const id = state.snapshot.activeProjectId;
              if (button.dataset.action === 'add') await storage.upsertCreator(current, id);
              if (button.dataset.action === 'exclude') await storage.excludeCreators([current], id, '手动排除');
              if (button.dataset.action === 'restore') {
                const record = storage.findCreator(currentCart().excluded, current);
                if (record) await storage.restoreCreators([record.redId], id);
              }
              await applySnapshot(await storage.getState());
            } catch (error) { showToast(error.message); } finally { button.disabled = false; }
          });
        }
        const markup = !creator ? '<span>暂未识别，未参与筛选</span>' : added ? '<span class="pgy-row-added">本项目已添加</span>' : excluded ? '<span>本项目已排除</span><button data-action="restore">恢复</button>' : '<button data-action="add">加入购物车</button><button data-action="exclude">排除</button>';
        if (controls.innerHTML !== markup) controls.innerHTML = markup;
        continue;
      }
      let mark = scope.querySelector('.pgy-review-mark');
      if (excluded && !mark) { mark = document.createElement('span'); mark.className = 'pgy-review-mark'; mark.textContent = '本项目已排除'; link.after(mark); }
      if (!excluded && mark) mark.remove();
    }
    for (const scope of markedScopes) if (!active.has(scope)) { scope.classList.remove('pgy-review-hidden'); scope.querySelectorAll('.pgy-review-mark, .pgy-row-actions').forEach(el => el.remove()); markedScopes.delete(scope); }
    updatePageBar();
  }
  function updatePageBar() {
    const bar = document.getElementById('pgy-page-bar'); if (!bar || !state.snapshot) return;
    const page = pageCreators(), cart = currentCart(), status = pageStatus();
    const added = page.filter(c => storage.findCreator(cart.creators, c)).length;
    const excluded = page.filter(c => storage.findCreator(cart.excluded, c)).length;
    bar.hidden = !status.total;
    bar.querySelector('[data-page-info]').textContent = `${state.snapshot.projects[state.snapshot.activeProjectId].name} · 本页 ${status.total} 位 · 已添加 ${added} · 已排除 ${excluded}${status.unresolved ? ` · 未识别 ${status.unresolved}` : ''}`;
    bar.querySelector('[data-page-finish]').disabled = Boolean(status.unresolved) || page.length === added + excluded;
    bar.querySelector('[data-page-undo]').disabled = !cart.lastScreening;
    bar.querySelector('[data-page-hide]').checked = cart.hideExcluded;
    const reject = document.getElementById('pgy-detail-exclude');
    if (reject) {
      const link = getRedIdLinks().length === 1 ? getRedIdLinks()[0] : null;
      reject.hidden = !link || !!status.total;
      if (link) {
        const creator = entryCreator(link), saved = storage.findCreator(cart.creators, creator);
        reject.disabled = Boolean(saved);
        reject.textContent = saved ? '已添加' : storage.findCreator(cart.excluded, creator) ? '恢复达人' : '排除此人';
      }
    }
  }
  function scanPage() {
    markPage();
    if (reviewUI && document.querySelector('[data-backdrop][data-open="true"]')) reviewUI.render();
    state.activeRedIdLink = findActiveCreatorLink();
    updateAddButton();
    scheduleSideActionPositions();
    autoUpdateDetail();
  }

  function randomBetween(min, max) {
    return Math.round(min + Math.random() * (max - min));
  }

  function batchMarker() {
    const params = new URLSearchParams(location.hash.replace(/^#/, ''));
    return params.get('pgy-cart-batch') || '';
  }

  function batchDetailUrl(item, job) {
    const url = new URL(storage.creatorDetailUrl(item));
    url.hash = new URLSearchParams({
      'pgy-cart-project': job.projectId,
      'pgy-cart-batch': job.id
    }).toString();
    return url.href;
  }

  function batchCandidates(scope) {
    const cart = currentCart();
    const selected = state.selectedRedIds;
    const now = Date.now();
    return storage.creatorsAsList(cart).filter((creator) => {
      if (!storage.creatorDetailUrl(creator)) return false;
      if (scope === 'selected') return selected.has(creator.redId);
      if (scope === 'stale') {
        const updated = new Date(creator.lastDetailUpdatedAt || 0).getTime();
        return !updated || now - updated >= BATCH_STALE_MS;
      }
      return true;
    });
  }

  function renderBatchPanel() {
    const root = document.getElementById('pgy-cart-extension-root');
    const panel = root && root.querySelector('[data-batch-panel]');
    const floating = root && root.querySelector('[data-batch-floating]');
    if (!panel || !floating || !state.snapshot) return;
    const job = state.batchJob;
    const progress = panel.querySelector('[data-batch-progress]');
    const setup = panel.querySelector('[data-batch-setup]');
    const activeJob = job && !['completed','cancelled'].includes(job.status);
    setup.hidden = Boolean(activeJob);
    progress.hidden = !activeJob;
    floating.hidden = !activeJob;
    if (!activeJob) return;
    const total = job.queue.length;
    const done = Math.min(job.index, total);
    const current = job.queue[done];
    const statusText = job.status === 'paused' ? '已暂停' : job.status === 'error' ? '已中断' : '正在更新';
    const waitSeconds = job.nextAt && job.status === 'running' ? Math.max(0, Math.ceil((job.nextAt - Date.now()) / 1000)) : 0;
    panel.querySelector('[data-batch-summary]').textContent = `${job.projectName} · ${statusText} · ${done} / ${total}${current ? ` · 下一位：${current.name}` : ''}${waitSeconds ? ` · ${waitSeconds} 秒后继续` : ''}`;
    panel.querySelector('[data-batch-counts]').textContent = `成功 ${job.success || 0} · 失败 ${job.failed || 0} · 跳过 ${job.skipped || 0}${job.lastError ? ` · ${job.lastError}` : ''}`;
    panel.querySelector('[data-batch-meter]').value = done;
    panel.querySelector('[data-batch-meter]').max = total || 1;
    panel.querySelector('[data-batch-pause]').hidden = job.status !== 'running';
    panel.querySelector('[data-batch-resume]').hidden = job.status === 'running';
    floating.querySelector('[data-batch-floating-summary]').textContent = `${job.projectName} · ${statusText} ${done}/${total}${current ? ` · ${current.name}` : ''}${waitSeconds ? ` · ${waitSeconds}s` : ''}`;
    floating.querySelector('[data-batch-floating-meter]').value = done;
    floating.querySelector('[data-batch-floating-meter]').max = total || 1;
    floating.querySelector('[data-batch-floating-counts]').textContent = `成功 ${job.success || 0} · 失败 ${job.failed || 0}${job.lastError ? ` · ${job.lastError}` : ''}`;
    floating.querySelector('[data-batch-pause]').hidden = job.status !== 'running';
    floating.querySelector('[data-batch-resume]').hidden = job.status === 'running';
  }

  async function setBatchStatus(status) {
    const job = state.batchJob;
    if (!job) return;
    state.batchJob = await storage.updateBatchJob(job.id, current => current && ({...current,status,lastError:status === 'running' ? '' : current.lastError,runnerHeartbeat:status === 'running' ? 0 : current.runnerHeartbeat,runnerExpectedBy:status === 'running' ? Date.now() + 30000 : current.runnerExpectedBy,updatedAt:new Date().toISOString()}));
    renderBatchPanel();
  }

  async function startBatchUpdate() {
    const panel = document.querySelector('#pgy-cart-extension-root [data-batch-panel]');
    if (state.batchJob && !['completed','cancelled'].includes(state.batchJob.status)) {
      showToast(`“${state.batchJob.projectName}”已有批量更新任务`);
      return;
    }
    const scope = panel.querySelector('[data-batch-scope]').value;
    const candidates = batchCandidates(scope);
    if (!candidates.length) {
      showToast(scope === 'stale' ? '没有资料缺失或超过 7 天未更新的达人' : '没有可批量更新的达人');
      return;
    }
    const queue = candidates.slice(0, BATCH_LIMIT).map(creator => ({
      redId: creator.redId,
      profileId: storage.profileId(creator),
      name: creator.name || storage.displayRedId(creator) || '未命名达人'
    }));
    const job = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      projectId: state.snapshot.activeProjectId,
      projectName: state.snapshot.projects[state.snapshot.activeProjectId].name,
      scope,
      queue,
      index: 0,
      success: 0,
      failed: 0,
      skipped: Math.max(0, candidates.length - queue.length),
      status: 'running',
      runnerHeartbeat: 0,
      runnerExpectedBy: Date.now() + 30000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      returnUrl: location.href.split('#')[0]
    };
    state.batchJob = await storage.updateBatchJob(null, job);
    renderBatchPanel();
    const updateTab = window.open(batchDetailUrl(queue[0], job), `pgy-cart-batch-${job.id}`);
    if (!updateTab) {
      await storage.updateBatchJob(job.id, current => ({...current,status:'error',lastError:'浏览器阻止了更新标签页，请允许弹出窗口后继续'}));
      showToast('浏览器阻止了更新标签页，请允许弹出窗口');
      return;
    }
    state.batchWindow = updateTab;
    try { updateTab.blur(); window.focus(); } catch { /* Browser may keep the new tab active. */ }
    showToast(`开始更新 ${queue.length} 位达人${job.skipped ? `，其余 ${job.skipped} 位留待下一批` : ''}`);
  }

  function scheduleBatchRunner() {
    if (state.batchTimer) return;
    state.batchTimer = window.setInterval(runBatchRunner, 1000);
  }

  async function runBatchRunner() {
    const marker = batchMarker();
    if (!marker) return;
    let job = await storage.getBatchJob();
    state.batchJob = job;
    renderBatchPanel();
    if (job && job.id === marker && job.status === 'running' && Date.now() - (job.runnerHeartbeat || 0) >= 2500) {
      job = await storage.updateBatchJob(job.id, current => ({...current,runnerHeartbeat:Date.now(),runnerProfileId:location.pathname.match(/\/blogger-detail\/([a-f0-9]{24})/i)?.[1]?.toLowerCase() || '',updatedAt:new Date().toISOString()}));
      state.batchJob = job;
    }
    if (!job || job.id !== marker || job.status !== 'running' || !job.nextAt || Date.now() < job.nextAt) return;
    if (job.index >= job.queue.length) {
      state.batchJob = await storage.updateBatchJob(job.id, current => ({...current,status:'completed',completedAt:new Date().toISOString(),updatedAt:new Date().toISOString()}));
      const status = document.getElementById('pgy-auto-detail-status');
      if (status) { status.hidden = false; status.textContent = `批量更新完成 · 成功 ${job.success || 0} · 失败 ${job.failed || 0}`; }
      clearInterval(state.batchTimer); state.batchTimer = 0;
      return;
    }
    location.replace(batchDetailUrl(job.queue[job.index], job));
  }

  async function monitorBatchRunner() {
    if (batchMarker()) return;
    const job = await storage.getBatchJob();
    state.batchJob = job;
    renderBatchPanel();
    if (!job || job.status !== 'running') return;
    const windowClosed = state.batchWindow && state.batchWindow.closed;
    const heartbeatExpired = job.runnerHeartbeat
      ? Date.now() - job.runnerHeartbeat > 8000
      : Date.now() > (job.runnerExpectedBy || 0);
    if (!windowClosed && !heartbeatExpired) return;
    state.batchWindow = null;
    state.batchJob = await storage.updateBatchJob(job.id, current => current && current.status === 'running' ? ({...current,status:'error',lastError:'更新标签页已关闭，点击“继续”可从当前达人恢复',updatedAt:new Date().toISOString()}) : current);
    renderBatchPanel();
  }

  async function completeBatchItem(task) {
    const marker = batchMarker();
    if (!marker || task.batchCompleted || task.batchCompleting) return;
    task.batchCompleting = true;
    try {
      const job = await storage.getBatchJob();
      if (!job || job.id !== marker || job.status !== 'running') return;
      const expected = job.queue[job.index];
      if (!expected || expected.profileId !== task.key) {
        await storage.updateBatchJob(job.id, current => ({...current,status:'error',lastError:'更新标签页与任务进度不一致，已停止',updatedAt:new Date().toISOString()}));
        task.batchCompleted = true;
        return;
      }
      const nextIndex = job.index + 1;
      let delay = randomBetween(BATCH_STEP_MIN_MS, BATCH_STEP_MAX_MS);
      if (nextIndex < job.queue.length && nextIndex % 10 === 0) delay += randomBetween(BATCH_BREAK_MIN_MS, BATCH_BREAK_MAX_MS);
      state.batchJob = await storage.advanceBatchJob(job.id, task.key, {
        nextAt: Date.now() + delay,
        lastError: ''
      });
      if (!state.batchJob || state.batchJob.index <= job.index) return;
      task.batchCompleted = true;
      renderBatchPanel();
      scheduleBatchRunner();
    } finally {
      task.batchCompleting = false;
    }
  }

  let autoDetail;
  async function autoUpdateDetail() {
    const route = location.pathname.match(/\/blogger-detail\/([a-f0-9]{24})(?:\/|$)/i);
    if (!route || !state.snapshot) return;
    const key = route[1].toLowerCase();
    if (!autoDetail || autoDetail.key !== key) autoDetail = {key,started:Date.now(),lastRead:0,inFlight:false,signature:'',saved:false};
    const task = autoDetail;
    if (task.saved && batchMarker() && !task.batchCompleted) await completeBatchItem(task);
    if (batchMarker() && !task.saved && !task.batchCompleted && Date.now() - task.started > 60000) {
      task.batchCompleted = true;
      const job = await storage.getBatchJob();
      if (job && job.id === batchMarker()) {
        state.batchJob = await storage.updateBatchJob(job.id, current => ({...current,status:'error',failed:(current.failed || 0) + 1,lastError:'当前达人主页 60 秒内未能读取数据，已停止',updatedAt:new Date().toISOString()}));
        renderBatchPanel();
      }
      return;
    }
    if (task.inFlight || Date.now() - task.lastRead < 1500 || Date.now() - task.started > 120000) return;
    const links = getRedIdLinks(); if (links.length !== 1) return;
    task.lastRead = Date.now(); task.inFlight = true;
    try {
      const creator = collectCreator(links[0]);
      creator.profileId = route[1];
      // Keep export URLs clean and independent of the local update marker.
      creator.sourceUrl = location.origin + location.pathname;
      creator.pgyUrl = location.origin + location.pathname;
      const projectIds = state.snapshot.projectOrder.filter(projectId => storage.findCreator(state.snapshot.carts[projectId].creators, creator));
      if (!projectIds.length) return;
      if (![creator.followersCount,creator.likeCollectCount,creator.imagePrice,creator.videoPrice,creator.medianReads].some(Boolean)) return;
      const signature = JSON.stringify(creator);
      if (signature === task.signature) return;
      const next = await storage.updateMatchingCreators(creator);
      task.signature = signature;
      const names = projectIds.filter(projectId => storage.findCreator(next.carts[projectId]?.creators,creator)).map(projectId => next.projects[projectId].name);
      if (!names.length) return;
      const destination = names.length === 1 ? `“${names[0]}”` : `${names.length} 个项目`;
      if (!task.saved) showToast(`已自动更新${destination}中的 ${creator.name}`);
      task.saved = true;
      const status = document.getElementById('pgy-auto-detail-status');
      if (status) { status.hidden = false; status.textContent = `已自动更新 · ${names.length === 1 ? names[0] : `${names.length} 个项目`}`; status.title = '当前详情页已加载的数据已保存到所有包含该达人的购物车，后续加载内容会继续补充'; }
      await completeBatchItem(task);
    } catch (error) {
      const status = document.getElementById('pgy-auto-detail-status');
      if (status) { status.hidden=false; status.textContent='自动更新暂未完成，可点击“更新本页已添加达人”重试'; }
    } finally { task.inFlight = false; }
  }

  function scheduleScan() {
    if (state.scanTimer) return;
    state.scanTimer = setTimeout(() => { state.scanTimer = 0; scanPage(); }, 180);
  }

  function showToast(message, action) {
    const toast = document.querySelector('#pgy-cart-extension-root .pgy-cart-toast');
    if (!toast) return;
    toast.querySelector('[data-toast-message]').textContent = message;
    const actionButton = toast.querySelector('[data-toast-action]');
    state.toastAction = typeof action === 'function' ? action : null;
    actionButton.hidden = !state.toastAction;
    actionButton.disabled = false;
    toast.dataset.visible = 'true';
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => {
      toast.dataset.visible = 'false';
      state.toastAction = null;
    }, state.toastAction ? 6500 : 1800);
  }

  async function showRemovalUndo({ creator, projectId, index, excluded }) {
    showToast(excluded ? `已将“${creator.name || creator.redId}”移除并排除` : `已移除“${creator.name || creator.redId}”`, async () => {
      await storage.restoreRemovedCreator(creator, projectId, index);
      showToast(`已恢复“${creator.name || creator.redId}”`);
    });
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

  function projectOptions(snapshot) {
    return snapshot.projectOrder.map((projectId) => {
      const project = snapshot.projects[projectId];
      const count = snapshot.carts[projectId].order.length;
      const selected = projectId === snapshot.activeProjectId ? ' selected' : '';
      return `<option value="${escapeHtml(projectId)}"${selected}>${escapeHtml(project.name)}（${count}）</option>`;
    }).join('');
  }

  function syncSelection(creators) {
    const activeId = state.snapshot.activeProjectId;
    const redIds = creators.map((creator) => creator.redId);
    if (state.selectedProjectId !== activeId) {
      state.selectedProjectId = activeId;
      state.selectedRedIds = new Set(redIds);
      return;
    }
    for (const redId of [...state.selectedRedIds]) {
      if (!redIds.includes(redId)) state.selectedRedIds.delete(redId);
    }
    for (const redId of redIds) {
      if (!state.selectedRedIds.has(redId) && !document.querySelector(`[data-pgy-red-id="${CSS.escape(redId)}"]`)) {
        state.selectedRedIds.add(redId);
      }
    }
  }

  function renderDrawer() {
    renderDrawerContent();
    if (reviewUI) reviewUI.render();
  }

  function renderDrawerContent() {
    if (!state.snapshot) return;
    const snapshot = state.snapshot;
    const cart = currentCart();
    const creators = storage.creatorsAsList(cart);
    syncSelection(creators);
    const project = snapshot.projects[snapshot.activeProjectId];
    const root = document.getElementById('pgy-cart-extension-root');
    root.querySelector('[data-project-select]').innerHTML = projectOptions(snapshot);
    const floatingButton = root.querySelector('#pgy-cart-floating-button');
    floatingButton.title = `打开“${project.name}”达人购物车`;
    floatingButton.setAttribute('aria-label', `打开“${project.name}”达人购物车，共 ${creators.length} 位达人`);
    root.querySelector('[data-floating-count]').textContent = String(creators.length);
    root.querySelector('[data-selection-summary]').textContent = `已选 ${state.selectedRedIds.size} / ${creators.length}`;
    root.querySelector('[data-export]').textContent = `下载“${project.name}”Excel（${state.selectedRedIds.size}）`;
    root.querySelector('[data-export]').disabled = state.selectedRedIds.size === 0;
    root.querySelector('[data-delete-project]').disabled = snapshot.projectOrder.length <= 1;
    renderBatchPanel();

    const list = root.querySelector('[data-cart-list]');
    if (!creators.length) {
      list.innerHTML = `<div class="pgy-cart-list-empty pgy-creator-empty">“${escapeHtml(project.name)}”还没有达人<br>请点击页面侧边的“加入”按钮</div>`;
      return;
    }

    list.innerHTML = creators.map((creator) => {
      const selected = state.selectedRedIds.has(creator.redId) ? ' checked' : '';
      const followers = storedMetric(creator, 'followersCount', ['粉丝量', '粉丝数', '粉丝']);
      const likeCollect = storedMetric(creator, 'likeCollectCount', ['获赞与收藏', '赞藏量', '赞藏数', '赞藏中位数', '赞藏']);
      const addedAt = storage.formatLocalDateTime(creator.firstAddedAt || creator.lastUpdatedAt);
      const detailUpdatedAt = storage.formatLocalDateTime(creator.lastDetailUpdatedAt);
      const name = escapeHtml(creator.name || creator.redId);
      const pgyUrl = storage.cartDetailUrl(creator, snapshot.activeProjectId) || creatorPgyUrl(creator);
      const nameMarkup = pgyUrl
        ? `<a class="pgy-cart-creator-name pgy-cart-creator-link pgy-creator-name pgy-creator-name-link" href="${escapeHtml(pgyUrl)}" target="_blank" rel="noopener noreferrer" title="打开 ${name} 的蒲公英主页">${name}</a>`
        : `<div class="pgy-cart-creator-name pgy-creator-name">${name}</div>`;
      return `<div class="pgy-cart-list-item pgy-creator-row" data-pgy-red-id="${escapeHtml(creator.redId)}">
        <input class="pgy-creator-select" type="checkbox" aria-label="选择 ${escapeHtml(creator.name || creator.redId)}"${selected}>
        <div class="pgy-creator-content">
          ${nameMarkup}
          <div class="pgy-cart-creator-id pgy-creator-meta">${storage.displayRedId(creator) ? `小红书号：${escapeHtml(storage.displayRedId(creator))}` : '红书号待详情页补充'}</div>
          <div class="pgy-cart-creator-stats pgy-creator-meta pgy-creator-meta-primary">粉丝量：${escapeHtml(followers)} · 获赞与收藏：${escapeHtml(likeCollect)}</div>
          ${addedAt ? `<div class="pgy-cart-creator-stats pgy-creator-meta pgy-creator-meta-primary">添加时间：${escapeHtml(addedAt)}</div>` : ''}
          ${detailUpdatedAt ? `<div class="pgy-cart-creator-stats pgy-cart-creator-updated pgy-creator-meta pgy-creator-meta-success">已从主页更新 · ${escapeHtml(detailUpdatedAt)}</div>` : ''}
        </div>
        <div class="pgy-cart-row-actions pgy-creator-actions"><button type="button" class="pgy-cart-remove-button pgy-creator-action" data-remove="${escapeHtml(creator.redId)}">移除</button></div>
      </div>`;
    }).join('');

    for (const item of list.querySelectorAll('[data-pgy-red-id]')) {
      const redId = item.dataset.pgyRedId;
      item.querySelector('input').addEventListener('change', (event) => {
        if (event.target.checked) state.selectedRedIds.add(redId);
        else state.selectedRedIds.delete(redId);
        renderDrawer();
      });
    }
    for (const button of list.querySelectorAll('[data-remove]')) {
      button.addEventListener('click', async () => {
        const redId = button.dataset.remove;
        const creator = cart.creators[redId];
        const index = cart.order.indexOf(redId);
        await storage.removeCreator(redId, snapshot.activeProjectId);
        await showRemovalUndo({ creator, projectId: snapshot.activeProjectId, index, excluded: false });
      });
    }
  }

  async function refreshVisibleCreators() {
    const activeProjectId = state.snapshot.activeProjectId;
    const stored = currentCart().creators;
    let updated = 0;
    for (const link of getRedIdLinks()) {
      const creator = collectCreator(link);
      if (!storage.findCreator(stored, creator)) continue;
      await storage.updateExistingCreator(creator, activeProjectId);
      updated += 1;
    }
    showToast(updated ? `已更新当前页面的 ${updated} 位达人` : '当前页面没有已加入的达人');
  }

  function createRoot() {
    const root = document.createElement('div');
    root.id = 'pgy-cart-extension-root';
    root.innerHTML = `
      <nav id="pgy-cart-floating-actions" aria-label="达人购物车操作">
        <button type="button" id="pgy-cart-add-button" class="pgy-cart-side-button" aria-label="加入购物车" aria-pressed="false" hidden>
          <span class="pgy-cart-side-icon-slot">
            <svg class="pgy-cart-side-icon" viewBox="0 0 28 28" aria-hidden="true">
              <path d="M14 5.5v17M5.5 14h17"/>
            </svg>
          </span>
          <span class="pgy-cart-side-label">加入</span>
        </button>
        <button type="button" id="pgy-cart-floating-button" class="pgy-cart-side-button" aria-label="打开达人购物车">
          <span class="pgy-cart-side-icon-slot">
            <svg class="pgy-cart-side-icon" viewBox="0 0 28 28" aria-hidden="true">
              <path d="M4 5.5h2.7l1.5 11h12.3l1.8-7.5H7.2"/>
              <circle cx="10.5" cy="22" r="1.45"/>
              <circle cx="19" cy="22" r="1.45"/>
            </svg>
          </span>
          <span class="pgy-cart-side-label">购物车</span>
          <span class="pgy-cart-count" data-floating-count>0</span>
        </button>
      </nav>
      <div class="pgy-cart-backdrop" data-backdrop data-open="false">
        <aside class="pgy-cart-drawer" role="dialog" aria-modal="true" aria-labelledby="pgy-cart-drawer-title">
          <div class="pgy-cart-drawer-header">
            <div class="pgy-cart-drawer-title"><strong id="pgy-cart-drawer-title">达人购物车</strong><span>按项目保存，关闭浏览器后仍会保留</span></div>
            <button type="button" class="pgy-cart-icon-button" data-close aria-label="关闭">×</button>
          </div>
          <div class="pgy-cart-projectbar">
            <label for="pgy-cart-project-select">当前项目</label>
            <select id="pgy-cart-project-select" data-project-select></select>
            <button type="button" class="pgy-cart-text-button" data-create-project>新建</button>
            <button type="button" class="pgy-cart-text-button" data-delete-project>删除</button>
          </div>
          <div class="pgy-cart-toolbar">
            <button type="button" class="pgy-cart-text-button" data-refresh>更新本页已添加达人</button>
            <button type="button" class="pgy-cart-text-button" data-batch-toggle>批量更新资料</button>
            <button type="button" class="pgy-cart-text-button" data-clear>清空当前项目</button>
            <span class="pgy-cart-selection-summary" data-selection-summary>已选 0 / 0</span>
          </div>
          <section class="pgy-cart-batch-panel" data-batch-panel hidden>
            <div class="pgy-cart-batch-setup" data-batch-setup>
              <label>更新范围
                <select data-batch-scope>
                  <option value="stale">资料缺失或超过 7 天</option>
                  <option value="all">当前项目全部达人</option>
                  <option value="selected">购物车中已勾选达人</option>
                </select>
              </label>
              <button type="button" class="pgy-cart-primary-small" data-batch-start>开始更新</button>
              <span>单标签页串行更新，单批最多 50 位</span>
            </div>
            <div class="pgy-cart-batch-progress" data-batch-progress hidden>
              <strong data-batch-summary></strong>
              <progress data-batch-meter value="0" max="1"></progress>
              <span data-batch-counts></span>
              <div class="pgy-cart-batch-actions">
                <button type="button" data-batch-pause>暂停</button>
                <button type="button" data-batch-resume>继续</button>
                <button type="button" data-batch-cancel>取消</button>
              </div>
            </div>
          </section>
          <div class="pgy-cart-list" data-cart-list></div>
          <div class="pgy-cart-drawer-footer">
            <div class="pgy-cart-persist-note">✓ 数据已自动保存到浏览器本机</div>
            <div class="pgy-cart-backup-actions"><button type="button" data-backup>备份数据</button><button type="button" data-restore-backup>恢复备份</button><input type="file" accept="application/json,.json" data-backup-file aria-label="选择蒲公英达人购物车备份文件" hidden></div>
            <button type="button" class="pgy-cart-primary-button" data-export disabled>下载当前项目 Excel</button>
          </div>
        </aside>
      </div>
      <section class="pgy-cart-batch-floating" data-batch-floating hidden aria-live="polite">
        <div class="pgy-cart-batch-floating-info">
          <strong data-batch-floating-summary></strong>
          <span data-batch-floating-counts></span>
          <progress data-batch-floating-meter value="0" max="1"></progress>
        </div>
        <div class="pgy-cart-batch-actions">
          <button type="button" data-batch-pause>暂停</button>
          <button type="button" data-batch-resume>继续</button>
          <button type="button" data-batch-cancel>取消</button>
        </div>
      </section>
      <div class="pgy-cart-toast" role="status" aria-live="polite" data-visible="false"><span data-toast-message></span><button type="button" data-toast-action hidden>撤销</button></div>`;
    document.documentElement.appendChild(root);
    const autoStatus = document.createElement('div'); autoStatus.id = 'pgy-auto-detail-status'; autoStatus.hidden = true; autoStatus.setAttribute('role','status'); root.append(autoStatus);
    const pageBar = document.createElement('div'); pageBar.id = 'pgy-page-bar'; pageBar.hidden = true;
    pageBar.innerHTML = '<span data-page-info></span><button data-page-finish>本页筛选完成</button><button data-page-undo>撤销</button><label><input type="checkbox" data-page-hide> 隐藏已排除（保留占位）</label>';
    root.append(pageBar);
    pageBar.addEventListener('click', async event => {
      try {
        if (event.target.hasAttribute('data-page-finish')) await finishPage();
        if (event.target.hasAttribute('data-page-undo')) { await storage.undoScreening(state.snapshot.activeProjectId); await applySnapshot(await storage.getState()); }
      } catch (error) { showToast(error.message); }
    });
    pageBar.querySelector('[data-page-hide]').addEventListener('change', async event => {
      try { await storage.setHideExcluded(event.target.checked, state.snapshot.activeProjectId); await applySnapshot(await storage.getState()); } catch (error) { showToast(error.message); }
    });
    const reject = document.createElement('button'); reject.id = 'pgy-detail-exclude'; reject.className = 'pgy-cart-side-button'; reject.hidden = true; reject.textContent = '排除此人';
    root.querySelector('#pgy-cart-floating-button').before(reject);
    reject.addEventListener('click', async () => {
      try {
        const link = getRedIdLinks()[0]; if (!link) return;
        const creator = collectCreator(link), cart = currentCart(), id = state.snapshot.activeProjectId;
        const record = storage.findCreator(cart.excluded, creator);
        if (record) await storage.restoreCreators([record.redId], id);
        else await storage.excludeCreators([creator], id, '详情页排除');
        await applySnapshot(await storage.getState());
      } catch (error) { showToast(error.message); }
    });
    reviewUI = globalThis.PGYReviewUI({
      host: root,
      list: root.querySelector('[data-cart-list]'),
      storage,
      xlsx,
      getSnapshot: () => state.snapshot,
      refresh: async () => applySnapshot(await storage.getState()),
      getPageCreators: pageCreators,
      getPageStatus: pageStatus,
      getCartSelection: () => state.selectedRedIds,
      setCartSelection: (ids, checked) => {
        for (const id of ids) checked ? state.selectedRedIds.add(id) : state.selectedRedIds.delete(id);
        renderDrawer();
      },
      onCartRemoved: showRemovalUndo
    });
    positionFloatingActions();

    const backdrop = root.querySelector('[data-backdrop]');
    const drawer = root.querySelector('.pgy-cart-drawer');
    const closeButton = root.querySelector('[data-close]');
    const closeDrawer = () => {
      if (backdrop.dataset.open !== 'true') return;
      backdrop.dataset.open = 'false';
      const target = state.drawerReturnFocus;
      state.drawerReturnFocus = null;
      if (target && target.isConnected) target.focus();
    };
    root.querySelector('#pgy-cart-add-button').addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      addActiveCreator(event.currentTarget);
    });
    root.querySelector('#pgy-cart-floating-button').addEventListener('click', () => {
      state.drawerReturnFocus = document.activeElement;
      backdrop.dataset.open = 'true';
      renderDrawer();
      closeButton.focus();
    });
    closeButton.addEventListener('click', closeDrawer);
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) closeDrawer();
    });
    drawer.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...drawer.querySelectorAll('button, a[href], input:not([type="hidden"]), select, [tabindex]:not([tabindex="-1"])')]
        .filter(element => !element.disabled && !element.hidden && element.getClientRects().length);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    root.querySelector('[data-toast-action]').addEventListener('click', async event => {
      const action = state.toastAction;
      if (!action) return;
      event.currentTarget.disabled = true;
      state.toastAction = null;
      clearTimeout(state.toastTimer);
      try { await action(); } catch (error) { showToast(error.message || '撤销失败，请重试'); }
    });
    root.querySelector('[data-project-select]').addEventListener('change', async (event) => {
      await storage.setActiveProject(event.target.value);
      showToast(`已切换到“${event.target.selectedOptions[0].textContent.replace(/（\d+）$/, '')}”`);
    });
    root.querySelector('[data-create-project]').addEventListener('click', async () => {
      const name = window.prompt('请输入新项目名称（最多 30 个字）');
      if (name == null) return;
      try {
        await storage.createProject(name);
        showToast(`已创建项目“${name.trim().slice(0, 30)}”`);
      } catch (error) {
        showToast(error.message || '创建失败');
      }
    });
    root.querySelector('[data-delete-project]').addEventListener('click', async () => {
      const project = state.snapshot.projects[state.snapshot.activeProjectId];
      if (!window.confirm(`确定删除项目“${project.name}”及其中的全部达人和排除记录吗？`)) return;
      try {
        await storage.removeProject(project.id);
        showToast(`已删除项目“${project.name}”`);
      } catch (error) {
        showToast(error.message || '删除失败');
      }
    });
    root.querySelector('[data-refresh]').addEventListener('click', refreshVisibleCreators);
    root.querySelector('[data-batch-toggle]').addEventListener('click', () => {
      const panel = root.querySelector('[data-batch-panel]');
      panel.hidden = !panel.hidden;
      renderBatchPanel();
    });
    root.querySelector('[data-batch-start]').addEventListener('click', startBatchUpdate);
    for (const button of root.querySelectorAll('[data-batch-pause]')) button.addEventListener('click', () => setBatchStatus('paused'));
    for (const button of root.querySelectorAll('[data-batch-cancel]')) button.addEventListener('click', () => setBatchStatus('cancelled'));
    const resumeBatch = async () => {
      await setBatchStatus('running');
      const job = state.batchJob;
      if (!job || job.index >= job.queue.length) return;
      if (batchMarker() === job.id) {
        scheduleBatchRunner();
        return;
      }
      const updateTab = window.open(batchDetailUrl(job.queue[job.index], job), `pgy-cart-batch-${job.id}`);
      if (!updateTab) showToast('浏览器阻止了更新标签页，请允许弹出窗口');
      else state.batchWindow = updateTab;
    };
    for (const button of root.querySelectorAll('[data-batch-resume]')) button.addEventListener('click', resumeBatch);
    root.querySelector('[data-clear]').addEventListener('click', async () => {
      const project = state.snapshot.projects[state.snapshot.activeProjectId];
      if (!currentCart().order.length) return;
      if (!window.confirm(`确定清空“${project.name}”中的购物车达人吗？排除名单将保留。`)) return;
      await storage.clearCart(project.id);
      showToast(`已清空“${project.name}”`);
    });
    root.querySelector('[data-backup]').addEventListener('click', async () => {
      try { await downloadBackup(); showToast('备份已下载'); } catch (error) { showToast(error.message || '备份失败，请重试'); }
    });
    root.querySelector('[data-restore-backup]').addEventListener('click', () => root.querySelector('[data-backup-file]').click());
    root.querySelector('[data-backup-file]').addEventListener('change', async event => {
      const file = event.target.files && event.target.files[0];
      event.target.value = '';
      if (!file) return;
      try {
        const backup = JSON.parse(await file.text());
        if (!backup || backup.format !== 'pgy-creator-cart-backup' || !backup.state) throw new Error('备份文件格式不正确');
        if (!window.confirm('恢复备份将替换当前全部项目、购物车和排除记录。继续前会自动下载当前数据备份，是否恢复？')) return;
        await downloadBackup('恢复前自动备份');
        await storage.restoreBackup(backup);
        showToast('备份恢复完成');
      } catch (error) { showToast(error.message || '恢复失败，请检查备份文件'); }
    });
    root.querySelector('[data-export]').addEventListener('click', () => {
      const creators = storage.creatorsAsList(currentCart()).filter((creator) => state.selectedRedIds.has(creator.redId));
      if (!creators.length) return;
      const project = state.snapshot.projects[state.snapshot.activeProjectId];
      xlsx.download(creators, `蒲公英_${safeFilenamePart(project.name)}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast(`正在导出“${project.name}”的 ${creators.length} 位达人`);
    });
  }

  async function applySnapshot(snapshot) {
    state.snapshot = snapshot;
    markPage();
    state.activeRedIdLink = findActiveCreatorLink();
    updateAddButton();
    renderDrawer();
  }

  async function start() {
    createRoot();
    state.snapshot = await storage.getState();
    state.batchJob = await storage.getBatchJob();
    renderDrawer();
    scanPage();
    storage.subscribe(applySnapshot);
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local' || !changes[storage.BATCH_STORAGE_KEY]) return;
      state.batchJob = changes[storage.BATCH_STORAGE_KEY].newValue || null;
      renderBatchPanel();
    });
    const observer = new MutationObserver(records => {
      if (records.some(record => !record.target.closest?.('#pgy-cart-extension-root, .pgy-row-actions') && [...record.addedNodes, ...record.removedNodes].some(node => !(node.nodeType === 1 && (node.classList.contains('pgy-review-mark') || node.classList.contains('pgy-row-actions')))))) scheduleScan();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('popstate', scheduleScan);
    window.addEventListener('resize', scheduleSideActionPositions);
    window.addEventListener('scroll', scheduleViewportUpdate, { passive: true, capture: true });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleScan(); });
    setInterval(() => { if (!document.hidden) scheduleScan(); }, 10000);
    setInterval(() => { if (!document.hidden) autoUpdateDetail(); }, 2000);
    setInterval(monitorBatchRunner, 2000);
    if (batchMarker()) scheduleBatchRunner();
  }

  start().catch((error) => console.error('[蒲公英达人购物车] 初始化失败', error));
})();
