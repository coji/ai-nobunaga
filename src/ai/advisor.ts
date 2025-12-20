// 軍師AI - 各モジュールの再エクスポート
//
// advisor.ts は以下のモジュールに分割されました:
// - council.ts: 評定（複数武将による議論）
// - letter.ts: 書状生成
// - narrative.ts: ナレーション生成・家臣コメント

// 評定関連
export {
  askMilitaryAdvisor,
  conductCouncilRound,
  holdCouncil,
  summarizeCouncilProposals,
  type ActionHistoryEntry,
  type CouncilOpinion,
  type CouncilProposal,
  type CouncilStatement,
} from './council.js'

// 書状生成
export { generateLetter } from './letter.js'

// ナレーション・家臣コメント
export {
  generateNarrative,
  generateRetainerComments,
  type RetainerComment,
} from './narrative.js'
