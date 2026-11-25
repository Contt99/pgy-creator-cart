'use strict';

const assert = require('node:assert/strict');
const xlsx = require('../src/shared/xlsx.js');

function readStoredZip(bytes) {
  const buffer = Buffer.from(bytes);
  const files = new Map();
  let offset = 0;
  while (offset + 4 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = buffer.subarray(nameStart, nameStart + nameLength).toString('utf8');
    files.set(name, buffer.subarray(dataStart, dataStart + compressedSize));
    offset = dataStart + compressedSize;
  }
  return files;
}

const creators = [
  {
    projectName: '新品种草',
    redId: 'TestFixture01',
    name: '测试达人青禾',
    homepageUrl: 'https://www.xiaohongshu.com/user/profile/example',
    pgyUrl: 'https://pgy.xiaohongshu.com/solar/example',
    followersCount: '12.3万',
    likeCollectCount: '1.8万',
    contentCategories: '美妆；护肤',
    creatorTags: '成分党；干皮护肤',
    fanGenderDistribution: '女性 82%；男性 18%',
    fanAgeDistribution: '18岁以下 8%；18-24岁 36%；25-34岁 32%；35-44岁 16%；45岁以上 8%',
    fanRegionDistribution: '按省份；按城市；广东 20%；上海 15%',
    creatorLocation: '辽宁 大连',
    institution: '示例机构乙',
    medianImpressions: '8.6万',
    medianReads: '4.2万',
    medianInteractions: '6,520',
    imagePrice: '¥8,000',
    videoPrice: '¥15,000',
    sourceUrl: 'https://pgy.xiaohongshu.com/solar',
    rawVisibleText: '小红书号：TestFixture01\n辽宁 大连',
    capturedFields: { 地区: ['辽宁 大连'], 粉丝数: ['12.3万'] }
  }
];

const expectedMainHeaders = [
  '达人名',
  '小红书号',
  '所属机构',
  '粉丝量',
  '赞藏量',
  '达人内容类别',
  '达人标签',
  '主页链接',
  '蒲公英链接',
  '曝光中位数',
  '阅读中位数',
  '互动中位数',
  '图文笔记一口价',
  '视频笔记一口价',
  '粉丝性别占比',
  '粉丝地域分布',
  '18岁以下占比',
  '18-24岁占比',
  '25-34岁占比',
  '35-44岁占比',
  '45岁以上占比',
  '达人所在地',
  '首次加入时间',
  '最后更新时间'
];

const rows = xlsx.buildRows(creators);
assert.deepEqual(rows.mainRows[0], expectedMainHeaders);
assert.ok(!rows.mainRows[0].includes('项目'));
assert.equal(rows.mainRows[1][15], '广东 20%；上海 15%');
assert.equal(xlsx.cleanFanRegionDistribution('按省份；按城市；广东 20%；上海 15%'), '广东 20%；上海 15%');
assert.equal(xlsx.cleanFanRegionDistribution('广东 20%；按省份；按城市'), '广东 20%');

const bytes = xlsx.build(creators);

assert.equal(Buffer.from(bytes).readUInt32LE(0), 0x04034b50);
const files = readStoredZip(bytes);
for (const filename of [
  '[Content_Types].xml',
  '_rels/.rels',
  'xl/workbook.xml',
  'xl/styles.xml',
  'xl/worksheets/sheet1.xml',
  'xl/worksheets/sheet2.xml',
  'xl/worksheets/sheet3.xml'
]) {
  assert.ok(files.has(filename), `missing ${filename}`);
}
const workbook = files.get('xl/workbook.xml').toString('utf8');
const mainSheet = files.get('xl/worksheets/sheet1.xml').toString('utf8');
assert.match(workbook, /达人主表/);
assert.match(mainSheet, /TestFixture01/);
assert.doesNotMatch(mainSheet, />项目</);
assert.match(mainSheet, /赞藏量/);
assert.match(mainSheet, /1\.8万/);
assert.match(mainSheet, /所属机构/);
assert.match(mainSheet, /示例机构乙/);
assert.doesNotMatch(mainSheet, /按省份|按城市/);
assert.match(mainSheet, /https:\/\/www\.xiaohongshu\.com\/user\/profile\/example/);
assert.match(mainSheet, /https:\/\/pgy\.xiaohongshu\.com\/solar\/example/);
for (const header of expectedMainHeaders) {
  assert.match(mainSheet, new RegExp(header));
}
for (const percentage of ['8%', '36%', '32%', '16%']) assert.match(mainSheet, new RegExp(percentage));
assert.deepEqual(xlsx.parseFanAgeSegments('18岁以下 8%；18-24岁 36%；25-34岁 32%；35-44岁 16%；45岁以上 8%'), {
  fanAgeUnder18: '8%',
  fanAge18To24: '36%',
  fanAge25To34: '32%',
  fanAge35To44: '16%',
  fanAge45Plus: '8%'
});
const excludedFiles = readStoredZip(xlsx.build([{name:'待复查',redId:'00123',projectName:'项目甲',excludedAt:'2026-09-10T00:00:00Z',exclusionSource:'本页筛选'}], {excluded:true}));
assert.match(excludedFiles.get('xl/workbook.xml').toString(), /排除名单/);
const excludedSheet = excludedFiles.get('xl/worksheets/sheet1.xml').toString();
for (const value of ['昵称','小红书号','所属项目','排除时间','排除来源','00123','本页筛选']) assert.ok(excludedSheet.includes(value));
console.log('xlsx tests passed');
