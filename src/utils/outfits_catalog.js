/**
 * Wiki Wiki 服裝與飾品共用型錄 (outfits_catalog.js)
 * 統一管理主視窗、衣櫥視窗與 MCP AI 工具之服裝清單、部位槽位、
 * 相對百分比縮放座標 (coordVersion: 2)、旋轉角度與日系繪本 PNG 對應。
 */

const COORD_VERSION = 2;

// 各動作幀相對站姿的部位偏移量（百分比座標與旋轉角度增量）
const POSE_SLOT_OFFSETS = {
  eating1: {
    head: { dx: 16, dy: 19, dRotate: 20 },
    face: { dx: 12, dy: 21, dRotate: 18 },
    body: { dx: -1, dy: 13, dRotate: 12 }
  },
  eating2: {
    head: { dx: 1, dy: 1, dRotate: 3 },
    face: { dx: 2, dy: 2, dRotate: 3 },
    body: { dx: -2, dy: 1, dRotate: 2 }
  },
  jump: {
    head: { dx: -3, dy: -2, dRotate: -10 },
    face: { dx: -1, dy: -4, dRotate: -12 },
    body: { dx: 0, dy: -2, dRotate: -4 }
  },
  tired: {
    head: { dx: 1, dy: 2, dRotate: 4 },
    face: { dx: 1, dy: 3, dRotate: 3 },
    body: { dx: 0, dy: 1, dRotate: 0 }
  }
};

// 特定飾品於大動作幀的個別微調（例如較大型耳機於低頭吃飯時再更貼合頭頂）
const POSE_ITEM_OFFSETS = {
  eating1: {
    '🎧': { dx: 13, dy: 27, dRotate: 18 }
  }
};

function getPoseSlotOffset(spriteKey, slot, outfitId = '') {
  if (outfitId && POSE_ITEM_OFFSETS[spriteKey] && POSE_ITEM_OFFSETS[spriteKey][outfitId]) {
    return { ...POSE_ITEM_OFFSETS[spriteKey][outfitId] };
  }
  const poseMap = POSE_SLOT_OFFSETS[spriteKey];
  if (!poseMap || !poseMap[slot]) {
    return { dx: 0, dy: 0, dRotate: 0 };
  }
  return { ...poseMap[slot] };
}

const OUTFIT_SLOTS = {
  head: { id: 'head', label: '頭飾' },
  face: { id: 'face', label: '臉飾' },
  body: { id: 'body', label: '配飾' }
};

const OUTFIT_ITEMS = [
  // === 8 件精選日系繪本透明 PNG 飾品（已依實際桌面微調結果設為預設） ===
  {
    id: '🎩',
    name: '紳士小禮帽',
    slot: 'head',
    asset: 'top_hat.png',
    featured: true,
    defaultConfig: { x: 52, y: 9, scale: 35, rotate: -5, coordVersion: COORD_VERSION }
  },
  {
    id: '👑',
    name: '小金王冠',
    slot: 'head',
    asset: 'crown.png',
    featured: true,
    defaultConfig: { x: 50, y: 10, scale: 27, rotate: -3, coordVersion: COORD_VERSION }
  },
  {
    id: '🌸',
    name: '櫻花髮夾',
    slot: 'head',
    asset: 'sakura.png',
    featured: true,
    defaultConfig: { x: 42, y: 21, scale: 20, rotate: -10, coordVersion: COORD_VERSION }
  },
  {
    id: '🧢',
    name: '休閒鴨舌帽',
    slot: 'head',
    asset: 'cap.png',
    featured: true,
    defaultConfig: { x: 60, y: 17, scale: 40, rotate: -3, coordVersion: COORD_VERSION }
  },
  {
    id: '🎧',
    name: '復古耳機',
    slot: 'head',
    asset: 'headphones.png',
    featured: true,
    defaultConfig: { x: 54, y: 1, scale: 50, rotate: -8, coordVersion: COORD_VERSION }
  },
  {
    id: '🕶️',
    name: '酷炫墨鏡',
    slot: 'face',
    asset: 'sunglasses.png',
    featured: true,
    defaultConfig: { x: 63, y: 31, scale: 31, rotate: 4, coordVersion: COORD_VERSION }
  },
  {
    id: '👓',
    name: '圓框眼鏡',
    slot: 'face',
    asset: 'glasses.png',
    featured: true,
    defaultConfig: { x: 61, y: 33, scale: 33, rotate: 6, coordVersion: COORD_VERSION }
  },
  {
    id: '🎀',
    name: '暖紅蝴蝶結',
    slot: 'body',
    asset: 'ribbon.png',
    featured: true,
    defaultConfig: { x: 62, y: 58, scale: 25, rotate: 2, coordVersion: COORD_VERSION }
  },

  // === 經典 Emoji 保留款（向下相容舊存檔與 MCP 指令） ===
  {
    id: '🎓',
    name: '學士帽',
    slot: 'head',
    asset: null,
    featured: false,
    defaultConfig: { x: 48, y: 16, scale: 32, rotate: -4, coordVersion: COORD_VERSION }
  },
  {
    id: '👒',
    name: '草帽',
    slot: 'head',
    asset: null,
    featured: false,
    defaultConfig: { x: 48, y: 16, scale: 34, rotate: -4, coordVersion: COORD_VERSION }
  },
  {
    id: '🎃',
    name: '南瓜帽',
    slot: 'head',
    asset: null,
    featured: false,
    defaultConfig: { x: 48, y: 17, scale: 28, rotate: 0, coordVersion: COORD_VERSION }
  },
  {
    id: '🎉',
    name: '派對帽',
    slot: 'head',
    asset: null,
    featured: false,
    defaultConfig: { x: 49, y: 15, scale: 30, rotate: 6, coordVersion: COORD_VERSION }
  },
  {
    id: '🥽',
    name: '護目鏡',
    slot: 'face',
    asset: null,
    featured: false,
    defaultConfig: { x: 55, y: 36, scale: 30, rotate: 0, coordVersion: COORD_VERSION }
  },
  {
    id: '🎒',
    name: '小背包',
    slot: 'body',
    asset: null,
    featured: false,
    defaultConfig: { x: 34, y: 58, scale: 28, rotate: -8, coordVersion: COORD_VERSION }
  }
];

const ITEM_MAP = new Map(OUTFIT_ITEMS.map(item => [item.id, item]));

function getOutfitItem(id) {
  return ITEM_MAP.get(id) || null;
}

function getFeaturedOutfits() {
  return OUTFIT_ITEMS.filter(item => item.featured);
}

function getLegacyOutfits() {
  return OUTFIT_ITEMS.filter(item => !item.featured);
}

function getAllOutfitIds() {
  return OUTFIT_ITEMS.map(item => item.id);
}

function getDefaultOutfitConfig(id) {
  const item = getOutfitItem(id);
  if (item && item.defaultConfig) {
    return { ...item.defaultConfig, coordVersion: COORD_VERSION };
  }
  return { x: 50, y: 30, scale: 30, rotate: 0, coordVersion: COORD_VERSION };
}

function resolveOutfitConfig(id, savedConfigs) {
  const def = getDefaultOutfitConfig(id);
  const saved = savedConfigs && savedConfigs[id];
  if (!saved || saved.coordVersion !== COORD_VERSION) {
    return def;
  }
  return {
    x: typeof saved.x === 'number' ? saved.x : def.x,
    y: typeof saved.y === 'number' ? saved.y : def.y,
    scale: typeof saved.scale === 'number' ? saved.scale : def.scale,
    rotate: typeof saved.rotate === 'number' ? saved.rotate : def.rotate,
    coordVersion: COORD_VERSION
  };
}

function getOutfitSlot(id) {
  const item = getOutfitItem(id);
  return item ? item.slot : 'body';
}

function getOutfitAssetUrl(id, baseDir = '../../../assets/images/outfits/') {
  const item = getOutfitItem(id);
  if (!item || !item.asset) return null;
  return `${baseDir}${item.asset}`;
}

/**
 * 依部位規則計算穿戴後的新飾品清單
 * @param {string[]} currentOutfits 目前穿戴清單
 * @param {string} targetOutfit 點擊目標飾品 ID（空字串代表全部脫下）
 * @param {Object} options { freeStack: boolean }
 * @returns {string[]}
 */
function applyOutfitSelection(currentOutfits, targetOutfit, { freeStack = false } = {}) {
  const list = Array.isArray(currentOutfits) ? [...currentOutfits] : [];
  if (!targetOutfit) return [];
  if (list.includes(targetOutfit)) return list;

  if (freeStack) {
    return [...list, targetOutfit];
  }

  const targetSlot = getOutfitSlot(targetOutfit);
  const filtered = list.filter(existingId => getOutfitSlot(existingId) !== targetSlot);
  return [...filtered, targetOutfit];
}

module.exports = {
  COORD_VERSION,
  POSE_SLOT_OFFSETS,
  OUTFIT_SLOTS,
  OUTFIT_ITEMS,
  getOutfitItem,
  getFeaturedOutfits,
  getLegacyOutfits,
  getAllOutfitIds,
  getDefaultOutfitConfig,
  resolveOutfitConfig,
  getOutfitSlot,
  getPoseSlotOffset,
  getOutfitAssetUrl,
  applyOutfitSelection
};
