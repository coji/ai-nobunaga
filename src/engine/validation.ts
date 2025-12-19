// 行動の検証ロジック

import type {
  DiplomacyAction,
  DomesticAction,
  GameAction,
  GameState,
  IntrigueAction,
  MilitaryAction,
} from '../types.js'

/** 行動が実行可能かどうかを検証 */
export function validateAction(
  state: GameState,
  clanId: string,
  action: GameAction,
): { valid: boolean; reason?: string } {
  const clan = state.clanCatalog.get(clanId)
  if (!clan) return { valid: false, reason: '勢力が存在しません' }

  switch (action.category) {
    case '内政':
      return validateDomesticAction(state, clan.id, action)
    case '外交':
      return validateDiplomacyAction(state, clan.id, action)
    case '軍事':
      return validateMilitaryAction(state, clan.id, action)
    case '謀略':
      return validateIntrigueAction(state, clan.id, action)
    default:
      return { valid: false, reason: '不明な行動カテゴリ' }
  }
}

function validateDomesticAction(
  state: GameState,
  clanId: string,
  action: DomesticAction,
): { valid: boolean; reason?: string } {
  const castle = state.castleCatalog.get(action.targetId)
  if (!castle) return { valid: false, reason: '対象の城が存在しません' }
  if (castle.ownerId !== clanId)
    return { valid: false, reason: '自勢力の城ではありません' }

  const clan = state.clanCatalog.get(clanId)
  if (!clan) return { valid: false, reason: '勢力が存在しません' }
  if (clan.gold < action.value) {
    return { valid: false, reason: '金銭が足りません' }
  }

  return { valid: true }
}

function validateDiplomacyAction(
  state: GameState,
  clanId: string,
  action: DiplomacyAction,
): { valid: boolean; reason?: string } {
  const targetClan = state.clanCatalog.get(action.targetId)
  if (!targetClan) return { valid: false, reason: '対象の勢力が存在しません' }
  if (action.targetId === clanId)
    return { valid: false, reason: '自勢力に外交はできません' }

  return { valid: true }
}

function validateMilitaryAction(
  state: GameState,
  clanId: string,
  action: MilitaryAction,
): { valid: boolean; reason?: string } {
  const clan = state.clanCatalog.get(clanId)
  if (!clan) return { valid: false, reason: '勢力が存在しません' }
  const targetCastle = state.castleCatalog.get(action.targetId)
  if (!targetCastle) return { valid: false, reason: '対象の城が存在しません' }

  if (action.type === 'recruit_soldiers') {
    if (targetCastle.ownerId !== clanId)
      return { valid: false, reason: '自勢力の城ではありません' }
    if (clan.food < (action.value || 0) * 3) {
      return { valid: false, reason: '兵糧が足りません' }
    }
    return { valid: true }
  }

  if (action.type === 'fortify') {
    if (targetCastle.ownerId !== clanId)
      return { valid: false, reason: '自勢力の城ではありません' }
    if (clan.gold < (action.value || 0)) {
      return { valid: false, reason: '金銭が足りません' }
    }
    return { valid: true }
  }

  if (action.type === 'attack') {
    const fromCastle = state.castleCatalog.get(action.fromCastleId || '')
    if (!fromCastle) return { valid: false, reason: '出撃元の城が存在しません' }
    if (fromCastle.ownerId !== clanId)
      return { valid: false, reason: '出撃元が自勢力の城ではありません' }
    if (fromCastle.soldiers < (action.soldierCount || 0))
      return { valid: false, reason: '兵数が足りません' }
    if (!fromCastle.adjacentCastleIds.includes(action.targetId)) {
      return { valid: false, reason: '隣接していない城には攻撃できません' }
    }
    if (targetCastle.ownerId === clanId) {
      return { valid: false, reason: '自勢力の城は攻撃できません' }
    }
  }

  return { valid: true }
}

function validateIntrigueAction(
  state: GameState,
  clanId: string,
  action: IntrigueAction,
): { valid: boolean; reason?: string } {
  const clan = state.clanCatalog.get(clanId)
  if (!clan) return { valid: false, reason: '勢力が存在しません' }
  const costs: Record<IntrigueAction['type'], number> = {
    bribe: 500,
    assassinate: 1000,
    spread_rumor: 200,
    incite_rebellion: 800,
  }

  if (clan.gold < costs[action.type]) {
    return { valid: false, reason: '金銭が足りません' }
  }

  return { valid: true }
}
