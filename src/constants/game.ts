// ゲームバランス定数
// 全てのゲームバランスに関わる数値を一元管理

/** クリティカル判定 */
export const CRITICAL = {
  /** クリティカル発生確率 */
  RATE: 0.15,
  /** 大成功時の基本倍率 */
  SUCCESS_MULTIPLIER_MIN: 1.5,
  /** 大成功時の追加倍率（ランダム上乗せ） */
  SUCCESS_MULTIPLIER_BONUS: 0.5,
  /** 大失敗時の基本倍率 */
  FAILURE_MULTIPLIER: 0.5,
  /** 大失敗時のペナルティ倍率（最小） */
  FAILURE_PENALTY_MIN: 0.5,
  /** 大失敗時のペナルティ倍率（最大追加） */
  FAILURE_PENALTY_BONUS: 1.0,
} as const

/** 軍事関連 */
export const MILITARY = {
  /** 徴兵コスト（1人あたり） */
  RECRUIT_COST_PER_SOLDIER: 2,
  /** 徴兵時の民忠低下（最小） */
  RECRUIT_LOYALTY_DROP_MIN: 5,
  /** 徴兵時の民忠低下（追加ランダム） */
  RECRUIT_LOYALTY_DROP_BONUS: 5,
  /** 攻撃側勝利時の生存率 */
  ATTACK_SURVIVOR_RATE: 0.7,
  /** 攻撃側敗北時の損失率 */
  ATTACK_LOSS_RATE: 0.8,
  /** 防御側敗北時の損失率 */
  DEFENSE_LOSS_RATE: 0.3,
  /** 占領直後の民忠 */
  OCCUPATION_LOYALTY: 30,
  /** 防御側最低兵力（攻撃後） */
  MIN_SOLDIERS_AFTER_ATTACK: 100,
  /** AI攻撃時の出兵率 */
  AI_ATTACK_FORCE_RATIO: 0.7,
} as const

/** 内政関連 */
export const DOMESTIC = {
  /** 農業開発の効率（投資額÷この値=成長値） */
  AGRICULTURE_INVESTMENT_DIVISOR: 50,
  /** 商業開発の効率（投資額÷この値=成長値） */
  COMMERCE_INVESTMENT_DIVISOR: 50,
  /** 城壁修築の効率（投資額÷この値=成長値） */
  FORTIFY_INVESTMENT_DIVISOR: 100,
  /** パラメータ上限 */
  PARAMETER_MAX: 100,
} as const

/** 外交関連 */
export const DIPLOMACY = {
  /** 同盟の基本成功率 */
  ALLIANCE_BASE_SUCCESS_RATE: 0.5,
  /** 同盟成功率の最小値 */
  ALLIANCE_SUCCESS_RATE_MIN: 0.05,
  /** 同盟成功率の最大値 */
  ALLIANCE_SUCCESS_RATE_MAX: 0.95,
  /** 同盟の継続ターン */
  ALLIANCE_DURATION: 10,
  /** 停戦の継続ターン */
  TRUCE_DURATION: 5,
  /** 威嚇成功に必要な兵力比 */
  THREATEN_POWER_RATIO_THRESHOLD: 1.5,
  /** 贈り物で敵対解除に必要な金額 */
  GIFT_HOSTILE_RESET_AMOUNT: 500,
} as const

/** 謀略関連 */
export const INTRIGUE = {
  /** 暗殺コスト */
  ASSASSINATE_COST: 500,
  /** 暗殺の基本成功率 */
  ASSASSINATE_BASE_RATE: 0.2,
  /** 暗殺成功率の上限 */
  ASSASSINATE_MAX_RATE: 0.5,
  /** 調略の最大成功率 */
  BRIBE_MAX_SUCCESS_RATE: 0.9,
  /** 調略計算用の金額係数 */
  BRIBE_GOLD_FACTOR_DIVISOR: 1000,
  /** 調略失敗時の忠誠度上昇 */
  BRIBE_FAILURE_LOYALTY_BOOST: 10,
  /** 調略成功時の初期忠誠度 */
  BRIBE_SUCCESS_INITIAL_LOYALTY: 50,
} as const

/** ターン処理 */
export const TURN = {
  /** 兵士1人あたりの兵糧消費 */
  FOOD_CONSUMPTION_PER_SOLDIER: 0.2,
  /** 城主ボーナスの基本値 */
  CASTELLAN_BONUS_BASE: 0.8,
  /** 城主ボーナスの政治係数 */
  CASTELLAN_BONUS_POLITICS_DIVISOR: 250,
  /** 反乱発生確率（民忠0の時） */
  REBELLION_CHANCE: 0.3,
  /** 兵糧不足時の兵士減少率 */
  FOOD_SHORTAGE_SOLDIER_LOSS_RATE: 0.1,
  /** 兵糧不足時の最低残存兵力 */
  FOOD_SHORTAGE_MIN_SOLDIERS: 100,
} as const

/** 感情・怨恨 */
export const EMOTIONS = {
  /** 裏切り時の忠誠度への影響 */
  BETRAYAL_LOYALTY_IMPACT: -20,
  /** 裏切り時の不満への影響 */
  BETRAYAL_DISCONTENT_IMPACT: 30,
  /** 領土喪失時の忠誠度への影響 */
  TERRITORY_LOSS_LOYALTY_IMPACT: -10,
  /** 領土喪失時の不満への影響 */
  TERRITORY_LOSS_DISCONTENT_IMPACT: 20,
  /** 暗殺時の忠誠度への影響 */
  ASSASSINATION_LOYALTY_IMPACT: -30,
  /** 暗殺時の不満への影響 */
  ASSASSINATION_DISCONTENT_IMPACT: 50,
} as const
