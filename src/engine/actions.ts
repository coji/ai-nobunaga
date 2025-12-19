// 行動実行ロジック

import type {
  ActionResult,
  DiplomacyAction,
  DomesticAction,
  GameAction,
  GameState,
  GrudgeEvent,
  IntrigueAction,
  MilitaryAction,
  ResultGrade,
} from '../types.js'
import { validateAction } from './validation.js'

/**
 * 大成功・大失敗を判定するダイスロール
 * 10%の確率で大成功、10%の確率で大失敗、80%は通常
 */
function rollForGrade(baseSuccess: boolean): ResultGrade {
  const roll = Math.random()
  if (baseSuccess) {
    // 成功ベースの場合: 15%大成功, 85%通常成功
    return roll < 0.15 ? 'critical_success' : 'success'
  } else {
    // 失敗ベースの場合: 15%大失敗, 85%通常失敗
    return roll < 0.15 ? 'critical_failure' : 'failure'
  }
}

/**
 * 大成功時の効果倍率 (1.5〜2.0倍)
 */
function getCriticalSuccessMultiplier(): number {
  return 1.5 + Math.random() * 0.5
}

/**
 * 大失敗時のペナルティ倍率 (0.5〜1.5倍の追加コスト等)
 */
function _getCriticalFailurePenalty(): number {
  return 0.5 + Math.random()
}

/** 行動を実行して結果を返す */
export function executeAction(
  state: GameState,
  clanId: string,
  action: GameAction,
): ActionResult {
  const validation = validateAction(state, clanId, action)
  if (!validation.valid) {
    return {
      success: false,
      grade: 'failure',
      action,
      message: validation.reason || '不明なエラー',
      stateChanges: [],
    }
  }

  switch (action.category) {
    case '内政':
      return executeDomesticAction(state, clanId, action)
    case '外交':
      return executeDiplomacyAction(state, clanId, action)
    case '軍事':
      return executeMilitaryAction(state, clanId, action)
    case '謀略':
      return executeIntrigueAction(state, clanId, action)
  }
}

function executeDomesticAction(
  state: GameState,
  clanId: string,
  action: DomesticAction,
): ActionResult {
  const castle = state.castleCatalog.get(action.targetId)
  const clan = state.clanCatalog.get(clanId)
  if (!castle || !clan) {
    return {
      success: false,
      grade: 'failure',
      action,
      message: '対象が見つかりません',
      stateChanges: [],
    }
  }
  const leader = state.bushoCatalog.get(clan.leaderId)
  if (!leader) {
    return {
      success: false,
      grade: 'failure',
      action,
      message: '当主が見つかりません',
      stateChanges: [],
    }
  }
  const changes: string[] = []

  // 君主の政治力で効果が変動（政治50で1.0倍、100で1.5倍、1で0.5倍）
  const politicsModifier = 0.5 + leader.politics / 100
  // ランダム要素（0.8〜1.2倍）
  const randomModifier = 0.8 + Math.random() * 0.4
  let effectModifier = politicsModifier * randomModifier

  // 大成功・大失敗判定（内政は基本成功だが、稀に大成功/大失敗）
  const grade = rollForGrade(true)
  let gradeMessage = ''

  if (grade === 'critical_success') {
    // 大成功: 効果1.5〜2倍
    effectModifier *= getCriticalSuccessMultiplier()
    gradeMessage = '【大成功】民が奮起し予想以上の成果！'
  } else if (grade === 'critical_failure') {
    // 大失敗扱い（投資したが効果が薄い）
    effectModifier *= 0.3
    gradeMessage = '【失敗】天候不順で成果が振るわず…'
  }

  switch (action.type) {
    case 'develop_agriculture': {
      clan.gold = Math.max(0, clan.gold - action.value)
      const agriBoost = Math.max(
        1,
        Math.floor((action.value / 100) * effectModifier),
      )
      castle.agriculture = Math.min(100, castle.agriculture + agriBoost)
      // 内政で民忠上昇
      const agriLoyaltyBoost = Math.max(
        1,
        Math.floor((action.value / 200) * effectModifier),
      )
      castle.loyalty = Math.min(100, castle.loyalty + agriLoyaltyBoost)
      changes.push(
        `${castle.name}の農業力+${agriBoost}、民忠+${agriLoyaltyBoost}`,
      )
      break
    }
    case 'develop_commerce': {
      clan.gold = Math.max(0, clan.gold - action.value)
      const commBoost = Math.max(
        1,
        Math.floor((action.value / 100) * effectModifier),
      )
      castle.commerce = Math.min(100, castle.commerce + commBoost)
      // 内政で民忠上昇
      const commLoyaltyBoost = Math.max(
        1,
        Math.floor((action.value / 200) * effectModifier),
      )
      castle.loyalty = Math.min(100, castle.loyalty + commLoyaltyBoost)
      changes.push(
        `${castle.name}の商業力+${commBoost}、民忠+${commLoyaltyBoost}`,
      )
      break
    }
  }

  if (gradeMessage) {
    changes.unshift(gradeMessage)
  }

  return {
    success: grade !== 'critical_failure',
    grade,
    action,
    message: action.intent,
    stateChanges: changes,
  }
}

function executeDiplomacyAction(
  state: GameState,
  clanId: string,
  action: DiplomacyAction,
): ActionResult {
  const changes: string[] = []
  const clan = state.clanCatalog.get(clanId)
  const targetClan = state.clanCatalog.get(action.targetId)
  if (!clan || !targetClan) {
    return {
      success: false,
      grade: 'failure',
      action,
      message: '対象の勢力が見つかりません',
      stateChanges: [],
    }
  }
  const ownLeader = state.bushoCatalog.get(clan.leaderId)
  if (!ownLeader) {
    return {
      success: false,
      grade: 'failure',
      action,
      message: '当主が見つかりません',
      stateChanges: [],
    }
  }

  // 君主の魅力で成功率が変動（魅力50で+0%、100で+25%）
  const charismaBonus = (ownLeader.charisma - 50) / 200
  // ランダム要素（-0.1〜+0.1）
  const randomBonus = (Math.random() - 0.5) * 0.2

  // 外交行動の成功率計算（リスク許容度と相手の感情を考慮）
  const leader = state.bushoCatalog.get(targetClan.leaderId)
  if (!leader) {
    return {
      success: false,
      grade: 'failure',
      action,
      message: '対象の当主が見つかりません',
      stateChanges: [],
    }
  }
  const baseChance =
    action.type === 'propose_alliance'
      ? 0.3
      : action.type === 'send_gift'
        ? 0.8
        : 0.5
  const successChance = Math.min(
    0.95,
    Math.max(
      0.05,
      baseChance + action.riskTolerance * 0.2 + charismaBonus + randomBonus,
    ),
  )
  const roll = Math.random()

  if (action.type === 'propose_alliance') {
    const baseSuccess = roll < successChance
    const grade = rollForGrade(baseSuccess)

    if (baseSuccess) {
      // 既存の関係を更新
      const existingRelation = state.diplomacyRelations.find(
        (r) =>
          (r.clan1Id === clanId && r.clan2Id === action.targetId) ||
          (r.clan1Id === action.targetId && r.clan2Id === clanId),
      )
      if (existingRelation) {
        existingRelation.type = 'alliance'
        // 大成功時は同盟期間が1.5倍
        const baseDuration = action.conditions?.duration || 12
        const duration =
          grade === 'critical_success'
            ? Math.floor(baseDuration * 1.5)
            : baseDuration
        existingRelation.expirationTurn = state.turn + duration
      }

      if (grade === 'critical_success') {
        // 大成功: 相手の好感度も上昇
        leader.emotions.respect = Math.min(100, leader.emotions.respect + 20)
        changes.push(
          `【大成功】${targetClan.name}と固い同盟を締結！相手の信頼も厚い`,
        )
      } else {
        changes.push(`${targetClan.name}と同盟を締結`)
      }
      return {
        success: true,
        grade,
        action,
        message: `${targetClan.name}との同盟交渉が成立`,
        stateChanges: changes,
      }
    } else {
      if (grade === 'critical_failure') {
        // 大失敗: 関係悪化
        leader.emotions.respect = Math.max(0, leader.emotions.respect - 15)
        leader.emotions.discontent = Math.min(
          100,
          leader.emotions.discontent + 10,
        )
        changes.push(`【大失敗】${targetClan.name}が激怒！関係が悪化した`)
      } else {
        changes.push(`${targetClan.name}が同盟を拒否`)
      }
      return {
        success: false,
        grade,
        action,
        message: `${targetClan.name}は同盟を拒否した`,
        stateChanges: changes,
      }
    }
  }

  if (action.type === 'send_gift') {
    const giftAmount = action.conditions?.goldOffered || 500
    clan.gold = Math.max(0, clan.gold - giftAmount)

    // 贈答は基本成功だが、効果に差が出る
    const grade = rollForGrade(true)
    let respectBoost = 10

    if (grade === 'critical_success') {
      // 大成功: 相手が大いに喜ぶ
      respectBoost = 25
      leader.emotions.respect = Math.min(
        100,
        leader.emotions.respect + respectBoost,
      )
      leader.emotions.discontent = Math.max(0, leader.emotions.discontent - 15)
      changes.push(`【大成功】${targetClan.name}が大いに喜んだ！友好大幅上昇`)
    } else if (grade === 'critical_failure') {
      // 大失敗: 贈り物が届かない、または失礼にあたる
      respectBoost = -5
      leader.emotions.respect = Math.max(
        0,
        leader.emotions.respect + respectBoost,
      )
      changes.push(`【失敗】贈り物が道中で紛失…${giftAmount}金を失った`)
    } else {
      leader.emotions.respect = Math.min(
        100,
        leader.emotions.respect + respectBoost,
      )
      leader.emotions.discontent = Math.max(0, leader.emotions.discontent - 5)
      changes.push(`${targetClan.name}に${giftAmount}金を贈答`)
    }

    return {
      success: grade !== 'critical_failure',
      grade,
      action,
      message: `${targetClan.name}への贈答`,
      stateChanges: changes,
    }
  }

  if (action.type === 'break_alliance') {
    const existingRelation = state.diplomacyRelations.find(
      (r) =>
        (r.clan1Id === clanId && r.clan2Id === action.targetId) ||
        (r.clan1Id === action.targetId && r.clan2Id === clanId),
    )
    if (existingRelation && existingRelation.type === 'alliance') {
      existingRelation.type = 'hostile'
      existingRelation.expirationTurn = null
      // 怨恨を記録
      const grudge: GrudgeEvent = {
        id: `grudge_${state.turn}_${clanId}_${action.targetId}`,
        turn: state.turn,
        actorId: clanId,
        targetId: action.targetId,
        type: 'alliance_break',
        description: `${clan.name}が同盟を破棄`,
        emotionImpact: { respect: -30, discontent: 20 },
      }
      state.grudgeHistory.push(grudge)
      changes.push(`${targetClan.name}との同盟を破棄（怨恨発生）`)
    }
    return {
      success: true,
      grade: 'success',
      action,
      message: `${targetClan.name}との同盟破棄`,
      stateChanges: changes,
    }
  }

  if (action.type === 'threaten') {
    const grade = rollForGrade(true)

    if (grade === 'critical_success') {
      // 大成功: 相手が完全に怯える
      leader.emotions.fear = Math.min(100, leader.emotions.fear + 35)
      changes.push(`【大成功】${targetClan.name}が完全に怯えた！`)
    } else if (grade === 'critical_failure') {
      // 大失敗: 相手が激怒
      leader.emotions.fear = Math.max(0, leader.emotions.fear - 10)
      leader.emotions.discontent = Math.min(
        100,
        leader.emotions.discontent + 25,
      )
      changes.push(`【大失敗】${targetClan.name}が逆上！敵意が高まった`)
    } else {
      leader.emotions.fear = Math.min(100, leader.emotions.fear + 15)
      leader.emotions.discontent = Math.min(
        100,
        leader.emotions.discontent + 10,
      )
      changes.push(`${targetClan.name}を威嚇`)
    }

    return {
      success: grade !== 'critical_failure',
      grade,
      action,
      message: `${targetClan.name}への威嚇`,
      stateChanges: changes,
    }
  }

  return {
    success: true,
    grade: 'success',
    action,
    message: action.intent,
    stateChanges: changes,
  }
}

function executeMilitaryAction(
  state: GameState,
  clanId: string,
  action: MilitaryAction,
): ActionResult {
  const targetCastle = state.castleCatalog.get(action.targetId)
  const clan = state.clanCatalog.get(clanId)
  if (!targetCastle || !clan) {
    return {
      success: false,
      grade: 'failure',
      action,
      message: '対象が見つかりません',
      stateChanges: [],
    }
  }
  const leader = state.bushoCatalog.get(clan.leaderId)
  if (!leader) {
    return {
      success: false,
      grade: 'failure',
      action,
      message: '当主が見つかりません',
      stateChanges: [],
    }
  }
  const changes: string[] = []

  // 君主の武勇で効果が変動（武勇50で1.0倍、100で1.5倍）
  const warfareModifier = 0.5 + leader.warfare / 100
  // ランダム要素（0.8〜1.2倍）
  const randomModifier = 0.8 + Math.random() * 0.4
  let effectModifier = warfareModifier * randomModifier

  if (action.type === 'recruit_soldiers') {
    const count = action.value || 0
    const foodCost = count * 3
    clan.food = Math.max(0, clan.food - foodCost)

    // 大成功・大失敗判定
    const grade = rollForGrade(true)
    let gradeMessage = ''

    if (grade === 'critical_success') {
      // 大成功: 志願兵が殺到
      effectModifier *= getCriticalSuccessMultiplier()
      gradeMessage = '【大成功】志願兵が殺到！予想以上の徴兵'
    } else if (grade === 'critical_failure') {
      // 大失敗: 逃亡兵多発
      effectModifier *= 0.3
      gradeMessage = '【失敗】民の反発が強く徴兵難航…'
    }

    const actualCount = Math.max(1, Math.floor(count * effectModifier))
    targetCastle.soldiers += actualCount
    const loyaltyDrop = Math.max(1, Math.floor(count / 100 / effectModifier))
    targetCastle.loyalty = Math.max(0, targetCastle.loyalty - loyaltyDrop)

    if (gradeMessage) changes.push(gradeMessage)
    changes.push(
      `${targetCastle.name}で${actualCount}人を徴兵（民忠-${loyaltyDrop}）`,
    )

    return {
      success: grade !== 'critical_failure',
      grade,
      action,
      message: action.intent,
      stateChanges: changes,
    }
  }

  if (action.type === 'fortify') {
    const cost = action.value || 0
    clan.gold = Math.max(0, clan.gold - cost)

    // 大成功・大失敗判定
    const grade = rollForGrade(true)
    let gradeMessage = ''

    if (grade === 'critical_success') {
      effectModifier *= getCriticalSuccessMultiplier()
      gradeMessage = '【大成功】名工の助力で堅牢な城郭完成！'
    } else if (grade === 'critical_failure') {
      effectModifier *= 0.3
      gradeMessage = '【失敗】資材が不良品で工事やり直し…'
    }

    const defBoost = Math.max(1, Math.floor((cost / 150) * effectModifier))
    targetCastle.defense = Math.min(100, targetCastle.defense + defBoost)

    if (gradeMessage) changes.push(gradeMessage)
    changes.push(`${targetCastle.name}の防御力が${defBoost}上昇`)

    return {
      success: grade !== 'critical_failure',
      grade,
      action,
      message: action.intent,
      stateChanges: changes,
    }
  }

  if (action.type === 'attack') {
    const fromCastle = state.castleCatalog.get(action.fromCastleId || '')
    if (!fromCastle) {
      return {
        success: false,
        grade: 'failure',
        action,
        message: '出撃元の城が見つかりません',
        stateChanges: [],
      }
    }
    const soldierCount = Math.min(action.soldierCount || 0, fromCastle.soldiers)
    const initialFromSoldiers = fromCastle.soldiers
    const initialTargetSoldiers = targetCastle.soldiers
    fromCastle.soldiers = Math.max(0, fromCastle.soldiers - soldierCount)

    // 戦闘の大成功・大失敗判定（攻撃前に判定）
    const battleRoll = Math.random()
    let battleGrade: ResultGrade = 'success'
    let battleModifier = 1.0

    if (battleRoll < 0.1) {
      // 10%で大成功（奇襲成功など）
      battleGrade = 'critical_success'
      battleModifier = getCriticalSuccessMultiplier()
      changes.push('【大成功】奇襲が成功！敵陣は大混乱')
    } else if (battleRoll > 0.9) {
      // 10%で大失敗（伏兵にやられるなど）
      battleGrade = 'critical_failure'
      battleModifier = 0.5
      changes.push('【大失敗】敵の伏兵に遭遇！大損害')
    }

    // 戦闘計算（武勇で攻撃力ボーナス）
    const attackPower =
      soldierCount *
      (1 + action.riskTolerance * 0.3) *
      effectModifier *
      battleModifier
    const defensePower =
      targetCastle.soldiers * (1 + targetCastle.defense / 100)

    let attackerLosses = Math.floor(
      soldierCount * 0.2 * (defensePower / attackPower),
    )
    let defenderLosses = Math.floor(
      targetCastle.soldiers * 0.3 * (attackPower / defensePower),
    )

    // 大失敗時は攻撃側損害増加
    if (battleGrade === 'critical_failure') {
      attackerLosses = Math.floor(attackerLosses * 1.5)
    }
    // 大成功時は防御側損害増加
    if (battleGrade === 'critical_success') {
      defenderLosses = Math.floor(defenderLosses * 1.5)
    }

    const remainingAttackers = Math.max(0, soldierCount - attackerLosses)
    targetCastle.soldiers = Math.max(0, targetCastle.soldiers - defenderLosses)

    if (targetCastle.soldiers === 0 && remainingAttackers > 0) {
      // 城を奪取
      const previousOwner = targetCastle.ownerId
      const previousClan = state.clanCatalog.get(previousOwner)
      if (previousClan) {
        previousClan.castleIds = previousClan.castleIds.filter(
          (id) => id !== targetCastle.id,
        )
      }

      targetCastle.ownerId = clanId
      targetCastle.soldiers = remainingAttackers
      targetCastle.castellanId = null
      clan.castleIds.push(targetCastle.id)

      // 怨恨を記録
      const grudge: GrudgeEvent = {
        id: `grudge_${state.turn}_${clanId}_${previousOwner}`,
        turn: state.turn,
        actorId: clanId,
        targetId: previousOwner,
        type: 'territory_loss',
        description: `${clan.name}が${targetCastle.name}を奪取`,
        emotionImpact: { respect: -20, discontent: 30 },
      }
      state.grudgeHistory.push(grudge)

      changes.push(
        `${targetCastle.name}攻略！ 自軍${soldierCount}→${remainingAttackers}(-${attackerLosses}) 敵${initialTargetSoldiers}→0(-${defenderLosses})`,
      )
      return {
        success: true,
        grade:
          battleGrade === 'critical_success' ? 'critical_success' : 'success',
        action,
        message: `${targetCastle.name}を奪取`,
        stateChanges: changes,
      }
    } else {
      // 撤退
      fromCastle.soldiers += remainingAttackers
      const finalFromSoldiers = fromCastle.soldiers
      changes.push(
        `${targetCastle.name}攻撃失敗 自軍${initialFromSoldiers}→${finalFromSoldiers}(-${attackerLosses}) 敵${initialTargetSoldiers}→${targetCastle.soldiers}(-${defenderLosses})`,
      )
      return {
        success: false,
        grade:
          battleGrade === 'critical_failure' ? 'critical_failure' : 'failure',
        action,
        message: `${targetCastle.name}攻略失敗`,
        stateChanges: changes,
      }
    }
  }

  return {
    success: false,
    grade: 'failure',
    action,
    message: '行動を実行できませんでした',
    stateChanges: changes,
  }
}

function executeIntrigueAction(
  state: GameState,
  clanId: string,
  action: IntrigueAction,
): ActionResult {
  const clan = state.clanCatalog.get(clanId)
  if (!clan) {
    return {
      success: false,
      grade: 'failure',
      action,
      message: '勢力が見つかりません',
      stateChanges: [],
    }
  }
  const leader = state.bushoCatalog.get(clan.leaderId)
  if (!leader) {
    return {
      success: false,
      grade: 'failure',
      action,
      message: '当主が見つかりません',
      stateChanges: [],
    }
  }
  const changes: string[] = []

  const costs: Record<IntrigueAction['type'], number> = {
    bribe: 500,
    assassinate: 1000,
    spread_rumor: 200,
    incite_rebellion: 800,
  }
  clan.gold = Math.max(0, clan.gold - costs[action.type])

  // 君主の知略で成功率が変動（知略50で+0%、100で+25%）
  const intelligenceBonus = (leader.intelligence - 50) / 200
  // ランダム要素（-0.1〜+0.1）
  const randomBonus = (Math.random() - 0.5) * 0.2

  // 謀略の成功率（リスク許容度に大きく依存）
  const baseChance =
    action.type === 'bribe'
      ? 0.4
      : action.type === 'assassinate'
        ? 0.2
        : action.type === 'spread_rumor'
          ? 0.6
          : 0.3
  const successChance = Math.min(
    0.95,
    Math.max(
      0.05,
      baseChance + action.riskTolerance * 0.3 + intelligenceBonus + randomBonus,
    ),
  )
  const roll = Math.random()
  const baseSuccess = roll < successChance
  const grade = rollForGrade(baseSuccess)

  if (baseSuccess) {
    const target = state.bushoCatalog.get(action.targetId)
    if (target) {
      // 大成功時は効果倍増
      const effectMultiplier = grade === 'critical_success' ? 1.5 : 1.0

      switch (action.type) {
        case 'bribe': {
          const loyaltyDrop = Math.floor(20 * effectMultiplier)
          target.emotions.loyalty -= loyaltyDrop
          target.emotions.discontent += Math.floor(15 * effectMultiplier)

          // 忠誠が30以下になったら寝返り判定（当主は寝返らない）
          const originalClanId = target.clanId
          const originalClan = originalClanId
            ? state.clanCatalog.get(originalClanId)
            : null
          const isLeader = originalClan?.leaderId === target.id

          if (!isLeader && target.emotions.loyalty <= 30) {
            // 寝返り成功！
            target.clanId = clanId
            target.emotions.loyalty = 60 // 新しい主君への初期忠誠

            if (grade === 'critical_success') {
              changes.push(`【大成功】${target.name}が寝返った！我が軍の配下に`)
            } else {
              changes.push(
                `${target.name}が寝返り！忠誠${target.emotions.loyalty + loyaltyDrop}→${target.emotions.loyalty}以下で決意`,
              )
            }
          } else if (grade === 'critical_success') {
            changes.push(
              `【大成功】${target.name}が完全に心変わり！（忠誠${target.emotions.loyalty}）`,
            )
          } else {
            changes.push(
              `${target.name}を買収（忠誠-${loyaltyDrop}→${target.emotions.loyalty}）`,
            )
          }
          break
        }
        case 'assassinate':
          // 暗殺成功（武将を除去）
          if (target.clanId) {
            const targetClan = state.clanCatalog.get(target.clanId)
            if (targetClan && targetClan.leaderId === target.id) {
              if (grade === 'critical_success') {
                changes.push(
                  `【大成功】${target.name}暗殺！闇に葬られた（当主死亡！）`,
                )
              } else {
                changes.push(`${target.name}暗殺成功（当主死亡！）`)
              }
            } else {
              if (grade === 'critical_success') {
                changes.push(`【大成功】${target.name}暗殺！証拠隠滅も完璧`)
              } else {
                changes.push(`${target.name}暗殺成功`)
              }
            }
          }
          state.bushoCatalog.delete(target.id)
          break
        case 'spread_rumor':
          target.emotions.discontent += Math.floor(25 * effectMultiplier)
          if (grade === 'critical_success') {
            changes.push(`【大成功】${target.name}の悪評が広まり、家中大混乱！`)
          } else {
            changes.push(`${target.name}に関する流言が広まった`)
          }
          break
        case 'incite_rebellion':
          target.emotions.loyalty -= Math.floor(30 * effectMultiplier)
          target.emotions.discontent += Math.floor(30 * effectMultiplier)
          if (grade === 'critical_success') {
            changes.push(`【大成功】${target.name}が謀反を決意！`)
          } else {
            changes.push(`${target.name}に謀反を唆した`)
          }
          break
      }
    }
    return {
      success: true,
      grade,
      action,
      message: action.intent,
      stateChanges: changes,
    }
  } else {
    // 失敗
    if (grade === 'critical_failure') {
      // 大失敗: 発覚して関係悪化、場合によっては怨恨
      const target = state.bushoCatalog.get(action.targetId)
      if (target?.clanId) {
        const targetClan = state.clanCatalog.get(target.clanId)
        if (targetClan) {
          const targetLeader = state.bushoCatalog.get(targetClan.leaderId)
          if (targetLeader) {
            targetLeader.emotions.discontent = Math.min(
              100,
              targetLeader.emotions.discontent + 20,
            )
          }
          // 怨恨を記録
          const grudge: GrudgeEvent = {
            id: `grudge_${state.turn}_${clanId}_${target.clanId}_intrigue`,
            turn: state.turn,
            actorId: clanId,
            targetId: target.clanId,
            type: 'betrayal',
            description: `${clan.name}の謀略が発覚`,
            emotionImpact: { respect: -25, discontent: 20 },
          }
          state.grudgeHistory.push(grudge)
        }
      }
      changes.push(
        `【大失敗】謀略が発覚！${target?.name || '対象'}の主君が激怒（怨恨発生）`,
      )
    } else {
      changes.push(`謀略失敗（発覚の恐れあり）`)
    }
    return {
      success: false,
      grade,
      action,
      message: `謀略は失敗に終わった`,
      stateChanges: changes,
    }
  }
}
