// 謀略コマンド

import type { GameState, IntrigueAction } from '../types.js'
import {
  createFailureResult,
  createSuccessResult,
  getGradeMultiplier,
  getGradeNarrative,
  rollForGrade,
  type CommandResult,
  type GameCommand,
} from './types.js'

/** 賄賂（調略）コマンド */
export class BribeCommand implements GameCommand {
  readonly name = 'bribe'

  constructor(
    private readonly targetBushoId: string,
    private readonly goldAmount: number,
  ) {}

  execute(state: GameState, clanId: string): CommandResult {
    const action: IntrigueAction = {
      category: '謀略',
      type: 'bribe',
      targetId: this.targetBushoId,
      intent: '調略',
      riskTolerance: 0.5,
    }

    const clan = state.clanCatalog[clanId]
    const targetBusho = state.bushoCatalog[this.targetBushoId]

    if (!clan) {
      return createFailureResult(state, action, `勢力が見つかりません: ${clanId}`)
    }
    if (!targetBusho) {
      return createFailureResult(state, action, `武将が見つかりません: ${this.targetBushoId}`)
    }
    if (targetBusho.clanId === clanId) {
      return createFailureResult(state, action, '自軍の武将は調略できません')
    }
    if (!targetBusho.clanId) {
      return createFailureResult(state, action, '浪人は調略できません')
    }
    if (clan.gold < this.goldAmount) {
      return createFailureResult(state, action, '資金が不足しています')
    }

    // 当主は調略不可
    const targetClan = state.clanCatalog[targetBusho.clanId]
    if (targetClan && targetClan.leaderId === this.targetBushoId) {
      return createFailureResult(state, action, '当主は調略できません')
    }

    const newState = structuredClone(state)
    const newClan = newState.clanCatalog[clanId]
    const newBusho = newState.bushoCatalog[this.targetBushoId]
    if (!newClan || !newBusho) {
      return createFailureResult(state, action, '内部エラー')
    }

    // 金を消費
    newClan.gold -= this.goldAmount

    const grade = rollForGrade()
    const multiplier = getGradeMultiplier(grade)

    // 調略成功率の計算
    // 基本成功率: 金額 / 1000 * (100 - 忠誠度) / 100
    const baseLoyaltyFactor = (100 - targetBusho.emotions.loyalty) / 100
    const goldFactor = Math.min(1, this.goldAmount / 1000)
    const successRate = Math.min(0.9, baseLoyaltyFactor * goldFactor * multiplier)

    const stateChanges = [`${newClan.name}の金: -${this.goldAmount}`]

    if (Math.random() < successRate) {
      // 調略成功
      const oldClanId = newBusho.clanId
      const oldClan = oldClanId ? newState.clanCatalog[oldClanId] : null

      // 城主だった場合、城ごと寝返る
      const castle = Object.values(newState.castleCatalog).find(
        (c) => c.castellanId === this.targetBushoId,
      )

      if (castle) {
        // 城ごと寝返り
        if (oldClan) {
          oldClan.castleIds = oldClan.castleIds.filter((id) => id !== castle.id)
        }
        newClan.castleIds.push(castle.id)
        castle.ownerId = clanId
        stateChanges.push(`${castle.name}ごと寝返り！`)

        // 怨恨を追加
        if (oldClanId) {
          newState.grudgeHistory.push({
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

      const narrative = `${getGradeNarrative(grade)}${this.goldAmount}金で${targetBusho.name}の調略に成功！${castle ? `${castle.name}ごと寝返った。` : '配下に加わった。'}`
      return createSuccessResult(newState, action, grade, narrative, stateChanges, narrative)
    } else {
      // 調略失敗 - 忠誠度が上がる（バレた反動）
      newBusho.emotions.loyalty = Math.min(100, newBusho.emotions.loyalty + 10)

      stateChanges.push(`${targetBusho.name}の調略に失敗`)

      const narrative = `${getGradeNarrative(grade)}${targetBusho.name}への調略は失敗。${this.goldAmount}金を失った。`
      return createSuccessResult(newState, action, 'failure', narrative, stateChanges, narrative)
    }
  }
}

/** 暗殺コマンド */
export class AssassinateCommand implements GameCommand {
  readonly name = 'assassinate'

  constructor(private readonly targetBushoId: string) {}

  execute(state: GameState, clanId: string): CommandResult {
    const action: IntrigueAction = {
      category: '謀略',
      type: 'assassinate',
      targetId: this.targetBushoId,
      intent: '暗殺',
      riskTolerance: 0.8,
    }

    const clan = state.clanCatalog[clanId]
    const targetBusho = state.bushoCatalog[this.targetBushoId]

    if (!clan) {
      return createFailureResult(state, action, `勢力が見つかりません: ${clanId}`)
    }
    if (!targetBusho) {
      return createFailureResult(state, action, `武将が見つかりません: ${this.targetBushoId}`)
    }
    if (targetBusho.clanId === clanId) {
      return createFailureResult(state, action, '自軍の武将は暗殺できません')
    }

    // 暗殺コスト: 500金
    const cost = 500
    if (clan.gold < cost) {
      return createFailureResult(state, action, '資金が不足しています（500金必要）')
    }

    const newState = structuredClone(state)
    const newClan = newState.clanCatalog[clanId]
    if (!newClan) {
      return createFailureResult(state, action, '内部エラー')
    }

    newClan.gold -= cost

    const grade = rollForGrade()
    const multiplier = getGradeMultiplier(grade)

    // 暗殺成功率（基本20%、知略で補正）
    const baseRate = 0.2
    const successRate = Math.min(0.5, baseRate * multiplier)

    const stateChanges = [`${newClan.name}の金: -${cost}`]

    if (Math.random() < successRate) {
      // 暗殺成功
      const targetClanId = targetBusho.clanId
      const targetClan = targetClanId ? newState.clanCatalog[targetClanId] : null

      // 当主だった場合の処理
      if (targetClan && targetClan.leaderId === this.targetBushoId) {
        // 他の武将を当主にする、またはいなければ滅亡
        const otherBushos = Object.values(newState.bushoCatalog).filter(
          (b) => b.clanId === targetClanId && b.id !== this.targetBushoId,
        )
        const newLeader = otherBushos[0]
        if (newLeader) {
          targetClan.leaderId = newLeader.id
          stateChanges.push(`${newLeader.name}が${targetClan.name}の新当主に`)
        }
      }

      // 城主だった場合、城主を空席に
      const castle = Object.values(newState.castleCatalog).find(
        (c) => c.castellanId === this.targetBushoId,
      )
      if (castle) {
        castle.castellanId = null
        stateChanges.push(`${castle.name}の城主が空席に`)
      }

      // 武将を削除
      delete newState.bushoCatalog[this.targetBushoId]

      // 怨恨を追加
      if (targetClanId) {
        newState.grudgeHistory.push({
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

      const narrative = `${getGradeNarrative(grade)}${targetBusho.name}の暗殺に成功！`
      return createSuccessResult(newState, action, grade, narrative, stateChanges, narrative)
    } else {
      // 暗殺失敗
      const targetClanId = targetBusho.clanId
      if (targetClanId) {
        // 敵対関係に
        const existingRelation = newState.diplomacyRelations.find(
          (r) =>
            (r.clan1Id === clanId && r.clan2Id === targetClanId) ||
            (r.clan1Id === targetClanId && r.clan2Id === clanId),
        )
        if (existingRelation) {
          existingRelation.type = 'hostile'
        } else {
          newState.diplomacyRelations.push({
            clan1Id: clanId,
            clan2Id: targetClanId,
            type: 'hostile',
            expirationTurn: null,
          })
        }
        stateChanges.push('暗殺失敗、敵対関係に')
      }

      const narrative = `${getGradeNarrative(grade)}${targetBusho.name}の暗殺に失敗。500金を失い、敵対関係となった。`
      return createSuccessResult(newState, action, 'failure', narrative, stateChanges, narrative)
    }
  }
}
