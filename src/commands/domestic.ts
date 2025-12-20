// 内政コマンド

import type { DomesticAction, GameState } from '../types.js'
import { CastleCommand } from './base.js'
import { createSuccessResult, type CommandResult } from './types.js'

/** 農業開発コマンド */
export class DevelopAgricultureCommand extends CastleCommand {
  readonly name = 'develop_agriculture'

  protected getAction(): DomesticAction {
    return {
      category: '内政',
      type: 'develop_agriculture',
      targetId: this.castleId,
      intent: '農業開発',
      riskTolerance: 0.3,
      value: this.investment,
    }
  }

  execute(state: GameState, clanId: string): CommandResult {
    // 共通の事前バリデーション
    const error = this.validatePreConditions(state, clanId)
    if (error) return error

    // 状態のコピーとコンテキスト準備
    const ctx = this.prepareCastleContext(state, clanId, this.castleId)

    // グレード判定
    const { grade, multiplier, narrative: gradePrefix } = this.rollGrade()

    // 農業力上昇（投資額 / 50 * 倍率）
    const growth = Math.floor((this.investment / 50) * multiplier)
    const oldValue = ctx.castle.agriculture
    ctx.castle.agriculture = Math.min(100, ctx.castle.agriculture + growth)
    ctx.clan.gold -= this.investment

    const stateChanges = [
      `${ctx.castle.name}の農業力: ${oldValue} → ${ctx.castle.agriculture}`,
      `${ctx.clan.name}の金: -${this.investment}`,
    ]

    const narrative = `${gradePrefix}${ctx.castle.name}の農業開発に${this.investment}金を投資。農業力+${growth}`

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

/** 商業開発コマンド */
export class DevelopCommerceCommand extends CastleCommand {
  readonly name = 'develop_commerce'

  protected getAction(): DomesticAction {
    return {
      category: '内政',
      type: 'develop_commerce',
      targetId: this.castleId,
      intent: '商業開発',
      riskTolerance: 0.3,
      value: this.investment,
    }
  }

  execute(state: GameState, clanId: string): CommandResult {
    const error = this.validatePreConditions(state, clanId)
    if (error) return error

    const ctx = this.prepareCastleContext(state, clanId, this.castleId)
    const { grade, multiplier, narrative: gradePrefix } = this.rollGrade()

    const growth = Math.floor((this.investment / 50) * multiplier)
    const oldValue = ctx.castle.commerce
    ctx.castle.commerce = Math.min(100, ctx.castle.commerce + growth)
    ctx.clan.gold -= this.investment

    const stateChanges = [
      `${ctx.castle.name}の商業力: ${oldValue} → ${ctx.castle.commerce}`,
      `${ctx.clan.name}の金: -${this.investment}`,
    ]

    const narrative = `${gradePrefix}${ctx.castle.name}の商業開発に${this.investment}金を投資。商業力+${growth}`

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
