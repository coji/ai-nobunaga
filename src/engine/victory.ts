// 勝利条件判定ロジック

import type { GameState } from '../types.js'

/** 勝利条件判定 */
export function checkVictory(state: GameState): {
  gameOver: boolean
  winner?: string
  reason?: string
} {
  const allClans = Object.values(state.clanCatalog)
  const castleCount = Object.keys(state.castleCatalog).length

  // 全ての城を支配したら勝利
  for (const clan of allClans) {
    if (clan.castleIds.length === castleCount) {
      return {
        gameOver: true,
        winner: clan.id,
        reason: `${clan.name}が天下統一を達成！`,
      }
    }
  }

  // 城を失った勢力を除去（純粋関数なのでコピーが必要だが、checkVictoryは読み取り専用として使う）
  // 注: 実際の除去処理はEndTurnCommandで行う
  const activeClans = allClans.filter((clan) => clan.castleIds.length > 0)

  // 残り1勢力なら勝利
  if (activeClans.length === 1) {
    const winner = activeClans[0]
    if (winner) {
      return {
        gameOver: true,
        winner: winner.id,
        reason: `${winner.name}が天下統一を達成！`,
      }
    }
  }

  return { gameOver: false }
}
