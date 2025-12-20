// 軍事コマンド

import type { GameState, MilitaryAction } from '../types.js'
import {
  createFailureResult,
  createSuccessResult,
  getGradeMultiplier,
  getGradeNarrative,
  rollForGrade,
  type CommandResult,
  type GameCommand,
} from './types.js'

/** 徴兵コマンド */
export class RecruitSoldiersCommand implements GameCommand {
  readonly name = 'recruit_soldiers'

  constructor(
    private readonly castleId: string,
    private readonly count: number,
  ) {}

  execute(state: GameState, clanId: string): CommandResult {
    const action: MilitaryAction = {
      category: '軍事',
      type: 'recruit_soldiers',
      targetId: this.castleId,
      intent: '徴兵',
      riskTolerance: 0.2,
      value: this.count,
    }

    const clan = state.clanCatalog[clanId]
    const castle = state.castleCatalog[this.castleId]

    if (!clan) {
      return createFailureResult(state, action, `勢力が見つかりません: ${clanId}`)
    }
    if (!castle) {
      return createFailureResult(state, action, `城が見つかりません: ${this.castleId}`)
    }
    if (castle.ownerId !== clanId) {
      return createFailureResult(state, action, '他勢力の城では徴兵できません')
    }

    // 徴兵コスト: 兵1人あたり2金
    const cost = this.count * 2
    if (clan.gold < cost) {
      return createFailureResult(state, action, '資金が不足しています')
    }

    const newState = structuredClone(state)
    const newClan = newState.clanCatalog[clanId]
    const newCastle = newState.castleCatalog[this.castleId]
    if (!newClan || !newCastle) {
      return createFailureResult(state, action, '内部エラー')
    }

    const grade = rollForGrade()
    const multiplier = getGradeMultiplier(grade)

    // 実際の徴兵数（グレードで変動）
    const actualCount = Math.floor(this.count * multiplier)
    const oldSoldiers = newCastle.soldiers
    newCastle.soldiers += actualCount
    newClan.gold -= cost

    // 徴兵で民忠が下がる（5〜10）
    const loyaltyDrop = 5 + Math.floor(Math.random() * 5)
    newCastle.loyalty = Math.max(0, newCastle.loyalty - loyaltyDrop)

    const stateChanges = [
      `${newCastle.name}の兵力: ${oldSoldiers} → ${newCastle.soldiers}`,
      `${newCastle.name}の民忠: -${loyaltyDrop}`,
      `${newClan.name}の金: -${cost}`,
    ]

    const narrative = `${getGradeNarrative(grade)}${newCastle.name}で${actualCount}人を徴兵（民忠-${loyaltyDrop}）`

    return createSuccessResult(newState, action, grade, narrative, stateChanges, narrative)
  }
}

/** 城壁修築コマンド */
export class FortifyCommand implements GameCommand {
  readonly name = 'fortify'

  constructor(
    private readonly castleId: string,
    private readonly investment: number,
  ) {}

  execute(state: GameState, clanId: string): CommandResult {
    const action: MilitaryAction = {
      category: '軍事',
      type: 'fortify',
      targetId: this.castleId,
      intent: '城壁修築',
      riskTolerance: 0.2,
      value: this.investment,
    }

    const clan = state.clanCatalog[clanId]
    const castle = state.castleCatalog[this.castleId]

    if (!clan) {
      return createFailureResult(state, action, `勢力が見つかりません: ${clanId}`)
    }
    if (!castle) {
      return createFailureResult(state, action, `城が見つかりません: ${this.castleId}`)
    }
    if (castle.ownerId !== clanId) {
      return createFailureResult(state, action, '他勢力の城は修築できません')
    }
    if (clan.gold < this.investment) {
      return createFailureResult(state, action, '資金が不足しています')
    }

    const newState = structuredClone(state)
    const newClan = newState.clanCatalog[clanId]
    const newCastle = newState.castleCatalog[this.castleId]
    if (!newClan || !newCastle) {
      return createFailureResult(state, action, '内部エラー')
    }

    const grade = rollForGrade()
    const multiplier = getGradeMultiplier(grade)

    const growth = Math.floor((this.investment / 100) * multiplier)
    const oldDefense = newCastle.defense
    newCastle.defense = Math.min(100, newCastle.defense + growth)
    newClan.gold -= this.investment

    const stateChanges = [
      `${newCastle.name}の防御力: ${oldDefense} → ${newCastle.defense}`,
      `${newClan.name}の金: -${this.investment}`,
    ]

    const narrative = `${getGradeNarrative(grade)}${newCastle.name}の城壁を修築。防御力+${growth}`

    return createSuccessResult(newState, action, grade, narrative, stateChanges, narrative)
  }
}

/** 攻撃コマンド */
export class AttackCommand implements GameCommand {
  readonly name = 'attack'

  constructor(
    private readonly fromCastleId: string,
    private readonly targetCastleId: string,
    private readonly soldierCount: number,
  ) {}

  execute(state: GameState, clanId: string): CommandResult {
    const action: MilitaryAction = {
      category: '軍事',
      type: 'attack',
      targetId: this.targetCastleId,
      intent: '攻撃',
      riskTolerance: 0.7,
      fromCastleId: this.fromCastleId,
      soldierCount: this.soldierCount,
    }

    const clan = state.clanCatalog[clanId]
    const fromCastle = state.castleCatalog[this.fromCastleId]
    const targetCastle = state.castleCatalog[this.targetCastleId]

    if (!clan) {
      return createFailureResult(state, action, `勢力が見つかりません: ${clanId}`)
    }
    if (!fromCastle) {
      return createFailureResult(state, action, `出撃城が見つかりません: ${this.fromCastleId}`)
    }
    if (!targetCastle) {
      return createFailureResult(state, action, `対象城が見つかりません: ${this.targetCastleId}`)
    }
    if (fromCastle.ownerId !== clanId) {
      return createFailureResult(state, action, '他勢力の城からは出撃できません')
    }
    if (targetCastle.ownerId === clanId) {
      return createFailureResult(state, action, '自軍の城は攻撃できません')
    }
    if (fromCastle.soldiers < this.soldierCount) {
      return createFailureResult(state, action, '兵力が不足しています')
    }
    if (!fromCastle.adjacentCastleIds.includes(this.targetCastleId)) {
      return createFailureResult(state, action, '隣接していない城は攻撃できません')
    }

    const newState = structuredClone(state)
    const newFromCastle = newState.castleCatalog[this.fromCastleId]
    const newTargetCastle = newState.castleCatalog[this.targetCastleId]
    const newClan = newState.clanCatalog[clanId]
    const defenderClan = newState.clanCatalog[targetCastle.ownerId]
    if (!newFromCastle || !newTargetCastle || !newClan) {
      return createFailureResult(state, action, '内部エラー')
    }

    const grade = rollForGrade()

    // 戦闘計算
    const attackPower = this.soldierCount * (grade === 'critical_success' ? 1.5 : grade === 'critical_failure' ? 0.5 : 1.0)
    const defensePower = newTargetCastle.soldiers * (1 + newTargetCastle.defense / 100)

    // 出撃した兵を減らす
    newFromCastle.soldiers -= this.soldierCount

    const stateChanges: string[] = []

    if (attackPower > defensePower) {
      // 攻撃側勝利
      const survivingAttackers = Math.floor(this.soldierCount * 0.7)
      const oldOwner = newTargetCastle.ownerId

      // 城の所有権を変更
      newTargetCastle.ownerId = clanId
      newTargetCastle.soldiers = survivingAttackers
      newTargetCastle.castellanId = null // 城主は空席に
      newTargetCastle.loyalty = 30 // 占領直後は民忠低下

      // 勢力の城リストを更新
      newClan.castleIds.push(this.targetCastleId)
      if (defenderClan) {
        defenderClan.castleIds = defenderClan.castleIds.filter((id) => id !== this.targetCastleId)
      }

      stateChanges.push(
        `${newTargetCastle.name}を占領！`,
        `生存兵: ${survivingAttackers}`,
      )

      // 怨恨を追加
      newState.grudgeHistory.push({
        id: `grudge_${Date.now()}`,
        turn: state.turn,
        actorId: clanId,
        targetId: oldOwner,
        type: 'territory_loss',
        description: `${clan.name}が${targetCastle.name}を奪取`,
        emotionImpact: { loyalty: -10, discontent: 20 },
      })

      const narrative = `${getGradeNarrative(grade)}${fromCastle.name}から${this.soldierCount}の兵で${targetCastle.name}を攻撃し、勝利！城を占領した。`
      return createSuccessResult(newState, action, grade, narrative, stateChanges, narrative)
    } else {
      // 防御側勝利
      const attackerLoss = Math.floor(this.soldierCount * 0.8)
      const defenderLoss = Math.floor(newTargetCastle.soldiers * 0.3)
      newTargetCastle.soldiers = Math.max(100, newTargetCastle.soldiers - defenderLoss)

      stateChanges.push(
        `攻撃失敗`,
        `攻撃側損失: ${attackerLoss}`,
        `防御側損失: ${defenderLoss}`,
      )

      const narrative = `${getGradeNarrative(grade)}${fromCastle.name}から${this.soldierCount}の兵で${targetCastle.name}を攻撃したが、撃退された。`
      return createSuccessResult(newState, action, grade, narrative, stateChanges, narrative)
    }
  }
}
