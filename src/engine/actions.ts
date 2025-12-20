// 行動実行ヘルパー関数
// 注: 状態変更ロジックは各コマンドに移行済み

import type { ResultGrade } from '../types.js'

/**
 * 大成功・大失敗を判定するダイスロール
 * 成功ベース: 15%大成功, 85%通常成功
 * 失敗ベース: 15%大失敗, 85%通常失敗
 */
export function rollForGrade(baseSuccess = true): ResultGrade {
  const roll = Math.random()
  if (baseSuccess) {
    return roll < 0.15 ? 'critical_success' : 'success'
  } else {
    return roll < 0.15 ? 'critical_failure' : 'failure'
  }
}

/**
 * 大成功時の効果倍率 (1.5〜2.0倍)
 */
export function getCriticalSuccessMultiplier(): number {
  return 1.5 + Math.random() * 0.5
}

/**
 * 大失敗時のペナルティ倍率 (0.5〜1.5倍の追加コスト等)
 */
export function getCriticalFailurePenalty(): number {
  return 0.5 + Math.random()
}

/**
 * グレードに応じた倍率を取得
 */
export function getGradeMultiplier(grade: ResultGrade): number {
  switch (grade) {
    case 'critical_success':
      return getCriticalSuccessMultiplier()
    case 'critical_failure':
      return 0.5
    case 'success':
      return 1.0
    case 'failure':
      return 0.0
  }
}

/**
 * グレードに応じたナラティブ接頭辞
 */
export function getGradeNarrative(grade: ResultGrade): string {
  switch (grade) {
    case 'critical_success':
      return '【大成功】'
    case 'critical_failure':
      return '【大失敗】'
    default:
      return ''
  }
}
