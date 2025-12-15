// プロンプト生成

import type { Busho, GameState } from "../types.js";

export function buildGameContextPrompt(
  state: GameState,
  clanId: string
): string {
  const clan = state.clanCatalog.get(clanId)!;
  const leader = state.bushoCatalog.get(clan.leaderId)!;

  const ownCastles = clan.castleIds
    .map((id) => {
      const c = state.castleCatalog.get(id)!;
      return `  - ${c.name}(ID:${c.id}): 兵${c.soldiers}, 防御${c.defense}, 農業${c.agriculture}, 商業${c.commerce}`;
    })
    .join("\n");

  const ownBusho = [...state.bushoCatalog.values()]
    .filter((b) => b.clanId === clanId)
    .map((b) => `  - ${b.name}(ID:${b.id}): 忠誠${b.emotions.loyalty}`)
    .join("\n");

  const otherClans = [...state.clanCatalog.values()]
    .filter((c) => c.id !== clanId)
    .map((c) => {
      const l = state.bushoCatalog.get(c.leaderId);
      const castles = c.castleIds
        .map((id) => {
          const castle = state.castleCatalog.get(id)!;
          return `${castle.name}(ID:${id}, 兵${castle.soldiers})`;
        })
        .join(", ");
      const relation = state.diplomacyRelations.find(
        (r) =>
          (r.clan1Id === clanId && r.clan2Id === c.id) ||
          (r.clan1Id === c.id && r.clan2Id === clanId)
      );
      return `  - ${c.name}(ID:${c.id}): 当主${l?.name}, 関係=${relation?.type || "neutral"}, 城=[${castles}]`;
    })
    .join("\n");

  const adjacentEnemies: string[] = [];
  for (const castleId of clan.castleIds) {
    const castle = state.castleCatalog.get(castleId)!;
    for (const adjId of castle.adjacentCastleIds) {
      const adj = state.castleCatalog.get(adjId)!;
      if (adj.ownerId !== clanId) {
        adjacentEnemies.push(
          `  ${castle.name}(${castleId}) → ${adj.name}(${adjId}): ${state.clanCatalog.get(adj.ownerId)?.name}, 兵${adj.soldiers}`
        );
      }
    }
  }

  const enemyBusho = [...state.bushoCatalog.values()]
    .filter((b) => b.clanId && b.clanId !== clanId)
    .map(
      (b) =>
        `  - ${b.name}(ID:${b.id}, ${state.clanCatalog.get(b.clanId!)?.name}): 忠誠${b.emotions.loyalty}`
    )
    .join("\n");

  return `
# ターン${state.turn} - ${clan.name}（${leader.name}）

## 資源
金: ${clan.gold}, 兵糧: ${clan.food}

## 自軍の城
${ownCastles}

## 自軍の武将
${ownBusho}

## 他勢力
${otherClans}

## 攻撃可能な敵城（隣接）
${adjacentEnemies.length > 0 ? adjacentEnemies.join("\n") : "  なし"}

## 敵武将（謀略対象）
${enemyBusho || "  なし"}
`.trim();
}

export function getPersonalityDescription(leader: Busho): string {
  return `あなたは${leader.name}。性格: ${leader.personality.join(", ")}。この性格に基づいて行動せよ。`;
}

export function buildAITurnSystemPrompt(leader: Busho): string {
  return `あなたは戦国シミュレーションゲームのAI大名です。
${getPersonalityDescription(leader)}

与えられたツールを使ってこのターンの行動を決定してください。
1ターンに最大3つの行動ができます。行動が終わったら必ずend_turnを呼んでください。

重要:
- 攻撃は隣接する城にのみ可能
- 資金・兵糧の残量を確認すること
- IDは正確に指定すること`;
}

export function buildPlayerCommandSystemPrompt(leaderName: string): string {
  return `あなたは戦国シミュレーションゲームの軍師です。
プレイヤー（${leaderName}）の指示を解釈し、適切なツールを1つ呼び出してください。

重要:
- 攻撃は隣接する城にのみ可能
- IDは正確に指定すること
- 不明な点があれば確認してから実行

指示が曖昧な場合は、最も妥当な解釈で実行してください。`;
}
