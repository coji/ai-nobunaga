// ゲームコアデータ型定義

// === 武将関連 ===

/** 固定性格タグ（生涯ほぼ変わらない傾向） */
export type PersonalityTag =
  | '権威主義' // 家格・名声を重視
  | '実利優先' // 実益・効率を重視
  | '義理重視' // 約束・恩義を重視
  | '猜疑心' // 他者を疑いやすい
  | '野心家' // 上昇志向が強い
  | '保守的' // 変化を嫌う
  | '革新的' // 新しいことを好む
  | '残虐' // 手段を選ばない
  | '慈悲深い' // 寛大な処置を好む

/** 可変感情（イベントで上下する） */
export interface Emotions {
  loyalty: number // 忠誠心 (0-100)
  fear: number // 恐怖 (0-100)
  respect: number // 尊敬 (0-100)
  discontent: number // 不満 (0-100)
}

/** 武将 */
export interface Busho {
  id: string
  name: string
  // 能力値
  politics: number // 政治 (1-100)
  warfare: number // 武勇 (1-100)
  intelligence: number // 知略 (1-100)
  charisma: number // 魅力 (1-100)
  // 性格・感情
  personality: PersonalityTag[]
  emotions: Emotions
  // 所属
  clanId: string | null // 所属勢力
  factionId: string | null // 所属派閥
}

// === 勢力関連 ===

/** 派閥（武将の集合体、共通の利害を持つ） */
export interface Faction {
  id: string
  name: string
  clanId: string
  description: string // 共通の利害を一文で
  memberIds: string[]
}

/** 勢力（大名家） */
export interface Clan {
  id: string
  name: string
  leaderId: string // 当主の武将ID
  gold: number // 金銭
  food: number // 兵糧
  castleIds: string[]
}

// === 城・領地関連 ===

/** 城 */
export interface Castle {
  id: string
  name: string
  ownerId: string // 所有勢力ID
  castellanId: string | null // 城主（武将ID）
  soldiers: number // 兵数
  defense: number // 防御力 (1-100)
  agriculture: number // 農業力 (1-100) - 兵糧生産
  commerce: number // 商業力 (1-100) - 金収入
  loyalty: number // 民忠 (1-100) - 低いと一揆発生、収入減少
  // 隣接する城ID
  adjacentCastleIds: string[]
}

// === 怨恨・履歴関連 ===

/** イベントタイプ */
export type EventType =
  | 'betrayal' // 裏切り
  | 'attack' // 攻撃
  | 'alliance_break' // 同盟破棄
  | 'territory_loss' // 領土喪失
  | 'family_killed' // 一族殺害
  | 'insult' // 侮辱
  | 'aid' // 援助
  | 'saved' // 救援

/** 怨恨・恩義の履歴 */
export interface GrudgeEvent {
  id: string
  turn: number
  actorId: string // 行為者（勢力or武将ID）
  targetId: string // 対象（勢力or武将ID）
  type: EventType
  description: string
  emotionImpact: Partial<Emotions>
}

// === 外交関連 ===

/** 外交関係タイプ */
export type DiplomacyType = 'alliance' | 'truce' | 'hostile' | 'neutral'

/** 外交関係 */
export interface DiplomacyRelation {
  clan1Id: string
  clan2Id: string
  type: DiplomacyType
  expirationTurn: number | null // 期限（同盟・停戦用）
}

// === AI行動計画関連 ===

/** 行動カテゴリ */
export type ActionCategory = '内政' | '外交' | '軍事' | '謀略'

/** 基本行動 */
export interface BaseAction {
  category: ActionCategory
  targetId: string // 対象（城・勢力・武将などのID）
  intent: string // 人間向けログ用の短い文章
  riskTolerance: number // リスク許容度 (0-1)
}

/** 内政行動 */
export interface DomesticAction extends BaseAction {
  category: '内政'
  type: 'develop_agriculture' | 'develop_commerce'
  value: number // 投資量など
}

/** 外交行動 */
export interface DiplomacyAction extends BaseAction {
  category: '外交'
  type: 'propose_alliance' | 'break_alliance' | 'send_gift' | 'threaten'
  conditions?: {
    goldOffered?: number
    territoryOffered?: string[]
    duration?: number
  }
}

/** 軍事行動 */
export interface MilitaryAction extends BaseAction {
  category: '軍事'
  type: 'recruit_soldiers' | 'fortify' | 'attack'
  soldierCount?: number
  fromCastleId?: string
  value?: number // 投資量（徴兵数、修築費用など）
}

/** 謀略行動 */
export interface IntrigueAction extends BaseAction {
  category: '謀略'
  type: 'bribe' | 'assassinate' | 'spread_rumor' | 'incite_rebellion'
}

export type GameAction =
  | DomesticAction
  | DiplomacyAction
  | MilitaryAction
  | IntrigueAction

/** AIの行動計画（1ターン1勢力） */
export interface ActionPlan {
  clanId: string
  turn: number
  actions: GameAction[]
}

// === 書状関連 ===

/** 書状の三層構造 */
export interface Letter {
  id: string
  turn: number
  fromClanId: string
  toClanId: string
  // 三層構造
  greeting: string // 冒頭：儀礼文
  body: string // 中段：本題
  closing: string // 末尾：余韻
  // 実際の契約条件（JSON形式で別途）
  proposedTerms: {
    type: DiplomacyAction['type']
    conditions?: DiplomacyAction['conditions']
  } | null
  // メタ情報
  summary: string // プレイヤー向け要約
}

// === ゲーム状態 ===

export interface GameState {
  turn: number
  bushoCatalog: Map<string, Busho>
  clanCatalog: Map<string, Clan>
  castleCatalog: Map<string, Castle>
  factionCatalog: Map<string, Faction>
  diplomacyRelations: DiplomacyRelation[]
  grudgeHistory: GrudgeEvent[]
  letters: Letter[]
  playerClanId: string
}

// === 行動結果 ===

// 結果のグレード: critical_failure(大失敗), failure(失敗), success(成功), critical_success(大成功)
export type ResultGrade =
  | 'critical_failure'
  | 'failure'
  | 'success'
  | 'critical_success'

export interface ActionResult {
  success: boolean
  grade: ResultGrade // 大成功・大失敗判定
  action: GameAction
  message: string
  stateChanges: string[]
}
