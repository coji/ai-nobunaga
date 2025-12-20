// ターン終了コマンド

import { processTurnEnd } from '../engine/turn.js'
import { playLogger } from '../services/playlog.js'
import type { Castle, GameState } from '../types.js'
import type { CommandResult, GameCommand } from './types.js'

/** ターン終了コマンド */
export class EndTurnCommand implements GameCommand {
  readonly name = 'end_turn'

  execute(state: GameState, _clanId: string): CommandResult {
    const newState = structuredClone(state)
    const changes = processTurnEnd(newState)

    // ターン終了時にサマリーを記録
    playLogger.logTurnEnd(newState)
    // 自動保存
    playLogger.saveIntermediate()

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
