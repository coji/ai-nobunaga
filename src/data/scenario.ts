// シナリオデータ統合エントリポイント
// 桶狭間前夜（1560年）シナリオ

import type { Busho, Castle, Clan, Faction, GameState } from "../types.js";

// 各データをインポート
import { bushoList } from "./busho.js";
import { castleList } from "./castles.js";
import { clanList, getAvailableClans } from "./clans.js";
import { factionList, diplomacyRelations } from "./diplomacy.js";

// getAvailableClans を再エクスポート
export { getAvailableClans };

// 初期ゲーム状態を生成
export function createInitialGameState(playerClanId: string): GameState {
  const bushoCatalog = new Map<string, Busho>();
  bushoList.forEach((b) => bushoCatalog.set(b.id, { ...b }));

  const clanCatalog = new Map<string, Clan>();
  clanList.forEach((c) => clanCatalog.set(c.id, { ...c }));

  const castleCatalog = new Map<string, Castle>();
  castleList.forEach((c) => castleCatalog.set(c.id, { ...c }));

  const factionCatalog = new Map<string, Faction>();
  factionList.forEach((f) => factionCatalog.set(f.id, { ...f }));

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
  };
}
