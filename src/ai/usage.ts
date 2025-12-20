// LLM使用量トラッキング

/** モデル別の料金（USD per 1M tokens）
 * 参照: https://ai.google.dev/gemini-api/docs/pricing
 */
const PRICING = {
  // gemini-3-flash-preview (MODEL)
  'gemini-3-flash-preview': {
    input: 0.5, // $0.50 per 1M input tokens
    output: 3.0, // $3.00 per 1M output tokens
  },
  // gemini-flash-lite-latest (MODEL_LITE)
  'gemini-flash-lite-latest': {
    input: 0.075, // $0.075 per 1M input tokens
    output: 0.3, // $0.30 per 1M output tokens
  },
  // gemini-2.0-flash（フォールバック用）
  'gemini-2.0-flash': {
    input: 0.1, // $0.10 per 1M input tokens
    output: 0.4, // $0.40 per 1M output tokens
  },
  // デフォルト（gemini-2.0-flash相当）
  default: {
    input: 0.1,
    output: 0.4,
  },
} as const

/** 使用量の記録 */
export interface UsageRecord {
  model: string
  inputTokens: number
  outputTokens: number
  timestamp: Date
}

/** 累計使用量 */
export interface UsageSummary {
  totalInputTokens: number
  totalOutputTokens: number
  totalCostUSD: number
  callCount: number
  byModel: Record<
    string,
    {
      inputTokens: number
      outputTokens: number
      costUSD: number
      callCount: number
    }
  >
}

// グローバルな使用量トラッカー
let usageRecords: UsageRecord[] = []
let isTrackingEnabled = false

/** トラッキングを有効化 */
export function enableUsageTracking(): void {
  isTrackingEnabled = true
}

/** トラッキングを無効化 */
export function disableUsageTracking(): void {
  isTrackingEnabled = false
}

/** トラッキングが有効かどうか */
export function isUsageTrackingEnabled(): boolean {
  return isTrackingEnabled
}

/** 使用量を記録 */
export function recordUsage(
  model: string,
  inputTokens: number,
  outputTokens: number,
): void {
  if (!isTrackingEnabled) return

  usageRecords.push({
    model,
    inputTokens,
    outputTokens,
    timestamp: new Date(),
  })
}

/** コストを計算 */
function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing =
    PRICING[model as keyof typeof PRICING] || PRICING.default
  const inputCost = (inputTokens / 1_000_000) * pricing.input
  const outputCost = (outputTokens / 1_000_000) * pricing.output
  return inputCost + outputCost
}

/** 累計使用量を取得 */
export function getUsageSummary(): UsageSummary {
  const byModel: UsageSummary['byModel'] = {}

  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalCostUSD = 0

  for (const record of usageRecords) {
    totalInputTokens += record.inputTokens
    totalOutputTokens += record.outputTokens

    let modelStats = byModel[record.model]
    if (!modelStats) {
      modelStats = {
        inputTokens: 0,
        outputTokens: 0,
        costUSD: 0,
        callCount: 0,
      }
      byModel[record.model] = modelStats
    }

    modelStats.inputTokens += record.inputTokens
    modelStats.outputTokens += record.outputTokens
    modelStats.callCount += 1

    const cost = calculateCost(
      record.model,
      record.inputTokens,
      record.outputTokens,
    )
    modelStats.costUSD += cost
    totalCostUSD += cost
  }

  return {
    totalInputTokens,
    totalOutputTokens,
    totalCostUSD,
    callCount: usageRecords.length,
    byModel,
  }
}

/** 使用量をリセット */
export function resetUsage(): void {
  usageRecords = []
}

/** 使用量を文字列でフォーマット */
export function formatUsageSummary(): string {
  const summary = getUsageSummary()

  if (summary.callCount === 0) {
    return 'LLM使用量: 0回'
  }

  const lines: string[] = []
  lines.push(`LLM使用量: ${summary.callCount}回`)
  lines.push(
    `  入力: ${summary.totalInputTokens.toLocaleString()}トークン`,
  )
  lines.push(
    `  出力: ${summary.totalOutputTokens.toLocaleString()}トークン`,
  )
  lines.push(`  推定コスト: $${summary.totalCostUSD.toFixed(4)}`)

  return lines.join('\n')
}
