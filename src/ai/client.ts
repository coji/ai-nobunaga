// Gemini AI クライアント

import { GoogleGenAI, ThinkingLevel } from '@google/genai'

export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY ?? '',
})

// モデル設定
export const MODEL = 'gemini-3-flash-preview' // メイン（評定、書状など）
export const MODEL_LITE = 'gemini-flash-lite-latest' // 軽量（AI大名ターン、状況報告）

// 用途別のthinking_level設定（MODEL用、MODEL_LITEはthinking非対応）
export const THINKING = {
  // プレイヤーコマンド解釈
  PLAYER_COMMAND: ThinkingLevel.LOW,
  // 評定議論
  COUNCIL: ThinkingLevel.LOW,
  // 書状生成
  LETTER: ThinkingLevel.LOW,
}
