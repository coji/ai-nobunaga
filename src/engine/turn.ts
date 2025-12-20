// ターン終了処理ロジック

import type { Busho, Castle, Clan, GameState } from '../types.js'

/** 委任による城の成長処理 */
function processDelegation(state: GameState): string[] {
  const changes: string[] = []

  for (const castle of Object.values(state.castleCatalog)) {
    // 委任なし、または城主がいない場合はスキップ
    if (castle.delegationPolicy === 'none' || !castle.castellanId) continue

    const castellan = state.bushoCatalog[castle.castellanId]
    if (!castellan) continue

    const clan = state.clanCatalog[castle.ownerId]
    if (!clan) continue

    // 城主の政治力で成長量が変わる（政治50で基準、100で2倍）
    const politicsBonus = castellan.politics / 50

    switch (castle.delegationPolicy) {
      case 'agriculture': {
        // 農業成長: 3〜6 × 政治ボーナス
        const growth = Math.floor((3 + Math.random() * 3) * politicsBonus)
        castle.agriculture = Math.min(100, castle.agriculture + growth)
        changes.push(`📦 ${castle.name}: 農業+${growth}（${castellan.name}）`)
        break
      }
      case 'commerce': {
        // 商業成長: 3〜6 × 政治ボーナス
        const growth = Math.floor((3 + Math.random() * 3) * politicsBonus)
        castle.commerce = Math.min(100, castle.commerce + growth)
        changes.push(`💰 ${castle.name}: 商業+${growth}（${castellan.name}）`)
        break
      }
      case 'military': {
        // 徴兵: 50〜100 × 政治ボーナス（金を消費）
        const recruitCost = 200
        if (clan.gold >= recruitCost) {
          const soldiers = Math.floor((50 + Math.random() * 50) * politicsBonus)
          castle.soldiers += soldiers
          clan.gold -= recruitCost
          changes.push(`⚔️ ${castle.name}: 兵+${soldiers}（${castellan.name}）`)
        }
        break
      }
      case 'defense': {
        // 防御成長: 2〜4 × 政治ボーナス
        const growth = Math.floor((2 + Math.random() * 2) * politicsBonus)
        castle.defense = Math.min(100, castle.defense + growth)
        changes.push(`🏯 ${castle.name}: 防御+${growth}（${castellan.name}）`)
        break
      }
      case 'balanced': {
        // バランス型: 全て少しずつ（2〜3 × 政治ボーナス）
        const growth = Math.floor((2 + Math.random()) * politicsBonus)
        castle.agriculture = Math.min(100, castle.agriculture + growth)
        castle.commerce = Math.min(100, castle.commerce + growth)
        castle.defense = Math.min(100, castle.defense + growth)
        const soldierGrowth = Math.floor(growth * 15)
        castle.soldiers += soldierGrowth
        changes.push(
          `⚖️ ${castle.name}: 農商防各+${growth} 兵+${soldierGrowth}（${castellan.name}）`,
        )
        break
      }
    }
  }

  return changes
}

/** ターン終了時の収入処理 */
export function processTurnEnd(state: GameState): string[] {
  const changes: string[] = []

  // 委任処理を先に実行
  const delegationChanges = processDelegation(state)
  changes.push(...delegationChanges)

  for (const clan of Object.values(state.clanCatalog)) {
    let totalIncome = 0
    let totalFood = 0
    let totalUpkeep = 0

    for (const castleId of clan.castleIds) {
      const castle = state.castleCatalog[castleId]
      if (!castle) continue
      // 城主の能力で収入ボーナス
      const castellan = castle.castellanId
        ? state.bushoCatalog[castle.castellanId]
        : null
      const castellanBonus = castellan ? 0.8 + castellan.politics / 250 : 1.0 // 政治100で1.2倍
      // 民忠による収入補正（50未満で減少、50で100%、100で120%）
      const loyaltyModifier = 0.4 + castle.loyalty * 0.008
      totalIncome += castle.commerce * 20 * loyaltyModifier * castellanBonus
      totalFood += castle.agriculture * 15 * loyaltyModifier * castellanBonus
      totalUpkeep += castle.soldiers * 0.2

      // 民忠が20未満で一揆発生リスク
      if (castle.loyalty < 20) {
        const rebellionRoll = Math.random()
        if (rebellionRoll < 0.3) {
          const soldierLoss = Math.floor(castle.soldiers * 0.1)
          castle.soldiers = Math.max(0, castle.soldiers - soldierLoss)
          changes.push(`⚠️ ${castle.name}で一揆発生！兵${soldierLoss}人離散`)
        }
      }

      // 民忠が自然回復（最大50まで）
      if (castle.loyalty < 50) {
        castle.loyalty = Math.min(50, castle.loyalty + 2)
      }
    }

    const netGold = Math.floor(totalIncome - totalUpkeep)
    const netFood = Math.floor(totalFood - totalUpkeep)
    clan.gold += netGold
    clan.food += netFood

    // 金・兵糧がマイナスの場合のペナルティ
    if (clan.gold < 0) {
      changes.push(`⚠️ ${clan.name}は金欠状態！`)
      clan.gold = 0
    }
    if (clan.food < 0) {
      // 兵糧切れで兵士が離散
      const totalSoldiers = clan.castleIds.reduce((sum: number, id: string) => {
        const castle = state.castleCatalog[id]
        return sum + (castle?.soldiers ?? 0)
      }, 0)
      const desertion = Math.floor(totalSoldiers * 0.1)
      for (const castleId of clan.castleIds) {
        const castle = state.castleCatalog[castleId]
        if (!castle) continue
        const loss = Math.floor(castle.soldiers * 0.1)
        castle.soldiers = Math.max(0, castle.soldiers - loss)
      }
      changes.push(`⚠️ ${clan.name}は兵糧切れ！兵${desertion}人が離散`)
      clan.food = 0
    }

    changes.push(
      `${clan.name}: 収入+${Math.floor(totalIncome)}金, 兵糧+${Math.floor(totalFood)}, 維持費-${Math.floor(totalUpkeep)}`,
    )
  }

  // 武将の忠誠チェック（寝返り・独立）
  const betrayalChanges = checkBushoLoyalty(state)
  changes.push(...betrayalChanges)

  // 滅亡した勢力の処理（城を全て失った勢力）
  const destroyedChanges = processDestroyedClans(state)
  changes.push(...destroyedChanges)

  state.turn++
  return changes
}

/** 武将の忠誠チェック - 寝返り・独立判定 */
function checkBushoLoyalty(state: GameState): string[] {
  const changes: string[] = []

  for (const busho of Object.values(state.bushoCatalog)) {
    // 当主はスキップ
    if (!busho.clanId) continue
    const clan = state.clanCatalog[busho.clanId]
    if (!clan || clan.leaderId === busho.id) continue

    // 忠誠が30未満で寝返り・独立の可能性
    if (busho.emotions.loyalty < 30) {
      const roll = Math.random()
      const betrayalChance = (30 - busho.emotions.loyalty) / 100 // 忠誠0で30%

      if (roll < betrayalChance) {
        // 城主かどうかチェック
        const castle = Object.values(state.castleCatalog).find(
          (c) => c.castellanId === busho.id,
        )

        if (castle) {
          // 松平元康の特殊処理：独立して徳川家を建てる
          if (busho.id === 'matsudaira_motoyasu') {
            changes.push(...handleMatsudairaIndependence(state, busho, castle))
          } else {
            // 通常の寝返り：敵対勢力に寝返る
            changes.push(...handleBetrayalToCastle(state, busho, castle, clan))
          }
        } else {
          // 城主でない武将は出奔
          busho.clanId = null
          busho.factionId = null
          changes.push(`⚠️ ${busho.name}が出奔した！`)
        }
      }
    }

    // 不満が高いと忠誠が自然低下
    if (busho.emotions.discontent > 50) {
      const loyaltyDrop = Math.floor((busho.emotions.discontent - 50) / 10)
      busho.emotions.loyalty = Math.max(0, busho.emotions.loyalty - loyaltyDrop)
    }
  }

  return changes
}

/** 松平元康の独立処理 - 徳川家として独立 */
function handleMatsudairaIndependence(
  state: GameState,
  busho: Busho,
  castle: Castle,
): string[] {
  const changes: string[] = []
  if (!busho.clanId) {
    return changes
  }
  const oldClan = state.clanCatalog[busho.clanId]
  if (!oldClan) {
    return changes
  }

  // 旧主から城を削除
  oldClan.castleIds = oldClan.castleIds.filter((id: string) => id !== castle.id)

  // 徳川家を作成
  const tokugawaClan: Clan = {
    id: 'tokugawa',
    name: '徳川家',
    leaderId: busho.id,
    gold: 2000,
    food: 3000,
    castleIds: [castle.id],
  }
  state.clanCatalog['tokugawa'] = tokugawaClan

  // 武将の所属を変更
  busho.clanId = 'tokugawa'
  busho.name = '徳川家康' // 改名
  busho.emotions.loyalty = 100
  busho.emotions.discontent = 0

  // 城の所有者を変更
  castle.ownerId = 'tokugawa'

  // 外交関係を追加
  state.diplomacyRelations.push(
    {
      clan1Id: 'tokugawa',
      clan2Id: 'oda',
      type: 'neutral',
      expirationTurn: null,
    },
    {
      clan1Id: 'tokugawa',
      clan2Id: 'imagawa',
      type: 'hostile',
      expirationTurn: null,
    },
    {
      clan1Id: 'tokugawa',
      clan2Id: 'saito',
      type: 'neutral',
      expirationTurn: null,
    },
  )

  changes.push(`🏯 松平元康が今川家から独立！徳川家康と名乗り徳川家を興す！`)
  return changes
}

/** 通常の寝返り処理 */
function handleBetrayalToCastle(
  state: GameState,
  busho: Busho,
  castle: Castle,
  oldClan: Clan,
): string[] {
  const changes: string[] = []

  // 敵対している勢力を探す
  const hostileRelation = state.diplomacyRelations.find(
    (r) =>
      r.type === 'hostile' &&
      (r.clan1Id === oldClan.id || r.clan2Id === oldClan.id),
  )

  if (hostileRelation) {
    const newClanId =
      hostileRelation.clan1Id === oldClan.id
        ? hostileRelation.clan2Id
        : hostileRelation.clan1Id
    const newClan = state.clanCatalog[newClanId]

    if (newClan) {
      // 旧主から城を削除
      oldClan.castleIds = oldClan.castleIds.filter((id) => id !== castle.id)

      // 新しい主に城を追加
      newClan.castleIds.push(castle.id)
      castle.ownerId = newClanId

      // 武将の所属を変更
      busho.clanId = newClanId
      busho.factionId = null
      busho.emotions.loyalty = 60
      busho.emotions.discontent = 0

      changes.push(
        `⚠️ ${busho.name}が${oldClan.name}を裏切り、${castle.name}ごと${newClan.name}に寝返った！`,
      )
    }
  }

  return changes
}

/** 滅亡した勢力の処理 - 城を全て失った勢力を除去し、武将を浪人化 */
export function processDestroyedClans(state: GameState): string[] {
  const changes: string[] = []
  const clansToRemove: string[] = []

  for (const clan of Object.values(state.clanCatalog)) {
    if (clan.castleIds.length === 0) {
      clansToRemove.push(clan.id)
    }
  }

  for (const clanId of clansToRemove) {
    const clan = state.clanCatalog[clanId]
    if (!clan) continue

    // 所属武将を浪人化
    for (const busho of Object.values(state.bushoCatalog)) {
      if (busho.clanId === clanId) {
        busho.clanId = null
        busho.factionId = null
        changes.push(`${busho.name}は浪人となった`)
      }
    }

    // 外交関係を削除
    state.diplomacyRelations = state.diplomacyRelations.filter(
      (r) => r.clan1Id !== clanId && r.clan2Id !== clanId,
    )

    // 勢力を削除
    delete state.clanCatalog[clanId]
    changes.push(`💀 ${clan.name}滅亡！`)
  }

  return changes
}
