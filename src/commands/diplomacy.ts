// 外交コマンド

import type { DiplomacyAction, GameState } from '../types.js'
import { BaseCommand } from './base.js'
import {
  createFailureResult,
  createSuccessResult,
  type CommandResult,
} from './types.js'

/** 同盟提案コマンド */
export class ProposeAllianceCommand extends BaseCommand {
  readonly name = 'propose_alliance'

  constructor(private readonly targetClanId: string) {
    super()
  }

  protected getAction(): DiplomacyAction {
    return {
      category: '外交',
      type: 'propose_alliance',
      targetId: this.targetClanId,
      intent: '同盟提案',
      riskTolerance: 0.3,
    }
  }

  execute(state: GameState, clanId: string): CommandResult {
    const action = this.getAction()

    // バリデーション
    const clanError = this.validateClan(state, clanId)
    if (clanError) return clanError

    const clan = state.clanCatalog[clanId]
    if (!clan) return this.internalError(state)

    const targetClan = state.clanCatalog[this.targetClanId]
    if (!targetClan) {
      return createFailureResult(
        state,
        action,
        `対象勢力が見つかりません: ${this.targetClanId}`,
      )
    }
    if (clanId === this.targetClanId) {
      return createFailureResult(state, action, '自勢力とは同盟できません')
    }

    // 既存の同盟をチェック
    const existingAlliance = state.diplomacyRelations.find(
      (r) =>
        r.type === 'alliance' &&
        ((r.clan1Id === clanId && r.clan2Id === this.targetClanId) ||
          (r.clan1Id === this.targetClanId && r.clan2Id === clanId)),
    )
    if (existingAlliance) {
      return createFailureResult(state, action, '既に同盟関係にあります')
    }

    const ctx = this.prepareContext(state, clanId)
    const { grade, multiplier, narrative: gradePrefix } = this.rollGrade()

    // 同盟成功率（グレードと相手の外交状況で変動）
    const baseSuccessRate = 0.5
    const gradeBonus = multiplier - 1.0 // -0.5 〜 +0.5
    const successRate = Math.min(0.95, Math.max(0.05, baseSuccessRate + gradeBonus * 0.3))

    const stateChanges: string[] = []

    if (Math.random() < successRate) {
      // 同盟成立
      ctx.newState.diplomacyRelations.push({
        clan1Id: clanId,
        clan2Id: this.targetClanId,
        type: 'alliance',
        expirationTurn: state.turn + 10, // 10ターン継続
      })

      stateChanges.push(`${clan.name}と${targetClan.name}が同盟を締結`)

      const narrative = `${gradePrefix}${targetClan.name}との同盟交渉に成功！10ターンの同盟が成立。`
      return createSuccessResult(ctx.newState, action, grade, narrative, stateChanges, narrative)
    } else {
      // 同盟失敗
      const narrative = `${targetClan.name}との同盟交渉は失敗に終わった。`
      return createSuccessResult(ctx.newState, action, 'failure', narrative, [], narrative)
    }
  }
}

/** 贈り物コマンド */
export class SendGiftCommand extends BaseCommand {
  readonly name = 'send_gift'

  constructor(
    private readonly targetClanId: string,
    private readonly goldAmount: number,
  ) {
    super()
  }

  protected getAction(): DiplomacyAction {
    return {
      category: '外交',
      type: 'send_gift',
      targetId: this.targetClanId,
      intent: '贈り物',
      riskTolerance: 0.2,
      conditions: { goldOffered: this.goldAmount },
    }
  }

  execute(state: GameState, clanId: string): CommandResult {
    const action = this.getAction()

    // バリデーション
    const clanError = this.validateClan(state, clanId)
    if (clanError) return clanError

    const targetClan = state.clanCatalog[this.targetClanId]
    if (!targetClan) {
      return createFailureResult(
        state,
        action,
        `対象勢力が見つかりません: ${this.targetClanId}`,
      )
    }

    const goldError = this.validateGold(state, clanId, this.goldAmount)
    if (goldError) return goldError

    const ctx = this.prepareContext(state, clanId)
    const newTargetClan = ctx.newState.clanCatalog[this.targetClanId]
    if (!newTargetClan) return this.internalError(state)

    const { grade, multiplier, narrative: gradePrefix } = this.rollGrade()

    // 贈り物を渡す
    ctx.clan.gold -= this.goldAmount
    const actualGift = Math.floor(this.goldAmount * multiplier)
    newTargetClan.gold += actualGift

    // 敵対関係があれば中立に変更
    const hostileRelation = ctx.newState.diplomacyRelations.find(
      (r) =>
        r.type === 'hostile' &&
        ((r.clan1Id === clanId && r.clan2Id === this.targetClanId) ||
          (r.clan1Id === this.targetClanId && r.clan2Id === clanId)),
    )
    if (hostileRelation && actualGift >= 500) {
      hostileRelation.type = 'neutral'
    }

    const stateChanges = [
      `${ctx.clan.name}の金: -${this.goldAmount}`,
      `${newTargetClan.name}が${actualGift}金を受領`,
    ]

    const narrative = `${gradePrefix}${targetClan.name}に${actualGift}金を贈り、友好を深めた。`
    return createSuccessResult(ctx.newState, action, grade, narrative, stateChanges, narrative)
  }
}

/** 威嚇コマンド */
export class ThreatenCommand extends BaseCommand {
  readonly name = 'threaten'

  constructor(private readonly targetClanId: string) {
    super()
  }

  protected getAction(): DiplomacyAction {
    return {
      category: '外交',
      type: 'threaten',
      targetId: this.targetClanId,
      intent: '威嚇',
      riskTolerance: 0.6,
    }
  }

  execute(state: GameState, clanId: string): CommandResult {
    const action = this.getAction()

    // バリデーション
    const clanError = this.validateClan(state, clanId)
    if (clanError) return clanError

    const clan = state.clanCatalog[clanId]
    if (!clan) return this.internalError(state)

    const targetClan = state.clanCatalog[this.targetClanId]
    if (!targetClan) {
      return createFailureResult(
        state,
        action,
        `対象勢力が見つかりません: ${this.targetClanId}`,
      )
    }

    const ctx = this.prepareContext(state, clanId)
    const { grade, multiplier, narrative: gradePrefix } = this.rollGrade()

    // 自軍と相手の総兵力を比較
    const mySoldiers = clan.castleIds.reduce((sum, id) => {
      const castle = state.castleCatalog[id]
      return sum + (castle?.soldiers ?? 0)
    }, 0)
    const theirSoldiers = targetClan.castleIds.reduce((sum, id) => {
      const castle = state.castleCatalog[id]
      return sum + (castle?.soldiers ?? 0)
    }, 0)

    const powerRatio = mySoldiers / Math.max(1, theirSoldiers)

    const stateChanges: string[] = []

    // 威嚇成功条件: 兵力比が1.5以上、またはクリティカル
    if (powerRatio * multiplier >= 1.5) {
      // 威嚇成功 - 停戦関係を結ぶ
      const existingRelation = ctx.newState.diplomacyRelations.find(
        (r) =>
          (r.clan1Id === clanId && r.clan2Id === this.targetClanId) ||
          (r.clan1Id === this.targetClanId && r.clan2Id === clanId),
      )
      if (existingRelation) {
        existingRelation.type = 'truce'
        existingRelation.expirationTurn = state.turn + 5
      } else {
        ctx.newState.diplomacyRelations.push({
          clan1Id: clanId,
          clan2Id: this.targetClanId,
          type: 'truce',
          expirationTurn: state.turn + 5,
        })
      }

      stateChanges.push(`${targetClan.name}が威嚇に屈した`)

      const narrative = `${gradePrefix}${targetClan.name}を威嚇し、5ターンの停戦を勝ち取った。`
      return createSuccessResult(ctx.newState, action, grade, narrative, stateChanges, narrative)
    } else {
      // 威嚇失敗 - 敵対関係に
      const existingRelation = ctx.newState.diplomacyRelations.find(
        (r) =>
          (r.clan1Id === clanId && r.clan2Id === this.targetClanId) ||
          (r.clan1Id === this.targetClanId && r.clan2Id === clanId),
      )
      if (existingRelation) {
        existingRelation.type = 'hostile'
        existingRelation.expirationTurn = null
      } else {
        ctx.newState.diplomacyRelations.push({
          clan1Id: clanId,
          clan2Id: this.targetClanId,
          type: 'hostile',
          expirationTurn: null,
        })
      }

      stateChanges.push(`${targetClan.name}との関係が悪化`)

      const narrative = `${targetClan.name}への威嚇は失敗し、敵対関係となった。`
      return createSuccessResult(ctx.newState, action, 'failure', narrative, stateChanges, narrative)
    }
  }
}
