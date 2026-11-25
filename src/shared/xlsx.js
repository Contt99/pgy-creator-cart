(function initPgyXlsx(root) {
  'use strict';

  const encoder = new TextEncoder();
  let crcTable;

  function xmlEscape(value) {
    return String(value == null ? '' : value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function cellValue(value) {
    if (Array.isArray(value)) return value.join('；');
    if (value && typeof value === 'object') return JSON.stringify(value);
    return String(value == null ? '' : value);
  }

  function truncateCell(value) {
    const text = cellValue(value);
    return text.length > 32767 ? `${text.slice(0, 32740)}…（内容过长，已截断）` : text;
  }

  const FAN_AGE_COLUMNS = [
    ['fanAgeUnder18', '18岁以下占比', [/(?:18岁?(?:以下|以内)|未满18岁?|小于18岁?|[<＜≤]\s*18岁?|0\s*[-~～至到]\s*17岁?)/iu, /(?:under|below|lt)[_-]?18/i]],
    ['fanAge18To24', '18-24岁占比', [/18岁?\s*[-~～至到]\s*24岁?/iu, /18[_-]?24/i]],
    ['fanAge25To34', '25-34岁占比', [/25岁?\s*[-~～至到]\s*34岁?/iu, /25[_-]?34/i]],
    ['fanAge35To44', '35-44岁占比', [/35岁?\s*[-~～至到]\s*44岁?/iu, /35[_-]?44/i]],
    ['fanAge45Plus', '45岁以上占比', [/(?:45岁?(?:以上|及以上)|大于44岁?|[>＞≥]\s*44岁?|45\s*\+)/iu, /(?:over|above|gt|gte)[_-]?44|45[_-]?(?:plus|up)/i]]
  ];

  function parseFanAgeSegments(valueInput) {
    const value = cellValue(valueInput).replace(/％/g, '%').replace(/[—–−]/g, '-');
    const result = {};
    for (const [key, , patterns] of FAN_AGE_COLUMNS) {
      for (const pattern of patterns) {
        const source = pattern.source;
        const after = value.match(new RegExp(`(?:${source})[^%\\d]{0,40}(\\d+(?:\\.\\d+)?)\\s*%`, 'iu'));
        const before = value.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*%[^%\\d]{0,40}(?:${source})`, 'iu'));
        const match = after || before;
        if (match) {
          result[key] = `${match[1]}%`;
          break;
        }
      }
    }
    return result;
  }

  function cleanFanRegionDistribution(valueInput) {
    return cellValue(valueInput)
      .replace(/按省份|按城市/gu, '')
      .replace(/(?:\s*[；;]\s*){2,}/gu, '；')
      .replace(/^[\s；;、，,|/：:]+|[\s；;、，,|/：:]+$/gu, '')
      .trim();
  }

  function columnName(index) {
    let current = index + 1;
    let result = '';
    while (current > 0) {
      const remainder = (current - 1) % 26;
      result = String.fromCharCode(65 + remainder) + result;
      current = Math.floor((current - 1) / 26);
    }
    return result;
  }

  function cellXml(value, rowIndex, columnIndex, styleIndex) {
    const ref = `${columnName(columnIndex)}${rowIndex}`;
    const style = styleIndex ? ` s="${styleIndex}"` : '';
    return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEscape(truncateCell(value))}</t></is></c>`;
  }

  function worksheetXml(rows, options) {
    const safeRows = rows.length ? rows : [['']];
    const maxColumns = Math.max(...safeRows.map((row) => row.length), 1);
    const endRef = `${columnName(maxColumns - 1)}${safeRows.length}`;
    const widths = options && Array.isArray(options.widths) ? options.widths : [];
    const columnsXml = widths.length
      ? `<cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${Math.max(8, Math.min(60, width))}" customWidth="1"/>`).join('')}</cols>`
      : '';
    const rowsXml = safeRows.map((row, rowOffset) => {
      const rowIndex = rowOffset + 1;
      const cells = row.map((value, columnIndex) => cellXml(value, rowIndex, columnIndex, rowIndex === 1 ? 1 : 0)).join('');
      return `<row r="${rowIndex}">${cells}</row>`;
    }).join('');
    const autoFilter = safeRows.length > 1 && maxColumns > 1 ? `<autoFilter ref="A1:${endRef}"/>` : '';

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${endRef}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  ${columnsXml}
  <sheetData>${rowsXml}</sheetData>
  ${autoFilter}
</worksheet>`;
  }

  function buildRows(creators) {
    const baseColumns = [
      ['name', '达人名'],
      ['redId', '小红书号'],
      ['institution', '所属机构'],
      ['followersCount', '粉丝量'],
      ['likeCollectCount', '赞藏量'],
      ['contentCategories', '达人内容类别'],
      ['creatorTags', '达人标签'],
      ['homepageUrl', '主页链接'],
      ['pgyUrl', '蒲公英链接'],
      ['medianImpressions', '曝光中位数'],
      ['medianReads', '阅读中位数'],
      ['medianInteractions', '互动中位数'],
      ['imagePrice', '图文笔记一口价'],
      ['videoPrice', '视频笔记一口价'],
      ['fanGenderDistribution', '粉丝性别占比'],
      ['fanRegionDistribution', '粉丝地域分布'],
      ...FAN_AGE_COLUMNS.map(([key, label]) => [key, label]),
      ['creatorLocation', '达人所在地'],
      ['firstAddedAt', '首次加入时间'],
      ['lastUpdatedAt', '最后更新时间']
    ];
    const detailOnlyColumns = [
      ['fanAgeDistribution', '粉丝年龄分布（原始）'],
      ['avatarUrl', '头像地址'],
      ['sourceUrl', '来源页面'],
      ['sourceTitle', '来源标题'],
      ['rawVisibleText', '页面可见文本']
    ];
    const detailColumns = baseColumns.concat(detailOnlyColumns);
    const baseLabels = new Set(detailColumns.map(([, label]) => label));
    const baseValue = (creator, key, label) => {
      if (key === 'fanRegionDistribution') {
        const fields = creator.capturedFields || {};
        return cleanFanRegionDistribution(creator[key] || fields[label] || '');
      }
      if (creator[key] != null && creator[key] !== '') return creator[key];
      if (key === 'homepageUrl' && creator.profileUrl && !/pgy\.xiaohongshu\.com/i.test(creator.profileUrl)) return creator.profileUrl;
      if (key === 'pgyUrl') {
        if (creator.profileUrl && /pgy\.xiaohongshu\.com/i.test(creator.profileUrl)) return creator.profileUrl;
        if (creator.sourceUrl && /pgy\.xiaohongshu\.com/i.test(creator.sourceUrl)) return creator.sourceUrl;
      }
      const fields = creator.capturedFields || {};
      if (FAN_AGE_COLUMNS.some(([ageKey]) => ageKey === key)) {
        const rawAge = creator.fanAgeDistribution || fields['粉丝年龄分布'] || '';
        return parseFanAgeSegments(rawAge)[key] || fields[label] || '';
      }
      if (key === 'fanGenderDistribution') return fields[label] || fields['粉丝性别分布'] || '';
      return fields[label] || '';
    };
    const mainRows = [baseColumns.map(([, label]) => label)];
    for (const creator of creators) {
      mainRows.push(baseColumns.map(([key, label]) => baseValue(creator, key, label)));
    }

    const detailRows = [['小红书号', '达人昵称', '字段名', '字段值']];
    for (const creator of creators) {
      for (const [key, label] of detailColumns) {
        detailRows.push([creator.redId || '', creator.name || '', label, baseValue(creator, key, label)]);
      }
      const fields = creator.capturedFields || {};
      for (const key of Object.keys(fields).sort((a, b) => a.localeCompare(b, 'zh-CN'))) {
        if (baseLabels.has(key)) continue;
        detailRows.push([creator.redId || '', creator.name || '', key, fields[key]]);
      }
    }

    const now = new Date().toISOString();
    const infoRows = [
      ['项目', '内容'],
      ['导出时间', now],
      ['项目', creators[0] && creators[0].projectName ? creators[0].projectName : '当前项目'],
      ['达人数量', String(creators.length)],
      ['唯一键', '当前项目内按小红书号（redId）精确匹配'],
      ['数据范围', '达人加入或更新购物车时，当前蒲公英列表页/详情页中可读取的核心指标与动态字段'],
      ['缺失值说明', '页面未提供或图表无可读取文本时留空；进入达人详情页后点击“更新页面数据”可补充'],
      ['数据存储', '浏览器扩展本地存储；关闭或重启浏览器不会清空'],
      ['插件版本', '0.2.15']
    ];

    return { mainRows, detailRows, infoRows };
  }

  function uint16(value) {
    return [value & 0xff, (value >>> 8) & 0xff];
  }

  function uint32(value) {
    return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
  }

  function concatBytes(parts) {
    const length = parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) {
      output.set(part, offset);
      offset += part.length;
    }
    return output;
  }

  function getCrcTable() {
    if (crcTable) return crcTable;
    crcTable = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let current = index;
      for (let bit = 0; bit < 8; bit += 1) {
        current = (current & 1) ? (0xedb88320 ^ (current >>> 1)) : (current >>> 1);
      }
      crcTable[index] = current >>> 0;
    }
    return crcTable;
  }

  function crc32(bytes) {
    const table = getCrcTable();
    let value = 0xffffffff;
    for (const byte of bytes) value = table[(value ^ byte) & 0xff] ^ (value >>> 8);
    return (value ^ 0xffffffff) >>> 0;
  }

  function dosDateTime(date) {
    const year = Math.max(1980, date.getFullYear());
    const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
    const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
    return { time, day };
  }

  function zipStore(files) {
    const localParts = [];
    const centralParts = [];
    const now = dosDateTime(new Date());
    let offset = 0;

    for (const file of files) {
      const nameBytes = encoder.encode(file.name);
      const dataBytes = typeof file.data === 'string' ? encoder.encode(file.data) : file.data;
      const checksum = crc32(dataBytes);
      const localHeader = new Uint8Array([
        ...uint32(0x04034b50),
        ...uint16(20),
        ...uint16(0x0800),
        ...uint16(0),
        ...uint16(now.time),
        ...uint16(now.day),
        ...uint32(checksum),
        ...uint32(dataBytes.length),
        ...uint32(dataBytes.length),
        ...uint16(nameBytes.length),
        ...uint16(0)
      ]);
      const localFile = concatBytes([localHeader, nameBytes, dataBytes]);
      localParts.push(localFile);

      const centralHeader = new Uint8Array([
        ...uint32(0x02014b50),
        ...uint16(20),
        ...uint16(20),
        ...uint16(0x0800),
        ...uint16(0),
        ...uint16(now.time),
        ...uint16(now.day),
        ...uint32(checksum),
        ...uint32(dataBytes.length),
        ...uint32(dataBytes.length),
        ...uint16(nameBytes.length),
        ...uint16(0),
        ...uint16(0),
        ...uint16(0),
        ...uint16(0),
        ...uint32(0),
        ...uint32(offset)
      ]);
      centralParts.push(concatBytes([centralHeader, nameBytes]));
      offset += localFile.length;
    }

    const localData = concatBytes(localParts);
    const centralData = concatBytes(centralParts);
    const end = new Uint8Array([
      ...uint32(0x06054b50),
      ...uint16(0),
      ...uint16(0),
      ...uint16(files.length),
      ...uint16(files.length),
      ...uint32(centralData.length),
      ...uint32(localData.length),
      ...uint16(0)
    ]);
    return concatBytes([localData, centralData, end]);
  }

  function build(creatorsInput, options = {}) {
    const creators = Array.isArray(creatorsInput) ? creatorsInput.map(c => ({...c, redId: /^pgy:[a-f0-9]{24}$/i.test(c.redId || '') ? '' : c.redId})) : [];
    const { mainRows, detailRows, infoRows } = options.excluded ? {
      mainRows: [['昵称', '小红书号', '所属项目', '排除时间', '排除来源', '蒲公英链接'], ...creators.map(c => [c.name, c.redId, c.projectName, c.excludedAt, c.exclusionSource, c.pgyUrl])],
      detailRows: [['说明'], ['仅包含当前项目的排除名单']],
      infoRows: [['导出时间', new Date().toISOString()], ['达人数量', creators.length], ['时间格式', 'UTC ISO 8601'], ['数据范围', '当前项目全部排除记录，不受搜索条件影响']]
    } : buildRows(creators);
    const sheetNames = [options.excluded ? '排除名单' : '达人主表', '字段明细', '导出说明'];
    const files = [
      {
        name: '[Content_Types].xml',
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`
      },
      {
        name: '_rels/.rels',
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`
      },
      {
        name: 'docProps/core.xml',
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>蒲公英达人购物车</dc:title><dc:creator>蒲公英达人购物车插件</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
</cp:coreProperties>`
      },
      {
        name: 'docProps/app.xml',
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>蒲公英达人购物车</Application><TitlesOfParts><vt:vector size="3" baseType="lpstr">${sheetNames.map((name) => `<vt:lpstr>${name}</vt:lpstr>`).join('')}</vt:vector></TitlesOfParts>
</Properties>`
      },
      {
        name: 'xl/workbook.xml',
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheetNames.map((name, index) => `<sheet name="${name}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets>
</workbook>`
      },
      {
        name: 'xl/_rels/workbook.xml.rels',
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
      },
      {
        name: 'xl/styles.xml',
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFF2442"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`
      },
      { name: 'xl/worksheets/sheet1.xml', data: worksheetXml(mainRows, { widths: [18, 20, 22, 14, 14, 22, 28, 36, 36, 14, 14, 14, 18, 18, 32, 36, 16, 16, 16, 16, 16, 18, 22, 22] }) },
      { name: 'xl/worksheets/sheet2.xml', data: worksheetXml(detailRows, { widths: [20, 18, 28, 60] }) },
      { name: 'xl/worksheets/sheet3.xml', data: worksheetXml(infoRows, { widths: [22, 68] }) }
    ];
    return zipStore(files);
  }

  function download(creators, filename, options) {
    const bytes = build(creators, options);
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const objectUrl = URL.createObjectURL(blob);
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename || `蒲公英达人购物车_${date}_${time}.xlsx`;
    anchor.style.display = 'none';
    document.documentElement.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
  }

  const api = { build, download, buildRows, parseFanAgeSegments, cleanFanRegionDistribution };
  root.PGYXlsx = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
