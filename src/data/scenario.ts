// シナリオデータ統合エントリポイント
// 桶狭間前夜（1560年）シナリオ

import type { GameState } from '../types.js'

// 各データをインポート
import { bushoList } from './busho.js'
import { castleList } from './castles.js'
import { clanList, getAvailableClans } from './clans.js'
import { diplomacyRelations, factionList } from './diplomacy.js'

// getAvailableClans を再エクスポート
export { getAvailableClans }

// 初期ゲーム状態を生成
export function createInitialGameState(playerClanId: string): GameState {
  // Record オブジェクトを構築
  const bushoCatalog = Object.fromEntries(
    bushoList.map((b) => [b.id, { ...b }]),
  )

  const clanCatalog = Object.fromEntries(
    clanList.map((c) => [c.id, { ...c }]),
  )

  const castleCatalog = Object.fromEntries(
    castleList.map((c) => [c.id, { ...c }]),
  )

  const factionCatalog = Object.fromEntries(
    factionList.map((f) => [f.id, { ...f }]),
  )

  return {
    turn: 1,
    bushoCatalog,
    clanCatalog,
    castleCatalog,
    factionCatalog,
    diplomacyRelations: [...diplomacyRelations],
    grudgeHistory: [],
    letters: [],
    playerClanId,
  }
}
