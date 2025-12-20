// コマンドパターンの型定義

import type { ActionResult, GameAction, GameState, ResultGrade } from '../types.js'

// engine/actions.ts のヘルパー関数を re-export
export {
  rollForGrade,
  getGradeMultiplier,
  getGradeNarrative,
  getCriticalSuccessMultiplier,
  getCriticalFailurePenalty,
} from '../engine/actions.js'

/** コマンドの実行結果 */
export interface CommandResult {
  newState: GameState
  result: ActionResult
  narrative: string
}

/** ゲームコマンドの基底インターフェース */
export interface GameCommand {
  /** コマンド名（ログ・デバッグ用） */
  readonly name: string

  /** コマンドを実行し、新しい状態を返す（純粋関数） */
  execute(state: GameState, clanId: string): CommandResult
}

/** Undo対応コマンド（将来の拡張用） */
export interface UndoableCommand extends GameCommand {
  undo(state: GameState): GameState
}

/** コマンド結果のヘルパー関数群 */

// 失敗結果を生成
export function createFailureResult(
  state: GameState,
  action: GameAction,
  message: string,
): CommandResult {
  return {
    newState: state,
    result: {
      success: false,
      grade: 'failure',
      action,
      message,
      stateChanges: [],
    },
    narrative: message,
  }
}

// 成功結果を生成
export function createSuccessResult(
  newState: GameState,
  action: GameAction,
  grade: ResultGrade,
  message: string,
  stateChanges: string[],
  narrative: string,
): CommandResult {
  return {
    newState,
    result: {
      success: grade !== 'critical_failure' && grade !== 'failure',
      grade,
      action,
      message,
      stateChanges,
    },
    narrative,
  }
}
