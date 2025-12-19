// Gemini AI クライアント

import { GoogleGenAI, ThinkingLevel } from '@google/genai'

export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY ?? '',
})

// Gemini 3 Flash Preview
export const MODEL = 'gemini-3-flash-preview'

// 用途別のthinking_level設定
export const THINKING = {
  // AI大名ターン: シンプルな判断、高速
  AI_TURN: ThinkingLevel.MINIMAL,
  // プレイヤーコマンド解釈: 中程度の推論
  PLAYER_COMMAND: ThinkingLevel.LOW,
  // 評定議論: しっかり推論
  COUNCIL: ThinkingLevel.MEDIUM,
  // 書状生成: 文章生成、高速でOK
  LETTER: ThinkingLevel.LOW,
}
