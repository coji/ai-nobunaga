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

  // 内政担当を取得（城主 > 当主）
  const administrator = castle.castellanId
    ? state.bushoCatalog.get(castle.castellanId)
    : leader
  const adminPolitics = administrator?.politics ?? leader.politics

  // 担当者の政治力で効果が変動（政治50で1.0倍、100で1.5倍、1で0.5倍）
  const politicsModifier = 0.5 + adminPolitics / 100
  // ランダム要素（0.8〜1.2倍）
  const randomModifier = 0.8 + Math.random() * 0.4
  let effectModifier = politicsModifier * randomModifier

  // 担当者名を表示（城主がいる場合）
  if (administrator && administrator.id !== leader.id) {
    changes.push(`内政担当: ${administrator.name}（政治${adminPolitics}）`)
  }

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
        // 大成功: 相手の好感度も上昇（15〜25 + 魅力ボーナス）
        const respectBoost = 15 + Math.floor(Math.random() * 11) + Math.floor((ownLeader.charisma - 50) / 10)
        leader.emotions.respect = Math.min(100, leader.emotions.respect + respectBoost)
        changes.push(
          `【大成功】${targetClan.name}と固い同盟を締結！（信頼+${respectBoost}）`,
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
        // 大失敗: 関係悪化（10〜20の信頼低下、8〜15の不満上昇）
        const respectDrop = 10 + Math.floor(Math.random() * 11)
        const discontentBoost = 8 + Math.floor(Math.random() * 8)
        leader.emotions.respect = Math.max(0, leader.emotions.respect - respectDrop)
        leader.emotions.discontent = Math.min(
          100,
          leader.emotions.discontent + discontentBoost,
        )
        changes.push(`【大失敗】${targetClan.name}が激怒！関係が悪化した（信頼-${respectDrop}）`)
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
    // 魅力ボーナス（魅力50で+0、100で+5）
    const giftCharismaBonus = Math.floor((ownLeader.charisma - 50) / 10)

    if (grade === 'critical_success') {
      // 大成功: 相手が大いに喜ぶ（20〜30 + 魅力ボーナス）
      const respectBoost = 20 + Math.floor(Math.random() * 11) + giftCharismaBonus
      leader.emotions.respect = Math.min(
        100,
        leader.emotions.respect + respectBoost,
      )
      const discontentDrop = 10 + Math.floor(Math.random() * 11)
      leader.emotions.discontent = Math.max(0, leader.emotions.discontent - discontentDrop)
      changes.push(`【大成功】${targetClan.name}が大いに喜んだ！（信頼+${respectBoost}）`)
    } else if (grade === 'critical_failure') {
      // 大失敗: 贈り物が届かない、または失礼にあたる
      const respectDrop = 3 + Math.floor(Math.random() * 6)
      leader.emotions.respect = Math.max(
        0,
        leader.emotions.respect - respectDrop,
      )
      changes.push(`【失敗】贈り物が道中で紛失…${giftAmount}金を失った`)
    } else {
      // 通常成功（8〜15 + 魅力ボーナス）
      const respectBoost = 8 + Math.floor(Math.random() * 8) + giftCharismaBonus
      leader.emotions.respect = Math.min(
        100,
        leader.emotions.respect + respectBoost,
      )
      const discontentDrop = 3 + Math.floor(Math.random() * 5)
      leader.emotions.discontent = Math.max(0, leader.emotions.discontent - discontentDrop)
      changes.push(`${targetClan.name}に${giftAmount}金を贈答（信頼+${respectBoost}）`)
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
    // 武勇ボーナス（武勇50で+0、100で+5）
    const warfareBonus = Math.floor((ownLeader.warfare - 50) / 10)

    if (grade === 'critical_success') {
      // 大成功: 相手が完全に怯える（30〜40 + 武力ボーナス）
      const fearBoost = 30 + Math.floor(Math.random() * 11) + warfareBonus
      leader.emotions.fear = Math.min(100, leader.emotions.fear + fearBoost)
      changes.push(`【大成功】${targetClan.name}が完全に怯えた！（恐怖+${fearBoost}）`)
    } else if (grade === 'critical_failure') {
      // 大失敗: 相手が激怒
      const fearDrop = 8 + Math.floor(Math.random() * 6)
      leader.emotions.fear = Math.max(0, leader.emotions.fear - fearDrop)
      const discontentBoost = 20 + Math.floor(Math.random() * 11)
      leader.emotions.discontent = Math.min(
        100,
        leader.emotions.discontent + discontentBoost,
      )
      changes.push(`【大失敗】${targetClan.name}が逆上！敵意が高まった`)
    } else {
      // 通常成功（12〜20 + 武力ボーナス）
      const fearBoost = 12 + Math.floor(Math.random() * 9) + warfareBonus
      leader.emotions.fear = Math.min(100, leader.emotions.fear + fearBoost)
      const discontentBoost = 8 + Math.floor(Math.random() * 6)
      leader.emotions.discontent = Math.min(
        100,
        leader.emotions.discontent + discontentBoost,
      )
      changes.push(`${targetClan.name}を威嚇（恐怖+${fearBoost}）`)
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

  // 軍事担当を取得（城主 > 当主）
  const commander = targetCastle.castellanId
    ? state.bushoCatalog.get(targetCastle.castellanId)
    : leader

  if (action.type === 'recruit_soldiers') {
    // 徴兵は魅力で効果が変動
    const charisma = commander?.charisma ?? leader.charisma
    const charismaModifier = 0.5 + charisma / 100
    const randomModifier = 0.8 + Math.random() * 0.4
    let effectModifier = charismaModifier * randomModifier

    // 担当者名を表示（城主がいる場合）
    if (commander && commander.id !== leader.id) {
      changes.push(`徴兵担当: ${commander.name}（魅力${charisma}）`)
    }

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
    // 城修築は政治力で効果が変動
    const politics = commander?.politics ?? leader.politics
    const politicsModifier = 0.5 + politics / 100
    const randomModifier = 0.8 + Math.random() * 0.4
    let effectModifier = politicsModifier * randomModifier

    // 担当者名を表示（城主がいる場合）
    if (commander && commander.id !== leader.id) {
      changes.push(`修築担当: ${commander.name}（政治${politics}）`)
    }

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

    // 攻撃側の指揮官を取得（城主 > 当主）
    const attackCommander = fromCastle.castellanId
      ? state.bushoCatalog.get(fromCastle.castellanId)
      : leader
    // 防御側の指揮官を取得（城主 > 当主）
    const defenderClan = state.clanCatalog.get(targetCastle.ownerId)
    const defenderLeader = defenderClan
      ? state.bushoCatalog.get(defenderClan.leaderId)
      : undefined
    const defenseCommander = targetCastle.castellanId
      ? state.bushoCatalog.get(targetCastle.castellanId)
      : defenderLeader

    // 指揮官の武勇で攻撃力・防御力にボーナス（武勇50で1.0倍、100で1.5倍）
    const attackCommanderBonus = attackCommander
      ? 0.5 + attackCommander.warfare / 100
      : 1.0
    const defenseCommanderBonus = defenseCommander
      ? 0.5 + defenseCommander.warfare / 100
      : 1.0

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

    // 指揮官名を表示
    if (attackCommander && attackCommander.id !== leader.id) {
      changes.push(
        `攻撃指揮: ${attackCommander.name}（武勇${attackCommander.warfare}）`,
      )
    }
    if (defenseCommander) {
      changes.push(
        `防御指揮: ${defenseCommander.name}（武勇${defenseCommander.warfare}）`,
      )
    }

    // 戦闘計算（指揮官の武勇で攻撃力・防御力ボーナス）
    const attackPower =
      soldierCount *
      (1 + action.riskTolerance * 0.3) *
      battleModifier *
      attackCommanderBonus
    const defensePower =
      targetCastle.soldiers *
      (1 + targetCastle.defense / 100) *
      defenseCommanderBonus

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

    // 敗北判定: 攻撃成功 or 攻撃失敗で勝敗が決まる
    const attackerWon = targetCastle.soldiers === 0 && remainingAttackers > 0

    // 武将討死・捕縛判定
    const checkGeneralFate = (
      general: typeof attackCommander,
      isLoser: boolean,
      side: '攻撃' | '防御',
    ) => {
      if (!general) return
      // 当主は討死しない（捕縛のみ、低確率）
      const isLeader =
        (side === '攻撃' && general.id === leader.id) ||
        (side === '防御' && defenderLeader && general.id === defenderLeader.id)

      if (isLoser) {
        const fateRoll = Math.random()
        // 敗北側: 15%討死、10%捕縛
        if (!isLeader && fateRoll < 0.15) {
          // 討死
          state.bushoCatalog.delete(general.id)
          // 城主から外す
          if (side === '攻撃' && fromCastle.castellanId === general.id) {
            fromCastle.castellanId = null
          }
          if (side === '防御' && targetCastle.castellanId === general.id) {
            targetCastle.castellanId = null
          }
          changes.push(`【討死】${general.name}が戦死！`)
        } else if (fateRoll < 0.25) {
          // 捕縛（当主の場合は5%のみ）
          if (isLeader && fateRoll >= 0.05) return
          // 勝者側に寝返り（捕縛→登用）
          const newClanId = side === '攻撃' ? targetCastle.ownerId : clanId
          general.clanId = newClanId
          general.emotions.loyalty = 40 // 捕縛されたので忠誠低め
          // 城主から外す
          if (side === '攻撃' && fromCastle.castellanId === general.id) {
            fromCastle.castellanId = null
          }
          if (side === '防御' && targetCastle.castellanId === general.id) {
            targetCastle.castellanId = null
          }
          const captor = side === '攻撃' ? defenderClan?.name : clan.name
          changes.push(`【捕縛】${general.name}が${captor}に捕らえられた`)
        }
      } else {
        // 勝利側でも3%で討死（流れ矢など）
        if (!isLeader && Math.random() < 0.03) {
          state.bushoCatalog.delete(general.id)
          if (side === '攻撃' && fromCastle.castellanId === general.id) {
            fromCastle.castellanId = null
          }
          if (side === '防御' && targetCastle.castellanId === general.id) {
            targetCastle.castellanId = null
          }
          changes.push(`【討死】${general.name}が流れ矢に倒れた…`)
        }
      }
    }

    // 武将の運命を判定
    checkGeneralFate(attackCommander, !attackerWon, '攻撃')
    checkGeneralFate(defenseCommander, attackerWon, '防御')

    if (attackerWon) {
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

  // 謀略担当を取得（配下で最も知略が高い武将）
  const clanBusho = [...state.bushoCatalog.values()].filter(
    (b) => b.clanId === clanId && b.id !== leader.id,
  )
  const spymaster =
    clanBusho.length > 0
      ? clanBusho.reduce((best, b) =>
          b.intelligence > best.intelligence ? b : best,
        )
      : null
  const intrigueAgent = spymaster ?? leader
  const agentIntelligence = intrigueAgent.intelligence

  // 担当者名を表示（当主以外の場合）
  if (intrigueAgent.id !== leader.id) {
    changes.push(`謀略担当: ${intrigueAgent.name}（知略${agentIntelligence}）`)
  }

  const costs: Record<IntrigueAction['type'], number> = {
    bribe: 500,
    assassinate: 1000,
    spread_rumor: 200,
    incite_rebellion: 800,
  }
  clan.gold = Math.max(0, clan.gold - costs[action.type])

  // 担当者の知略で成功率が変動（知略50で+0%、100で+25%）
  const intelligenceBonus = (agentIntelligence - 50) / 200
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
          // 基本低下量 15〜25 + 謀略担当者の知略ボーナス（知略50で+0、100で+10）
          const baseDrop = 15 + Math.floor(Math.random() * 11) // 15〜25
          const intelligenceBonus = Math.floor((agentIntelligence - 50) / 5) // 0〜10
          const loyaltyDrop = Math.floor((baseDrop + intelligenceBonus) * effectMultiplier)
          target.emotions.loyalty -= loyaltyDrop
          target.emotions.discontent += Math.floor((10 + Math.random() * 10) * effectMultiplier)

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

            // 城主だった場合、城ごと寝返る！
            let castleDefected = false
            for (const [, castle] of state.castleCatalog) {
              if (
                castle.castellanId === target.id &&
                castle.ownerId === originalClanId
              ) {
                // 城を奪取
                if (originalClan) {
                  originalClan.castleIds = originalClan.castleIds.filter(
                    (id) => id !== castle.id,
                  )
                }
                castle.ownerId = clanId
                clan.castleIds.push(castle.id)
                castleDefected = true

                // 怨恨を記録
                const grudge: GrudgeEvent = {
                  id: `grudge_${state.turn}_${clanId}_${originalClanId}_defection`,
                  turn: state.turn,
                  actorId: clanId,
                  targetId: originalClanId || '',
                  type: 'betrayal',
                  description: `${target.name}が${castle.name}ごと寝返り`,
                  emotionImpact: { respect: -30, discontent: 40 },
                }
                state.grudgeHistory.push(grudge)

                if (grade === 'critical_success') {
                  changes.push(
                    `【大成功】${target.name}が${castle.name}ごと寝返った！`,
                  )
                } else {
                  changes.push(
                    `${target.name}が${castle.name}ごと寝返り！（兵${castle.soldiers}も獲得）`,
                  )
                }
                break // 1人の城主は1城のみ
              }
            }

            if (!castleDefected) {
              if (grade === 'critical_success') {
                changes.push(
                  `【大成功】${target.name}が寝返った！我が軍の配下に`,
                )
              } else {
                changes.push(`${target.name}が寝返り！`)
              }
            }
          } else if (grade === 'critical_success') {
            changes.push(
              `【大成功】${target.name}が完全に心変わり！（忠誠が${target.emotions.loyalty}に低下）`,
            )
          } else {
            changes.push(
              `${target.name}を買収、忠誠が${loyaltyDrop}低下し${target.emotions.loyalty}に`,
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
        case 'spread_rumor': {
          // 不満増加 20〜35 + 知略ボーナス
          const rumorEffect = 20 + Math.floor(Math.random() * 16) + Math.floor((agentIntelligence - 50) / 10)
          target.emotions.discontent += Math.floor(rumorEffect * effectMultiplier)
          if (grade === 'critical_success') {
            changes.push(`【大成功】${target.name}の悪評が広まり、家中大混乱！`)
          } else {
            changes.push(`${target.name}に関する流言が広まった（不満+${Math.floor(rumorEffect * effectMultiplier)}）`)
          }
          break
        }
        case 'incite_rebellion': {
          // 忠誠低下 25〜40、不満増加 25〜40 + 知略ボーナス
          const rebellionLoyaltyDrop = 25 + Math.floor(Math.random() * 16) + Math.floor((agentIntelligence - 50) / 10)
          const rebellionDiscontent = 25 + Math.floor(Math.random() * 16) + Math.floor((agentIntelligence - 50) / 10)
          target.emotions.loyalty -= Math.floor(rebellionLoyaltyDrop * effectMultiplier)
          target.emotions.discontent += Math.floor(rebellionDiscontent * effectMultiplier)
          if (grade === 'critical_success') {
            changes.push(`【大成功】${target.name}が謀反を決意！`)
          } else {
            changes.push(`${target.name}に謀反を唆した（忠誠-${Math.floor(rebellionLoyaltyDrop * effectMultiplier)}）`)
          }
          break
        }
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
