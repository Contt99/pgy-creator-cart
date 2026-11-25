'use strict';

const fs = require('node:fs');
const path = require('node:path');
const xlsx = require('../src/shared/xlsx.js');

const outputPath = process.argv[2];
if (!outputPath) throw new Error('missing output path');

const creators = [
  {
    projectName: '秋季新品种草',
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
    fanRegionDistribution: '按省份；按城市；广东 20%；上海 15%；浙江 12%',
    creatorLocation: '辽宁 大连',
    institution: '示例机构乙',
    medianImpressions: '8.6万',
    medianReads: '4.2万',
    medianInteractions: '6,520',
    imagePrice: '¥8,000',
    videoPrice: '¥15,000',
    profileUrl: 'https://pgy.xiaohongshu.com/solar/example',
    avatarUrl: 'https://example.invalid/avatar.jpg',
    sourceUrl: 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail',
    sourceTitle: '蒲公英 - 达人详情',
    firstAddedAt: '2026-08-25T10:00:00.000Z',
    lastUpdatedAt: '2026-08-25T10:05:00.000Z',
    rawVisibleText: '测试达人青禾\n小红书号：TestFixture01\n辽宁 大连\n机构：示例机构乙',
    capturedFields: {
      地区: ['辽宁 大连'],
      机构: ['示例机构乙'],
      粉丝数: ['12.3万'],
      图文报价: ['¥8,000']
    }
  },
  {
    projectName: '秋季新品种草',
    redId: 'TestFixture02',
    name: '测试达人小橘',
    homepageUrl: 'https://www.xiaohongshu.com/user/profile/example2',
    pgyUrl: 'https://pgy.xiaohongshu.com/solar/example2',
    followersCount: '42.1万',
    likeCollectCount: '8,659',
    contentCategories: '时尚；穿搭',
    creatorTags: '通勤穿搭；小个子',
    fanGenderDistribution: '女性 91%；男性 9%',
    fanAgeDistribution: '18岁以下 5%；18-24岁 45%；25-34岁 31%；35-44岁 12%；45岁以上 7%',
    fanRegionDistribution: '按省份；按城市；浙江 22%；上海 18%；江苏 12%',
    creatorLocation: '浙江 杭州',
    institution: '示例机构丙',
    medianImpressions: '12.4万',
    medianReads: '7.8万',
    medianInteractions: '8,659',
    imagePrice: '¥12,000',
    videoPrice: '¥20,000',
    sourceUrl: 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail',
    sourceTitle: '蒲公英 - 达人详情',
    firstAddedAt: '2026-08-25T10:10:00.000Z',
    lastUpdatedAt: '2026-08-25T10:10:00.000Z',
    rawVisibleText: '测试达人小橘\n小红书号：TestFixture02\n浙江 杭州',
    capturedFields: {
      地区: ['浙江 杭州'],
      粉丝数: ['42.1万'],
      图文报价: ['¥12,000']
    }
  }
];

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, Buffer.from(xlsx.build(creators)));
console.log(outputPath);
