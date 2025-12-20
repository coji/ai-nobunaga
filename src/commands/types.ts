// コマンドパターンの型定義

import type {
  ActionResult,
  GameAction,
  GameState,
  ResultGrade,
} from '../types.js'

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

/** コマンド実行のヘルパー関数群 */

// 結果グレードをロール
export function rollForGrade(): ResultGrade {
  const roll = Math.random()
  if (roll < 0.05) return 'critical_failure'
  if (roll < 0.15) return 'failure'
  if (roll < 0.85) return 'success'
  return 'critical_success'
}

// グレードに応じた倍率を取得
export function getGradeMultiplier(grade: ResultGrade): number {
  switch (grade) {
    case 'critical_failure':
      return 0
    case 'failure':
      return 0.5
    case 'success':
      return 1.0
    case 'critical_success':
      return 1.5
  }
}

// グレードに応じたナラティブプレフィックス
export function getGradeNarrative(grade: ResultGrade): string {
  switch (grade) {
    case 'critical_failure':
      return '【大失敗】'
    case 'failure':
      return '【失敗】'
    case 'success':
      return ''
    case 'critical_success':
      return '【大成功】'
  }
}

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
