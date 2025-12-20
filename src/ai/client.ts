// Gemini AI クライアント

import { GoogleGenAI } from '@google/genai'
import { isUsageTrackingEnabled, recordUsage } from './usage.js'

const baseAi = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY ?? '',
})

// モデル設定（flash-liteはthinking非対応）
export const MODEL = 'gemini-flash-lite-latest' // メイン（評定、書状など）
export const MODEL_LITE = 'gemini-flash-lite-latest' // 軽量（AI大名ターン、状況報告）

// 使用量トラッキング付きのラッパー
export const ai = {
  models: {
    generateContent: async (
      params: Parameters<typeof baseAi.models.generateContent>[0],
    ) => {
      const response = await baseAi.models.generateContent(params)

      // 使用量を記録
      if (isUsageTrackingEnabled() && response.usageMetadata) {
        const model =
          typeof params === 'object' && 'model' in params
            ? (params.model as string)
            : 'unknown'
        recordUsage(
          model,
          response.usageMetadata.promptTokenCount ?? 0,
          response.usageMetadata.candidatesTokenCount ?? 0,
        )
      }

      return response
    },
  },
}
