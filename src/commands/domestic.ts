// 内政コマンド

import type { DomesticAction, GameState } from '../types.js'
import {
  createFailureResult,
  createSuccessResult,
  getGradeMultiplier,
  getGradeNarrative,
  rollForGrade,
  type CommandResult,
  type GameCommand,
} from './types.js'

/** 農業開発コマンド */
export class DevelopAgricultureCommand implements GameCommand {
  readonly name = 'develop_agriculture'

  constructor(
    private readonly castleId: string,
    private readonly investment: number,
  ) {}

  execute(state: GameState, clanId: string): CommandResult {
    const action: DomesticAction = {
      category: '内政',
      type: 'develop_agriculture',
      targetId: this.castleId,
      intent: '農業開発',
      riskTolerance: 0.3,
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
      return createFailureResult(state, action, '他勢力の城は開発できません')
    }
    if (clan.gold < this.investment) {
      return createFailureResult(state, action, '資金が不足しています')
    }

    // 状態のディープコピー
    const newState = structuredClone(state)
    const newClan = newState.clanCatalog[clanId]
    const newCastle = newState.castleCatalog[this.castleId]
    if (!newClan || !newCastle) {
      return createFailureResult(state, action, '内部エラー')
    }

    // グレード判定
    const grade = rollForGrade()
    const multiplier = getGradeMultiplier(grade)

    // 農業力上昇（投資額 / 50 * 倍率）
    const growth = Math.floor((this.investment / 50) * multiplier)
    const oldValue = newCastle.agriculture
    newCastle.agriculture = Math.min(100, newCastle.agriculture + growth)
    newClan.gold -= this.investment

    const stateChanges = [
      `${newCastle.name}の農業力: ${oldValue} → ${newCastle.agriculture}`,
      `${newClan.name}の金: -${this.investment}`,
    ]

    const narrative = `${getGradeNarrative(grade)}${newCastle.name}の農業開発に${this.investment}金を投資。農業力+${growth}`

    return createSuccessResult(newState, action, grade, narrative, stateChanges, narrative)
  }
}

/** 商業開発コマンド */
export class DevelopCommerceCommand implements GameCommand {
  readonly name = 'develop_commerce'

  constructor(
    private readonly castleId: string,
    private readonly investment: number,
  ) {}

  execute(state: GameState, clanId: string): CommandResult {
    const action: DomesticAction = {
      category: '内政',
      type: 'develop_commerce',
      targetId: this.castleId,
      intent: '商業開発',
      riskTolerance: 0.3,
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
      return createFailureResult(state, action, '他勢力の城は開発できません')
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

    const growth = Math.floor((this.investment / 50) * multiplier)
    const oldValue = newCastle.commerce
    newCastle.commerce = Math.min(100, newCastle.commerce + growth)
    newClan.gold -= this.investment

    const stateChanges = [
      `${newCastle.name}の商業力: ${oldValue} → ${newCastle.commerce}`,
      `${newClan.name}の金: -${this.investment}`,
    ]

    const narrative = `${getGradeNarrative(grade)}${newCastle.name}の商業開発に${this.investment}金を投資。商業力+${growth}`

    return createSuccessResult(newState, action, grade, narrative, stateChanges, narrative)
  }
}
