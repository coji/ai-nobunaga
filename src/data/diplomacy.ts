// 外交関係・派閥データ

import type { DiplomacyRelation, Faction } from '../types.js'

// 派閥データ
export const factionList: Faction[] = [
  {
    id: 'oda_fudai',
    name: '織田譜代派',
    clanId: 'oda',
    description: '家の安定と家格維持を最優先',
    memberIds: ['shibata_katsuie'],
  },
  {
    id: 'oda_shinzan',
    name: '織田新参派',
    clanId: 'oda',
    description: '戦功と領地拡大を重視',
    memberIds: ['kinoshita_tokichiro'],
  },
]

// 外交関係
export const diplomacyRelations: DiplomacyRelation[] = [
  // 織田家の関係
  { clan1Id: 'oda', clan2Id: 'imagawa', type: 'hostile', expirationTurn: null },
  { clan1Id: 'oda', clan2Id: 'saito', type: 'hostile', expirationTurn: null },

  // 武田・今川・北条の三国同盟
  {
    clan1Id: 'takeda',
    clan2Id: 'imagawa',
    type: 'alliance',
    expirationTurn: 24,
  },
  { clan1Id: 'takeda', clan2Id: 'hojo', type: 'alliance', expirationTurn: 24 },
  { clan1Id: 'imagawa', clan2Id: 'hojo', type: 'alliance', expirationTurn: 24 },

  // 武田・上杉は敵対（川中島）
  {
    clan1Id: 'takeda',
    clan2Id: 'uesugi',
    type: 'hostile',
    expirationTurn: null,
  },

  // 毛利・大友は敵対
  { clan1Id: 'mori', clan2Id: 'otomo', type: 'hostile', expirationTurn: null },

  // 毛利・尼子は敵対（中国地方の覇権争い）
  { clan1Id: 'mori', clan2Id: 'amago', type: 'hostile', expirationTurn: null },

  // 島津・大友・龍造寺は九州で敵対
  {
    clan1Id: 'shimazu',
    clan2Id: 'otomo',
    type: 'hostile',
    expirationTurn: null,
  },
  {
    clan1Id: 'shimazu',
    clan2Id: 'ryuzoji',
    type: 'hostile',
    expirationTurn: null,
  },
  {
    clan1Id: 'otomo',
    clan2Id: 'ryuzoji',
    type: 'hostile',
    expirationTurn: null,
  },

  // 島津・伊東は敵対（日向の支配権争い）
  { clan1Id: 'shimazu', clan2Id: 'ito', type: 'hostile', expirationTurn: null },

  // 長宗我部・河野は緊張関係
  {
    clan1Id: 'chosokabe',
    clan2Id: 'kono',
    type: 'hostile',
    expirationTurn: null,
  },
  {
    clan1Id: 'chosokabe',
    clan2Id: 'saionji',
    type: 'hostile',
    expirationTurn: null,
  },

  // 浅井・朝倉は同盟
  { clan1Id: 'azai', clan2Id: 'asakura', type: 'alliance', expirationTurn: 36 },

  // 本願寺・三好は敵対（1559年から対立）
  {
    clan1Id: 'honganji',
    clan2Id: 'miyoshi',
    type: 'hostile',
    expirationTurn: null,
  },

  // 伊達・最上は緊張関係
  { clan1Id: 'date', clan2Id: 'mogami', type: 'hostile', expirationTurn: null },

  // 上杉・北条は敵対（関東管領を巡る対立）
  { clan1Id: 'uesugi', clan2Id: 'hojo', type: 'hostile', expirationTurn: null },

  // ===== 新規追加 =====
  // 伊達・蘆名は婚姻同盟（盛氏の娘が輝宗に嫁ぐ）
  { clan1Id: 'date', clan2Id: 'ashina', type: 'alliance', expirationTurn: 36 },

  // 六角・浅井は敵対（北近江の支配を巡る対立）
  {
    clan1Id: 'rokkaku',
    clan2Id: 'azai',
    type: 'hostile',
    expirationTurn: null,
  },

  // 上杉・神保は敵対（越中支配を巡る対立）
  {
    clan1Id: 'uesugi',
    clan2Id: 'jinbo',
    type: 'hostile',
    expirationTurn: null,
  },

  // 長野は上杉に従属的同盟
  {
    clan1Id: 'uesugi',
    clan2Id: 'nagano',
    type: 'alliance',
    expirationTurn: 24,
  },

  // 北条・宇都宮は敵対（関東の覇権争い）
  {
    clan1Id: 'hojo',
    clan2Id: 'utsunomiya',
    type: 'hostile',
    expirationTurn: null,
  },
]
