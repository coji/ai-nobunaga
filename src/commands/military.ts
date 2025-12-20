// 軍事コマンド

import { EMOTIONS, MILITARY } from '../constants/index.js'
import type { GameState, MilitaryAction } from '../types.js'
import { BaseCommand, CastleCommand } from './base.js'
import {
  createFailureResult,
  createSuccessResult,
  type CommandResult,
} from './types.js'

/** 徴兵コマンド */
export class RecruitSoldiersCommand extends CastleCommand {
  readonly name = 'recruit_soldiers'

  constructor(castleId: string, private readonly count: number) {
    super(castleId, count * MILITARY.RECRUIT_COST_PER_SOLDIER)
  }

  protected getAction(): MilitaryAction {
    return {
      category: '軍事',
      type: 'recruit_soldiers',
      targetId: this.castleId,
      intent: '徴兵',
      riskTolerance: 0.2,
      value: this.count,
    }
  }

  execute(state: GameState, clanId: string): CommandResult {
    const error = this.validatePreConditions(state, clanId)
    if (error) return error

    const ctx = this.prepareCastleContext(state, clanId, this.castleId)
    const { grade, multiplier, narrative: gradePrefix } = this.rollGrade()

    // 実際の徴兵数（グレードで変動）
    const actualCount = Math.floor(this.count * multiplier)
    const oldSoldiers = ctx.castle.soldiers
    ctx.castle.soldiers += actualCount
    ctx.clan.gold -= this.investment

    // 徴兵で民忠が下がる
    const loyaltyDrop =
      MILITARY.RECRUIT_LOYALTY_DROP_MIN +
      Math.floor(Math.random() * MILITARY.RECRUIT_LOYALTY_DROP_BONUS)
    ctx.castle.loyalty = Math.max(0, ctx.castle.loyalty - loyaltyDrop)

    const stateChanges = [
      `${ctx.castle.name}の兵力: ${oldSoldiers} → ${ctx.castle.soldiers}`,
      `${ctx.castle.name}の民忠: -${loyaltyDrop}`,
      `${ctx.clan.name}の金: -${this.investment}`,
    ]

    const narrative = `${gradePrefix}${ctx.castle.name}で${actualCount}人を徴兵（民忠-${loyaltyDrop}）`

    return createSuccessResult(
      ctx.newState,
      this.getAction(),
      grade,
      narrative,
      stateChanges,
      narrative,
    )
  }
}

/** 城壁修築コマンド */
export class FortifyCommand extends CastleCommand {
  readonly name = 'fortify'

  protected getAction(): MilitaryAction {
    return {
      category: '軍事',
      type: 'fortify',
      targetId: this.castleId,
      intent: '城壁修築',
      riskTolerance: 0.2,
      value: this.investment,
    }
  }

  execute(state: GameState, clanId: string): CommandResult {
    const error = this.validatePreConditions(state, clanId)
    if (error) return error

    const ctx = this.prepareCastleContext(state, clanId, this.castleId)
    const { grade, multiplier, narrative: gradePrefix } = this.rollGrade()

    const growth = Math.floor((this.investment / 100) * multiplier)
    const oldDefense = ctx.castle.defense
    ctx.castle.defense = Math.min(100, ctx.castle.defense + growth)
    ctx.clan.gold -= this.investment

    const stateChanges = [
      `${ctx.castle.name}の防御力: ${oldDefense} → ${ctx.castle.defense}`,
      `${ctx.clan.name}の金: -${this.investment}`,
    ]

    const narrative = `${gradePrefix}${ctx.castle.name}の城壁を修築。防御力+${growth}`

    return createSuccessResult(
      ctx.newState,
      this.getAction(),
      grade,
      narrative,
      stateChanges,
      narrative,
    )
  }
}

/** 攻撃コマンド */
export class AttackCommand extends BaseCommand {
  readonly name = 'attack'

  constructor(
    private readonly fromCastleId: string,
    private readonly targetCastleId: string,
    private readonly soldierCount: number,
  ) {
    super()
  }

  protected getAction(): MilitaryAction {
    return {
      category: '軍事',
      type: 'attack',
      targetId: this.targetCastleId,
      intent: '攻撃',
      riskTolerance: 0.7,
      fromCastleId: this.fromCastleId,
      soldierCount: this.soldierCount,
    }
  }

  execute(state: GameState, clanId: string): CommandResult {
    const action = this.getAction()

    // バリデーション
    const clanError = this.validateClan(state, clanId)
    if (clanError) return clanError

    const clan = state.clanCatalog[clanId]
    if (!clan) return this.internalError(state)

    const fromCastle = state.castleCatalog[this.fromCastleId]
    const targetCastle = state.castleCatalog[this.targetCastleId]

    if (!fromCastle) {
      return createFailureResult(
        state,
        action,
        `出撃城が見つかりません: ${this.fromCastleId}`,
      )
    }
    if (!targetCastle) {
      return createFailureResult(
        state,
        action,
        `対象城が見つかりません: ${this.targetCastleId}`,
      )
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

    // 状態のコピー
    const ctx = this.prepareContext(state, clanId)
    const newFromCastle = ctx.newState.castleCatalog[this.fromCastleId]
    const newTargetCastle = ctx.newState.castleCatalog[this.targetCastleId]
    const defenderClan = ctx.newState.clanCatalog[targetCastle.ownerId]

    if (!newFromCastle || !newTargetCastle) {
      return this.internalError(state)
    }

    const { grade, narrative: gradePrefix } = this.rollGrade()

    // 戦闘計算
    const gradeMultiplier =
      grade === 'critical_success' ? 1.5 : grade === 'critical_failure' ? 0.5 : 1.0
    const attackPower = this.soldierCount * gradeMultiplier
    const defensePower = newTargetCastle.soldiers * (1 + newTargetCastle.defense / 100)

    // 出撃した兵を減らす
    newFromCastle.soldiers -= this.soldierCount

    const stateChanges: string[] = []

    if (attackPower > defensePower) {
      // 攻撃側勝利
      const survivingAttackers = Math.floor(this.soldierCount * MILITARY.ATTACK_SURVIVOR_RATE)
      const oldOwner = newTargetCastle.ownerId

      // 城の所有権を変更
      newTargetCastle.ownerId = clanId
      newTargetCastle.soldiers = survivingAttackers
      newTargetCastle.castellanId = null
      newTargetCastle.loyalty = MILITARY.OCCUPATION_LOYALTY

      // 勢力の城リストを更新
      ctx.clan.castleIds.push(this.targetCastleId)
      if (defenderClan) {
        defenderClan.castleIds = defenderClan.castleIds.filter(
          (id) => id !== this.targetCastleId,
        )
      }

      stateChanges.push(`${newTargetCastle.name}を占領！`, `生存兵: ${survivingAttackers}`)

      // 怨恨を追加
      ctx.newState.grudgeHistory.push({
        id: `grudge_${Date.now()}`,
        turn: state.turn,
        actorId: clanId,
        targetId: oldOwner,
        type: 'territory_loss',
        description: `${clan.name}が${targetCastle.name}を奪取`,
        emotionImpact: {
          loyalty: EMOTIONS.TERRITORY_LOSS_LOYALTY_IMPACT,
          discontent: EMOTIONS.TERRITORY_LOSS_DISCONTENT_IMPACT,
        },
      })

      const narrative = `${gradePrefix}${fromCastle.name}から${this.soldierCount}の兵で${targetCastle.name}を攻撃し、勝利！城を占領した。`
      return createSuccessResult(ctx.newState, action, grade, narrative, stateChanges, narrative)
    } else {
      // 防御側勝利
      const attackerLoss = Math.floor(this.soldierCount * MILITARY.ATTACK_LOSS_RATE)
      const defenderLoss = Math.floor(newTargetCastle.soldiers * MILITARY.DEFENSE_LOSS_RATE)
      newTargetCastle.soldiers = Math.max(
        MILITARY.MIN_SOLDIERS_AFTER_ATTACK,
        newTargetCastle.soldiers - defenderLoss,
      )

      stateChanges.push(
        `攻撃失敗`,
        `攻撃側損失: ${attackerLoss}`,
        `防御側損失: ${defenderLoss}`,
      )

      const narrative = `${gradePrefix}${fromCastle.name}から${this.soldierCount}の兵で${targetCastle.name}を攻撃したが、撃退された。`
      return createSuccessResult(ctx.newState, action, grade, narrative, stateChanges, narrative)
    }
  }
}
