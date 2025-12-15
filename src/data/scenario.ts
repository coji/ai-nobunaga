// 初期シナリオデータ（桶狭間前夜をモチーフにした小規模シナリオ）

import type {
  Busho,
  Castle,
  Clan,
  DiplomacyRelation,
  Faction,
  GameState,
} from "../types.js";

// === 武将データ ===
const bushoList: Busho[] = [
  // 織田家
  {
    id: "oda_nobunaga",
    name: "織田信長",
    politics: 85,
    warfare: 88,
    intelligence: 92,
    charisma: 95,
    personality: ["革新的", "野心家", "残虐"],
    emotions: { loyalty: 100, fear: 0, respect: 80, discontent: 0 },
    clanId: "oda",
    factionId: null,
  },
  {
    id: "shibata_katsuie",
    name: "柴田勝家",
    politics: 55,
    warfare: 85,
    intelligence: 60,
    charisma: 70,
    personality: ["義理重視", "保守的"],
    emotions: { loyalty: 75, fear: 10, respect: 60, discontent: 20 },
    clanId: "oda",
    factionId: "oda_fudai",
  },
  {
    id: "kinoshita_tokichiro",
    name: "木下藤吉郎",
    politics: 90,
    warfare: 65,
    intelligence: 88,
    charisma: 85,
    personality: ["実利優先", "野心家"],
    emotions: { loyalty: 90, fear: 5, respect: 70, discontent: 5 },
    clanId: "oda",
    factionId: "oda_shinzan",
  },
  // 今川家
  {
    id: "imagawa_yoshimoto",
    name: "今川義元",
    politics: 80,
    warfare: 70,
    intelligence: 75,
    charisma: 85,
    personality: ["権威主義", "保守的"],
    emotions: { loyalty: 100, fear: 0, respect: 90, discontent: 0 },
    clanId: "imagawa",
    factionId: null,
  },
  {
    id: "matsudaira_motoyasu",
    name: "松平元康",
    politics: 85,
    warfare: 80,
    intelligence: 90,
    charisma: 88,
    personality: ["猜疑心", "実利優先", "義理重視"],
    emotions: { loyalty: 60, fear: 30, respect: 50, discontent: 40 },
    clanId: "imagawa",
    factionId: null,
  },
  // 斎藤家
  {
    id: "saito_yoshitatsu",
    name: "斎藤義龍",
    politics: 70,
    warfare: 75,
    intelligence: 72,
    charisma: 60,
    personality: ["猜疑心", "野心家"],
    emotions: { loyalty: 100, fear: 0, respect: 60, discontent: 0 },
    clanId: "saito",
    factionId: null,
  },
];

// === 城データ ===
const castleList: Castle[] = [
  {
    id: "kiyosu",
    name: "清洲城",
    ownerId: "oda",
    castellanId: "oda_nobunaga",
    soldiers: 4000,
    defense: 65,
    agriculture: 70,
    commerce: 85,
    loyalty: 80,
    adjacentCastleIds: ["nagoya", "inabayama"],
  },
  {
    id: "nagoya",
    name: "那古野城",
    ownerId: "oda",
    castellanId: "shibata_katsuie",
    soldiers: 2500,
    defense: 55,
    agriculture: 60,
    commerce: 70,
    loyalty: 75,
    adjacentCastleIds: ["kiyosu", "okazaki"],
  },
  {
    id: "okazaki",
    name: "岡崎城",
    ownerId: "imagawa",
    castellanId: "matsudaira_motoyasu",
    soldiers: 3500,
    defense: 60,
    agriculture: 55,
    commerce: 50,
    loyalty: 50,
    adjacentCastleIds: ["nagoya", "sunpu"],
  },
  {
    id: "sunpu",
    name: "駿府城",
    ownerId: "imagawa",
    castellanId: "imagawa_yoshimoto",
    soldiers: 7000,
    defense: 75,
    agriculture: 80,
    commerce: 70,
    loyalty: 70,
    adjacentCastleIds: ["okazaki"],
  },
  {
    id: "inabayama",
    name: "稲葉山城",
    ownerId: "saito",
    castellanId: "saito_yoshitatsu",
    soldiers: 5000,
    defense: 90,
    agriculture: 60,
    commerce: 65,
    loyalty: 55,
    adjacentCastleIds: ["kiyosu"],
  },
];

// === 勢力データ ===
const clanList: Clan[] = [
  {
    id: "oda",
    name: "織田家",
    leaderId: "oda_nobunaga",
    gold: 6000,
    food: 6000,
    castleIds: ["kiyosu", "nagoya"],
  },
  {
    id: "imagawa",
    name: "今川家",
    leaderId: "imagawa_yoshimoto",
    gold: 4000,
    food: 10000,
    castleIds: ["sunpu", "okazaki"],
  },
  {
    id: "saito",
    name: "斎藤家",
    leaderId: "saito_yoshitatsu",
    gold: 5000,
    food: 5000,
    castleIds: ["inabayama"],
  },
];

// === 派閥データ ===
const factionList: Faction[] = [
  {
    id: "oda_fudai",
    name: "織田譜代派",
    clanId: "oda",
    description: "家の安定と家格維持を最優先",
    memberIds: ["shibata_katsuie"],
  },
  {
    id: "oda_shinzan",
    name: "織田新参派",
    clanId: "oda",
    description: "戦功と領地拡大を重視",
    memberIds: ["kinoshita_tokichiro"],
  },
];

// === 外交関係 ===
const diplomacyRelations: DiplomacyRelation[] = [
  { clan1Id: "oda", clan2Id: "imagawa", type: "hostile", expirationTurn: null },
  { clan1Id: "oda", clan2Id: "saito", type: "neutral", expirationTurn: null },
  {
    clan1Id: "imagawa",
    clan2Id: "saito",
    type: "neutral",
    expirationTurn: null,
  },
];

// === 初期ゲーム状態を生成 ===
export function createInitialGameState(playerClanId: string): GameState {
  const bushoCatalog = new Map<string, Busho>();
  bushoList.forEach((b) => bushoCatalog.set(b.id, { ...b }));

  const clanCatalog = new Map<string, Clan>();
  clanList.forEach((c) => clanCatalog.set(c.id, { ...c }));

  const castleCatalog = new Map<string, Castle>();
  castleList.forEach((c) => castleCatalog.set(c.id, { ...c }));

  const factionCatalog = new Map<string, Faction>();
  factionList.forEach((f) => factionCatalog.set(f.id, { ...f }));

  return {
    turn: 1,
    bushoCatalog,
    clanCatalog,
    castleCatalog,
    factionCatalog,
    diplomacyRelations: [...diplomacyRelations],
    grudgeHistory: [],
    letters: [],
    playerClanId,
  };
}
