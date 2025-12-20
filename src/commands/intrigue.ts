// 謀略コマンド

import type { GameState, IntrigueAction } from '../types.js'
import { BaseCommand } from './base.js'
import {
  createFailureResult,
  createSuccessResult,
  type CommandResult,
} from './types.js'

/** 賄賂（調略）コマンド */
export class BribeCommand extends BaseCommand {
  readonly name = 'bribe'

  constructor(
    private readonly targetBushoId: string,
    private readonly goldAmount: number,
  ) {
    super()
  }

  protected getAction(): IntrigueAction {
    return {
      category: '謀略',
      type: 'bribe',
      targetId: this.targetBushoId,
      intent: '調略',
      riskTolerance: 0.5,
    }
  }

  execute(state: GameState, clanId: string): CommandResult {
    const action = this.getAction()

    // バリデーション
    const clanError = this.validateClan(state, clanId)
    if (clanError) return clanError

    const clan = state.clanCatalog[clanId]
    if (!clan) return this.internalError(state)

    const targetBusho = state.bushoCatalog[this.targetBushoId]
    if (!targetBusho) {
      return createFailureResult(
        state,
        action,
        `武将が見つかりません: ${this.targetBushoId}`,
      )
    }
    if (targetBusho.clanId === clanId) {
      return createFailureResult(state, action, '自軍の武将は調略できません')
    }
    if (!targetBusho.clanId) {
      return createFailureResult(state, action, '浪人は調略できません')
    }

    const goldError = this.validateGold(state, clanId, this.goldAmount)
    if (goldError) return goldError

    // 当主は調略不可
    const targetClan = state.clanCatalog[targetBusho.clanId]
    if (targetClan && targetClan.leaderId === this.targetBushoId) {
      return createFailureResult(state, action, '当主は調略できません')
    }

    const ctx = this.prepareContext(state, clanId)
    const newBusho = ctx.newState.bushoCatalog[this.targetBushoId]
    if (!newBusho) return this.internalError(state)

    // 金を消費
    ctx.clan.gold -= this.goldAmount

    const { grade, multiplier, narrative: gradePrefix } = this.rollGrade()

    // 調略成功率の計算
    // 基本成功率: 金額 / 1000 * (100 - 忠誠度) / 100
    const baseLoyaltyFactor = (100 - targetBusho.emotions.loyalty) / 100
    const goldFactor = Math.min(1, this.goldAmount / 1000)
    const successRate = Math.min(0.9, baseLoyaltyFactor * goldFactor * multiplier)

    const stateChanges = [`${ctx.clan.name}の金: -${this.goldAmount}`]

    if (Math.random() < successRate) {
      // 調略成功
      const oldClanId = newBusho.clanId
      const oldClan = oldClanId ? ctx.newState.clanCatalog[oldClanId] : null

      // 城主だった場合、城ごと寝返る
      const castle = Object.values(ctx.newState.castleCatalog).find(
        (c) => c.castellanId === this.targetBushoId,
      )

      if (castle) {
        // 城ごと寝返り
        if (oldClan) {
          oldClan.castleIds = oldClan.castleIds.filter((id) => id !== castle.id)
        }
        ctx.clan.castleIds.push(castle.id)
        castle.ownerId = clanId
        stateChanges.push(`${castle.name}ごと寝返り！`)

        // 怨恨を追加
        if (oldClanId) {
          ctx.newState.grudgeHistory.push({
            id: `grudge_${Date.now()}`,
            turn: state.turn,
            actorId: clanId,
            targetId: oldClanId,
            type: 'betrayal',
            description: `${clan.name}が${targetBusho.name}を調略し${castle.name}を奪取`,
            emotionImpact: { loyalty: -20, discontent: 30 },
          })
        }
      }

      // 武将の所属を変更
      newBusho.clanId = clanId
      newBusho.factionId = null
      newBusho.emotions.loyalty = 50 // 寝返り直後は忠誠度中程度
      newBusho.emotions.discontent = 0

      stateChanges.push(`${targetBusho.name}が${clan.name}に寝返り`)

      const narrative = `${gradePrefix}${this.goldAmount}金で${targetBusho.name}の調略に成功！${castle ? `${castle.name}ごと寝返った。` : '配下に加わった。'}`
      return createSuccessResult(ctx.newState, action, grade, narrative, stateChanges, narrative)
    } else {
      // 調略失敗 - 忠誠度が上がる（バレた反動）
      newBusho.emotions.loyalty = Math.min(100, newBusho.emotions.loyalty + 10)

      stateChanges.push(`${targetBusho.name}の調略に失敗`)

      const narrative = `${gradePrefix}${targetBusho.name}への調略は失敗。${this.goldAmount}金を失った。`
      return createSuccessResult(ctx.newState, action, 'failure', narrative, stateChanges, narrative)
    }
  }
}

/** 暗殺コマンド */
export class AssassinateCommand extends BaseCommand {
  readonly name = 'assassinate'

  /** 暗殺コスト */
  private static readonly COST = 500

  constructor(private readonly targetBushoId: string) {
    super()
  }

  protected getAction(): IntrigueAction {
    return {
      category: '謀略',
      type: 'assassinate',
      targetId: this.targetBushoId,
      intent: '暗殺',
      riskTolerance: 0.8,
    }
  }

  execute(state: GameState, clanId: string): CommandResult {
    const action = this.getAction()
    const cost = AssassinateCommand.COST

    // バリデーション
    const clanError = this.validateClan(state, clanId)
    if (clanError) return clanError

    const clan = state.clanCatalog[clanId]
    if (!clan) return this.internalError(state)

    const targetBusho = state.bushoCatalog[this.targetBushoId]
    if (!targetBusho) {
      return createFailureResult(
        state,
        action,
        `武将が見つかりません: ${this.targetBushoId}`,
      )
    }
    if (targetBusho.clanId === clanId) {
      return createFailureResult(state, action, '自軍の武将は暗殺できません')
    }

    const goldError = this.validateGold(state, clanId, cost)
    if (goldError) {
      return createFailureResult(state, action, `資金が不足しています（${cost}金必要）`)
    }

    const ctx = this.prepareContext(state, clanId)
    ctx.clan.gold -= cost

    const { grade, multiplier, narrative: gradePrefix } = this.rollGrade()

    // 暗殺成功率（基本20%、知略で補正）
    const baseRate = 0.2
    const successRate = Math.min(0.5, baseRate * multiplier)

    const stateChanges = [`${ctx.clan.name}の金: -${cost}`]

    if (Math.random() < successRate) {
      // 暗殺成功
      const targetClanId = targetBusho.clanId
      const targetClan = targetClanId ? ctx.newState.clanCatalog[targetClanId] : null

      // 当主だった場合の処理
      if (targetClan && targetClan.leaderId === this.targetBushoId) {
        // 他の武将を当主にする、またはいなければ滅亡
        const otherBushos = Object.values(ctx.newState.bushoCatalog).filter(
          (b) => b.clanId === targetClanId && b.id !== this.targetBushoId,
        )
        const newLeader = otherBushos[0]
        if (newLeader) {
          targetClan.leaderId = newLeader.id
          stateChanges.push(`${newLeader.name}が${targetClan.name}の新当主に`)
        }
      }

      // 城主だった場合、城主を空席に
      const castle = Object.values(ctx.newState.castleCatalog).find(
        (c) => c.castellanId === this.targetBushoId,
      )
      if (castle) {
        castle.castellanId = null
        stateChanges.push(`${castle.name}の城主が空席に`)
      }

      // 武将を削除
      delete ctx.newState.bushoCatalog[this.targetBushoId]

      // 怨恨を追加
      if (targetClanId) {
        ctx.newState.grudgeHistory.push({
          id: `grudge_${Date.now()}`,
          turn: state.turn,
          actorId: clanId,
          targetId: targetClanId,
          type: 'family_killed',
          description: `${clan.name}が${targetBusho.name}を暗殺`,
          emotionImpact: { loyalty: -30, discontent: 50 },
        })
      }

      stateChanges.push(`${targetBusho.name}を暗殺`)

      const narrative = `${gradePrefix}${targetBusho.name}の暗殺に成功！`
      return createSuccessResult(ctx.newState, action, grade, narrative, stateChanges, narrative)
    } else {
      // 暗殺失敗
      const targetClanId = targetBusho.clanId
      if (targetClanId) {
        // 敵対関係に
        const existingRelation = ctx.newState.diplomacyRelations.find(
          (r) =>
            (r.clan1Id === clanId && r.clan2Id === targetClanId) ||
            (r.clan1Id === targetClanId && r.clan2Id === clanId),
        )
        if (existingRelation) {
          existingRelation.type = 'hostile'
        } else {
          ctx.newState.diplomacyRelations.push({
            clan1Id: clanId,
            clan2Id: targetClanId,
            type: 'hostile',
            expirationTurn: null,
          })
        }
        stateChanges.push('暗殺失敗、敵対関係に')
      }

      const narrative = `${gradePrefix}${targetBusho.name}の暗殺に失敗。${cost}金を失い、敵対関係となった。`
      return createSuccessResult(ctx.newState, action, 'failure', narrative, stateChanges, narrative)
    }
  }
}
