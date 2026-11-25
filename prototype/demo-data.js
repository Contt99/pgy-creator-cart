(() => {
  'use strict';
  // Synthetic profiles. No real account identifiers, URLs, or likenesses.
  const entries = [
    ['林间配方', '美妆护肤', '杭州', '成分测评 / 通勤妆容', 486000, 3200, 7200, 12000, 78, '杭州市 18% / 上海市 14% / 深圳市 9%', '用通勤场景拆解护肤和底妆，擅长同价位产品横测。'],
    ['鹿野来信', '生活方式', '成都', '独居日常 / 居家灵感', 352000, 2680, 5500, 8600, 72, '成都市 17% / 杭州市 11% / 重庆市 9%', '以居家日常和周末散步为内容主线，适合自然植入生活好物。'],
    ['逆风走走', '旅行户外', '广州', '轻量徒步 / 城市周边', 279000, 2240, 4800, 7600, 54, '广州市 21% / 深圳市 15% / 成都市 8%', '分享两小时内可达的徒步路线，并记录真实的装备使用体验。'],
    ['沈屿咖啡', '美食饮品', '上海', '手冲咖啡 / 小店探访', 163000, 1890, 3600, 6200, 61, '上海市 24% / 杭州市 13% / 南京市 10%', '聚焦家用咖啡设备和独立咖啡馆，采用对比演示讲清器具差异。'],
    ['余温研究所', '美妆护肤', '深圳', '敏感肌 / 空瓶回购', 92500, 1340, 2900, 4900, 83, '深圳市 19% / 广州市 16% / 上海市 10%', '记录敏感肌护肤过程，以连续使用体验和定期复盘为主。'],
    ['一勺慢煮', '美食饮品', '南京', '一人食 / 应季食材', 74200, 1120, 2300, 3800, 69, '南京市 18% / 上海市 12% / 苏州市 10%', '制作工作日晚餐和应季食谱，擅长用步骤图讲清准备和烹饪。']
  ];
  const creators = entries.map(([name, category, city, tags, followers, interactions, image, video, female, fanRegionDistribution, bio], index) => ({
    name, category, redId: `demo-${101 + index}`, city, tags, bio, image, video, female, followers, interactions,
    creatorLocation: city, contentCategories: category, creatorTags: tags,
    followersCount: followers, medianInteractions: interactions, medianReads: interactions * 9,
    medianImpressions: interactions * 15, likeCollectCount: interactions * 278,
    imagePrice: image, videoPrice: video, fanGenderDistribution: `女 ${female}% / 男 ${100 - female}%`,
    fanAgeDistribution: '18岁以下 5% / 18-24岁 38% / 25-34岁 41% / 35-44岁 12% / 45岁以上 4%',
    fanRegionDistribution, sourceTitle: '达人购物车作品演示（合成数据）',
    art: index + 1
  }));
  const campaign = '春日生活方式企划';
  const secondary = '新品合作备选';

  function initialBackup() {
    const now = new Date().toISOString();
    const primary = 'default', extra = 'demo-secondary';
    const seeded = { ...creators[1], projectId: primary, projectName: campaign, firstAddedAt: now, lastUpdatedAt: now };
    const project = (id, name) => ({ id, name, createdAt: now, updatedAt: now });
    return {
      format: 'pgy-creator-cart-backup', version: 1, exportedAt: now, batchJob: null,
      state: {
        version: 2, activeProjectId: primary, projectOrder: [primary, extra],
        projects: { [primary]: project(primary, campaign), [extra]: project(extra, secondary) },
        carts: {
          [primary]: { creators: { [seeded.redId]: seeded }, order: [seeded.redId] },
          [extra]: { creators: {}, order: [] }
        }
      }
    };
  }
  window.CreatorCartDemo = { creators, initialBackup };
})();
