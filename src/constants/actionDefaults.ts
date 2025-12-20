// 行動パラメータのデフォルト値
// プレイヤー・AI大名・評定で統一して使用する

/** 行動実行時のデフォルトパラメータ（全員共通） */
export const ACTION_DEFAULTS = {
  /** 徴兵 */
  RECRUIT: {
    /** 金の何割を使うか */
    GOLD_RATIO: 1 / 3,
    /** 上限人数 */
    MAX_COUNT: 500,
  },
  /** 開発（農業・商業・城壁） */
  DEVELOP: {
    /** デフォルト投資額 */
    INVESTMENT: 500,
  },
  /** 攻撃 */
  ATTACK: {
    /** 出撃城の何割を派遣 */
    SOLDIER_RATIO: 0.7,
  },
  /** 外交 */
  DIPLOMACY: {
    /** 贈り物デフォルト金額 */
    GIFT_AMOUNT: 300,
  },
  /** 謀略 */
  INTRIGUE: {
    /** 調略デフォルト金額 */
    BRIBE_AMOUNT: 500,
  },
} as const

/** AI大名の意思決定用閾値 */
export const AI_THRESHOLDS = {
  /** これ以下の兵力なら徴兵を優先 */
  MIN_SOLDIERS_FOR_RECRUIT: 500,
  /** これ以下の金なら開発を優先 */
  MIN_GOLD_FOR_DEVELOP: 1000,
  /** これ以上の兵力があれば攻撃を検討 */
  MIN_SOLDIERS_FOR_ATTACK: 3000,
  /** 敵の何倍あれば攻撃実行 */
  POWER_RATIO_FOR_ATTACK: 1.2,
  /** 徴兵に必要な最小金額 */
  MIN_GOLD_FOR_RECRUIT: 300,
} as const

/** 評定固有の設定 */
export const COUNCIL_CONFIG = {
  /** 議論参加人数上限 */
  MAX_RETAINERS: 4,
  /** 代表者数 */
  REPRESENTATIVES: 2,
  /** 他武将に話をふる確率 */
  DELEGATION_CHANCE: 0.3,
  /** 能力が高いと判定する閾値 */
  EXPERTISE_THRESHOLD: 80,
} as const
