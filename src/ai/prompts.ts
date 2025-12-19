// プロンプト生成

import type { Busho, GameState } from '../types.js'

export function buildGameContextPrompt(
  state: GameState,
  clanId: string,
): string {
  const clan = state.clanCatalog.get(clanId)
  if (!clan) {
    throw new Error(`Clan not found: ${clanId}`)
  }
  const leader = state.bushoCatalog.get(clan.leaderId)
  if (!leader) {
    throw new Error(`Leader not found: ${clan.leaderId}`)
  }

  // 自国の城情報と総兵力計算
  let totalSoldiers = 0
  let totalAgriculture = 0
  let totalCommerce = 0
  const ownCastles = clan.castleIds
    .map((id) => {
      const c = state.castleCatalog.get(id)
      if (!c) return null
      totalSoldiers += c.soldiers
      totalAgriculture += c.agriculture
      totalCommerce += c.commerce
      return `  - ${c.name}(ID:${c.id}): 兵${c.soldiers}, 防御${c.defense}, 農業${c.agriculture}, 商業${c.commerce}`
    })
    .filter(Boolean)
    .join('\n')

  const ownBusho = [...state.bushoCatalog.values()]
    .filter((b) => b.clanId === clanId)
    .map((b) => `  - ${b.name}(ID:${b.id}): 忠誠${b.emotions.loyalty}`)
    .join('\n')

  // 隣接勢力を特定（自国の城と隣接する敵城の所有者）
  const adjacentClanIds = new Set<string>()
  for (const castleId of clan.castleIds) {
    const castle = state.castleCatalog.get(castleId)
    if (!castle) continue
    for (const adjId of castle.adjacentCastleIds) {
      const adj = state.castleCatalog.get(adjId)
      if (adj && adj.ownerId !== clanId) {
        adjacentClanIds.add(adj.ownerId)
      }
    }
  }

  // 同盟国を特定
  const alliedClanIds = new Set<string>()
  for (const rel of state.diplomacyRelations) {
    if (rel.type === 'alliance') {
      if (rel.clan1Id === clanId) alliedClanIds.add(rel.clan2Id)
      if (rel.clan2Id === clanId) alliedClanIds.add(rel.clan1Id)
    }
  }

  const otherClans = [...state.clanCatalog.values()]
    .filter((c) => c.id !== clanId)
    .map((c) => {
      const l = state.bushoCatalog.get(c.leaderId)
      // 勢力の総兵力を計算
      let clanSoldiers = 0
      const castles = c.castleIds
        .map((id) => {
          const castle = state.castleCatalog.get(id)
          if (!castle) return null
          clanSoldiers += castle.soldiers
          return `${castle.name}(ID:${id}, 兵${castle.soldiers})`
        })
        .filter(Boolean)
        .join(', ')
      const relation = state.diplomacyRelations.find(
        (r) =>
          (r.clan1Id === clanId && r.clan2Id === c.id) ||
          (r.clan1Id === c.id && r.clan2Id === clanId),
      )
      const relationType = relation?.type || 'neutral'
      const isAdjacent = adjacentClanIds.has(c.id)
      const tags: string[] = []
      if (isAdjacent) tags.push('隣接')
      if (relationType === 'alliance') tags.push('同盟中')
      if (relationType === 'hostile') tags.push('敵対中')
      const tagStr = tags.length > 0 ? `【${tags.join('・')}】` : ''
      return `  - ${c.name}(ID:${c.id})${tagStr}: 当主${l?.name}, 総兵力${clanSoldiers}, 城=[${castles}]`
    })
    .join('\n')

  const adjacentEnemies: string[] = []
  for (const castleId of clan.castleIds) {
    const castle = state.castleCatalog.get(castleId)
    if (!castle) continue
    for (const adjId of castle.adjacentCastleIds) {
      const adj = state.castleCatalog.get(adjId)
      if (!adj) continue
      if (adj.ownerId !== clanId) {
        adjacentEnemies.push(
          `  ${castle.name}(${castleId}) → ${adj.name}(${adjId}): ${state.clanCatalog.get(adj.ownerId)?.name}, 兵${adj.soldiers}`,
        )
      }
    }
  }

  const enemyBusho = [...state.bushoCatalog.values()]
    .filter((b) => b.clanId && b.clanId !== clanId)
    .map((b) => {
      const clanName = b.clanId ? state.clanCatalog.get(b.clanId)?.name : '浪人'
      return `  - ${b.name}(ID:${b.id}, ${clanName}): 忠誠${b.emotions.loyalty}`
    })
    .join('\n')

  // 同盟国リスト
  const alliedNames = [...alliedClanIds]
    .map((id) => state.clanCatalog.get(id)?.name)
    .filter(Boolean)
    .join(', ')

  return `
# ターン${state.turn} - ${clan.name}（${leader.name}）

## 自国の状況
金: ${clan.gold}, 兵糧: ${clan.food}
総兵力: ${totalSoldiers}, 城数: ${clan.castleIds.length}
経済力: 農業${totalAgriculture}, 商業${totalCommerce}
同盟国: ${alliedNames || 'なし'}

## 自軍の城
${ownCastles}

## 自軍の武将
${ownBusho}

## 他勢力
${otherClans}

## 攻撃可能な敵城（隣接）
${adjacentEnemies.length > 0 ? adjacentEnemies.join('\n') : '  なし'}

## 敵武将（謀略対象）
${enemyBusho || '  なし'}
`.trim()
}

export function getPersonalityDescription(leader: Busho): string {
  return `あなたは${leader.name}。性格: ${leader.personality.join(', ')}。この性格に基づいて行動せよ。`
}

export function buildAITurnSystemPrompt(leader: Busho): string {
  return `あなたは戦国シミュレーションゲームのAI大名です。
${getPersonalityDescription(leader)}

与えられたツールを使ってこのターンの行動を決定してください。
1ターンに最大3つの行動ができます。行動が終わったら必ずend_turnを呼んでください。

重要:
- 攻撃は隣接する城にのみ可能
- 資金・兵糧の残量を確認すること
- IDは正確に指定すること`
}

export function buildPlayerCommandSystemPrompt(leaderName: string): string {
  return `あなたは戦国シミュレーションゲームの軍師です。
プレイヤー（${leaderName}）の指示を解釈し、適切なツールを1つ呼び出してください。

重要:
- 攻撃は隣接する城にのみ可能
- IDは正確に指定すること
- 不明な点があれば確認してから実行

指示が曖昧な場合は、最も妥当な解釈で実行してください。`
}
