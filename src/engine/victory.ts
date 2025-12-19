// 勝利条件判定ロジック

import type { GameState } from '../types.js'

/** 勝利条件判定 */
export function checkVictory(state: GameState): {
  gameOver: boolean
  winner?: string
  reason?: string
} {
  // 全ての城を支配したら勝利
  for (const clan of state.clanCatalog.values()) {
    if (clan.castleIds.length === state.castleCatalog.size) {
      return {
        gameOver: true,
        winner: clan.id,
        reason: `${clan.name}が天下統一を達成！`,
      }
    }
  }

  // 城を失った勢力を除去
  for (const clan of state.clanCatalog.values()) {
    if (clan.castleIds.length === 0) {
      state.clanCatalog.delete(clan.id)
    }
  }

  // 残り1勢力なら勝利
  if (state.clanCatalog.size === 1) {
    const clans = [...state.clanCatalog.values()]
    const winner = clans[0]
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
