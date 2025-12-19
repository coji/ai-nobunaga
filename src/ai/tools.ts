// ゲームツール定義（Function Calling用）

import { Type } from '@google/genai'

export const gameTools = [
  {
    name: 'develop_agriculture',
    description: '城の農業力を発展させる（内政）- 兵糧生産を増加',
    parameters: {
      type: Type.OBJECT,
      properties: {
        castleId: { type: Type.STRING, description: '対象の城ID' },
        investment: { type: Type.NUMBER, description: '投資額（100-2000金）' },
        intent: { type: Type.STRING, description: '行動の意図（20文字以内）' },
      },
      required: ['castleId', 'investment', 'intent'],
    },
  },
  {
    name: 'develop_commerce',
    description: '城の商業力を発展させる（内政）- 金収入を増加',
    parameters: {
      type: Type.OBJECT,
      properties: {
        castleId: { type: Type.STRING, description: '対象の城ID' },
        investment: { type: Type.NUMBER, description: '投資額（100-2000金）' },
        intent: { type: Type.STRING, description: '行動の意図（20文字以内）' },
      },
      required: ['castleId', 'investment', 'intent'],
    },
  },
  {
    name: 'recruit_soldiers',
    description: '城で兵を徴兵する（軍事）- 兵糧を消費',
    parameters: {
      type: Type.OBJECT,
      properties: {
        castleId: { type: Type.STRING, description: '対象の城ID' },
        count: { type: Type.NUMBER, description: '徴兵数' },
        intent: { type: Type.STRING, description: '行動の意図（20文字以内）' },
      },
      required: ['castleId', 'count', 'intent'],
    },
  },
  {
    name: 'fortify',
    description: '城の防御力を強化する（軍事）- 金を消費',
    parameters: {
      type: Type.OBJECT,
      properties: {
        castleId: { type: Type.STRING, description: '対象の城ID' },
        investment: { type: Type.NUMBER, description: '投資額（100-2000金）' },
        intent: { type: Type.STRING, description: '行動の意図（20文字以内）' },
      },
      required: ['castleId', 'investment', 'intent'],
    },
  },
  {
    name: 'attack',
    description: '敵の城を攻撃する（軍事）。隣接する城のみ攻撃可能',
    parameters: {
      type: Type.OBJECT,
      properties: {
        fromCastleId: { type: Type.STRING, description: '出撃元の城ID' },
        targetCastleId: { type: Type.STRING, description: '攻撃対象の城ID' },
        soldierCount: { type: Type.NUMBER, description: '動員する兵数' },
        intent: { type: Type.STRING, description: '行動の意図（20文字以内）' },
      },
      required: ['fromCastleId', 'targetCastleId', 'soldierCount', 'intent'],
    },
  },
  {
    name: 'propose_alliance',
    description: '他勢力に同盟を申し入れる（外交）',
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetClanId: { type: Type.STRING, description: '対象の勢力ID' },
        duration: { type: Type.NUMBER, description: '同盟期間（ターン数）' },
        intent: { type: Type.STRING, description: '行動の意図（20文字以内）' },
      },
      required: ['targetClanId', 'intent'],
    },
  },
  {
    name: 'send_gift',
    description: '他勢力に贈り物を送る（外交）',
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetClanId: { type: Type.STRING, description: '対象の勢力ID' },
        goldAmount: { type: Type.NUMBER, description: '贈答金額' },
        intent: { type: Type.STRING, description: '行動の意図（20文字以内）' },
      },
      required: ['targetClanId', 'goldAmount', 'intent'],
    },
  },
  {
    name: 'threaten',
    description: '他勢力を威嚇する（外交）',
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetClanId: { type: Type.STRING, description: '対象の勢力ID' },
        intent: { type: Type.STRING, description: '行動の意図（20文字以内）' },
      },
      required: ['targetClanId', 'intent'],
    },
  },
  {
    name: 'bribe',
    description: '敵の武将を買収する（謀略）',
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetBushoId: { type: Type.STRING, description: '対象の武将ID' },
        intent: { type: Type.STRING, description: '行動の意図（20文字以内）' },
      },
      required: ['targetBushoId', 'intent'],
    },
  },
  {
    name: 'spread_rumor',
    description: '敵の武将について流言を広める（謀略）',
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetBushoId: { type: Type.STRING, description: '対象の武将ID' },
        intent: { type: Type.STRING, description: '行動の意図（20文字以内）' },
      },
      required: ['targetBushoId', 'intent'],
    },
  },
  {
    name: 'end_turn',
    description: 'このターンの行動を終了する',
    parameters: {
      type: Type.OBJECT,
      properties: {
        summary: {
          type: Type.STRING,
          description: 'このターンの総括（50文字以内）',
        },
      },
      required: ['summary'],
    },
  },
]
