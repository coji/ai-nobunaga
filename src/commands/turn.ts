// ターン終了コマンド

import type { Busho, Castle, Clan, GameState } from '../types.js'
import type { CommandResult, GameCommand } from './types.js'

/** ターン終了コマンド */
export class EndTurnCommand implements GameCommand {
  readonly name = 'end_turn'

  execute(state: GameState, _clanId: string): CommandResult {
    const newState = structuredClone(state)
    const changes: string[] = []

    // 委任処理
    const delegationChanges = processDelegation(newState)
    changes.push(...delegationChanges)

    // 収入処理
    for (const clan of Object.values(newState.clanCatalog)) {
      let totalIncome = 0
      let totalFood = 0
      let totalUpkeep = 0

      for (const castleId of clan.castleIds) {
        const castle = newState.castleCatalog[castleId]
        if (!castle) continue

        const castellan = castle.castellanId
          ? newState.bushoCatalog[castle.castellanId]
          : null
        const castellanBonus = castellan ? 0.8 + castellan.politics / 250 : 1.0
        const loyaltyModifier = 0.4 + castle.loyalty * 0.008

        totalIncome += castle.commerce * 20 * loyaltyModifier * castellanBonus
        totalFood += castle.agriculture * 15 * loyaltyModifier * castellanBonus
        totalUpkeep += castle.soldiers * 0.2

        // 一揆発生リスク
        if (castle.loyalty < 20) {
          if (Math.random() < 0.3) {
            const soldierLoss = Math.floor(castle.soldiers * 0.1)
            castle.soldiers = Math.max(0, castle.soldiers - soldierLoss)
            changes.push(`⚠️ ${castle.name}で一揆発生！兵${soldierLoss}人離散`)
          }
        }

        // 民忠自然回復
        if (castle.loyalty < 50) {
          castle.loyalty = Math.min(50, castle.loyalty + 2)
        }
      }

      const netGold = Math.floor(totalIncome - totalUpkeep)
      const netFood = Math.floor(totalFood - totalUpkeep)
      clan.gold += netGold
      clan.food += netFood

      // ペナルティ処理
      if (clan.gold < 0) {
        changes.push(`⚠️ ${clan.name}は金欠状態！`)
        clan.gold = 0
      }
      if (clan.food < 0) {
        const totalSoldiers = clan.castleIds.reduce((sum, id) => {
          const castle = newState.castleCatalog[id]
          return sum + (castle?.soldiers ?? 0)
        }, 0)
        const desertion = Math.floor(totalSoldiers * 0.1)
        for (const castleId of clan.castleIds) {
          const castle = newState.castleCatalog[castleId]
          if (!castle) continue
          const loss = Math.floor(castle.soldiers * 0.1)
          castle.soldiers = Math.max(0, castle.soldiers - loss)
        }
        changes.push(`⚠️ ${clan.name}は兵糧切れ！兵${desertion}人が離散`)
        clan.food = 0
      }

      changes.push(
        `${clan.name}: 収入+${Math.floor(totalIncome)}金, 兵糧+${Math.floor(totalFood)}, 維持費-${Math.floor(totalUpkeep)}`,
      )
    }

    // 武将忠誠チェック
    const betrayalChanges = checkBushoLoyalty(newState)
    changes.push(...betrayalChanges)

    // ターン進行
    newState.turn++

    return {
      newState,
      result: {
        success: true,
        grade: 'success',
        action: {
          category: '内政',
          type: 'develop_agriculture',
          targetId: '',
          intent: 'ターン終了',
          riskTolerance: 0,
          value: 0,
        },
        message: `ターン${newState.turn}開始`,
        stateChanges: changes,
      },
      narrative: changes.join('\n'),
    }
  }
}

/** 委任処理 */
function processDelegation(state: GameState): string[] {
  const changes: string[] = []

  for (const castle of Object.values(state.castleCatalog)) {
    if (castle.delegationPolicy === 'none' || !castle.castellanId) continue

    const castellan = state.bushoCatalog[castle.castellanId]
    if (!castellan) continue

    const clan = state.clanCatalog[castle.ownerId]
    if (!clan) continue

    const politicsBonus = castellan.politics / 50

    switch (castle.delegationPolicy) {
      case 'agriculture': {
        const growth = Math.floor((3 + Math.random() * 3) * politicsBonus)
        castle.agriculture = Math.min(100, castle.agriculture + growth)
        changes.push(`📦 ${castle.name}: 農業+${growth}（${castellan.name}）`)
        break
      }
      case 'commerce': {
        const growth = Math.floor((3 + Math.random() * 3) * politicsBonus)
        castle.commerce = Math.min(100, castle.commerce + growth)
        changes.push(`💰 ${castle.name}: 商業+${growth}（${castellan.name}）`)
        break
      }
      case 'military': {
        const recruitCost = 200
        if (clan.gold >= recruitCost) {
          const soldiers = Math.floor((50 + Math.random() * 50) * politicsBonus)
          castle.soldiers += soldiers
          clan.gold -= recruitCost
          changes.push(`⚔️ ${castle.name}: 兵+${soldiers}（${castellan.name}）`)
        }
        break
      }
      case 'defense': {
        const growth = Math.floor((2 + Math.random() * 2) * politicsBonus)
        castle.defense = Math.min(100, castle.defense + growth)
        changes.push(`🏯 ${castle.name}: 防御+${growth}（${castellan.name}）`)
        break
      }
      case 'balanced': {
        const growth = Math.floor((2 + Math.random()) * politicsBonus)
        castle.agriculture = Math.min(100, castle.agriculture + growth)
        castle.commerce = Math.min(100, castle.commerce + growth)
        castle.defense = Math.min(100, castle.defense + growth)
        const soldierGrowth = Math.floor(growth * 15)
        castle.soldiers += soldierGrowth
        changes.push(
          `⚖️ ${castle.name}: 農商防各+${growth} 兵+${soldierGrowth}（${castellan.name}）`,
        )
        break
      }
    }
  }

  return changes
}

/** 武将忠誠チェック */
function checkBushoLoyalty(state: GameState): string[] {
  const changes: string[] = []

  for (const busho of Object.values(state.bushoCatalog)) {
    if (!busho.clanId) continue
    const clan = state.clanCatalog[busho.clanId]
    if (!clan || clan.leaderId === busho.id) continue

    if (busho.emotions.loyalty < 30) {
      const roll = Math.random()
      const betrayalChance = (30 - busho.emotions.loyalty) / 100

      if (roll < betrayalChance) {
        const castle = Object.values(state.castleCatalog).find(
          (c) => c.castellanId === busho.id,
        )

        if (castle) {
          if (busho.id === 'matsudaira_motoyasu') {
            changes.push(...handleMatsudairaIndependence(state, busho, castle))
          } else {
            changes.push(...handleBetrayalToCastle(state, busho, castle, clan))
          }
        } else {
          busho.clanId = null
          busho.factionId = null
          changes.push(`⚠️ ${busho.name}が出奔した！`)
        }
      }
    }

    if (busho.emotions.discontent > 50) {
      const loyaltyDrop = Math.floor((busho.emotions.discontent - 50) / 10)
      busho.emotions.loyalty = Math.max(0, busho.emotions.loyalty - loyaltyDrop)
    }
  }

  return changes
}

/** 松平元康の独立処理 */
function handleMatsudairaIndependence(
  state: GameState,
  busho: Busho,
  castle: Castle,
): string[] {
  const changes: string[] = []
  if (!busho.clanId) return changes

  const oldClan = state.clanCatalog[busho.clanId]
  if (!oldClan) return changes

  oldClan.castleIds = oldClan.castleIds.filter((id) => id !== castle.id)

  const tokugawaClan: Clan = {
    id: 'tokugawa',
    name: '徳川家',
    leaderId: busho.id,
    gold: 2000,
    food: 3000,
    castleIds: [castle.id],
  }
  state.clanCatalog['tokugawa'] = tokugawaClan

  busho.clanId = 'tokugawa'
  busho.name = '徳川家康'
  busho.emotions.loyalty = 100
  busho.emotions.discontent = 0

  castle.ownerId = 'tokugawa'

  state.diplomacyRelations.push(
    { clan1Id: 'tokugawa', clan2Id: 'oda', type: 'neutral', expirationTurn: null },
    { clan1Id: 'tokugawa', clan2Id: 'imagawa', type: 'hostile', expirationTurn: null },
    { clan1Id: 'tokugawa', clan2Id: 'saito', type: 'neutral', expirationTurn: null },
  )

  changes.push(`🏯 松平元康が今川家から独立！徳川家康と名乗り徳川家を興す！`)
  return changes
}

/** 通常の寝返り処理 */
function handleBetrayalToCastle(
  state: GameState,
  busho: Busho,
  castle: Castle,
  oldClan: Clan,
): string[] {
  const changes: string[] = []

  const hostileRelation = state.diplomacyRelations.find(
    (r) =>
      r.type === 'hostile' &&
      (r.clan1Id === oldClan.id || r.clan2Id === oldClan.id),
  )

  if (hostileRelation) {
    const newClanId =
      hostileRelation.clan1Id === oldClan.id
        ? hostileRelation.clan2Id
        : hostileRelation.clan1Id
    const newClan = state.clanCatalog[newClanId]

    if (newClan) {
      oldClan.castleIds = oldClan.castleIds.filter((id) => id !== castle.id)
      newClan.castleIds.push(castle.id)
      castle.ownerId = newClanId

      busho.clanId = newClanId
      busho.factionId = null
      busho.emotions.loyalty = 60
      busho.emotions.discontent = 0

      changes.push(
        `⚠️ ${busho.name}が${oldClan.name}を裏切り、${castle.name}ごと${newClan.name}に寝返った！`,
      )
    }
  }

  return changes
}

/** 委任設定コマンド */
export class DelegateCommand implements GameCommand {
  readonly name = 'delegate'

  constructor(
    private readonly castleId: string,
    private readonly policy: Castle['delegationPolicy'],
  ) {}

  execute(state: GameState, clanId: string): CommandResult {
    const castle = state.castleCatalog[this.castleId]

    if (!castle) {
      return {
        newState: state,
        result: {
          success: false,
          grade: 'failure',
          action: {
            category: '内政',
            type: 'develop_agriculture',
            targetId: this.castleId,
            intent: '委任設定',
            riskTolerance: 0,
            value: 0,
          },
          message: '城が見つかりません',
          stateChanges: [],
        },
        narrative: '城が見つかりません',
      }
    }

    if (castle.ownerId !== clanId) {
      return {
        newState: state,
        result: {
          success: false,
          grade: 'failure',
          action: {
            category: '内政',
            type: 'develop_agriculture',
            targetId: this.castleId,
            intent: '委任設定',
            riskTolerance: 0,
            value: 0,
          },
          message: '他勢力の城は設定できません',
          stateChanges: [],
        },
        narrative: '他勢力の城は設定できません',
      }
    }

    const newState = structuredClone(state)
    const newCastle = newState.castleCatalog[this.castleId]
    if (!newCastle) {
      return {
        newState: state,
        result: {
          success: false,
          grade: 'failure',
          action: {
            category: '内政',
            type: 'develop_agriculture',
            targetId: this.castleId,
            intent: '委任設定',
            riskTolerance: 0,
            value: 0,
          },
          message: '内部エラー',
          stateChanges: [],
        },
        narrative: '内部エラー',
      }
    }
    newCastle.delegationPolicy = this.policy

    const policyNames = {
      none: 'なし',
      agriculture: '農業重視',
      commerce: '商業重視',
      military: '軍備重視',
      defense: '防衛重視',
      balanced: 'バランス型',
    }

    return {
      newState,
      result: {
        success: true,
        grade: 'success',
        action: {
          category: '内政',
          type: 'develop_agriculture',
          targetId: this.castleId,
          intent: '委任設定',
          riskTolerance: 0,
          value: 0,
        },
        message: `${castle.name}の委任方針を${policyNames[this.policy]}に設定`,
        stateChanges: [`${castle.name}の委任方針: ${policyNames[this.policy]}`],
      },
      narrative: `${castle.name}の委任方針を${policyNames[this.policy]}に設定しました`,
    }
  }
}
