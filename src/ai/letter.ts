// 書状生成

import type { GameState, Letter } from '../types.js'
import { ai, MODEL } from './client.js'

/** 書状を生成する */
export async function generateLetter(
  state: GameState,
  fromClanId: string,
  toClanId: string,
  purpose: 'propose_alliance' | 'threaten' | 'respond_to_letter',
  context?: string,
): Promise<Letter> {
  const fromClan = state.clanCatalog[fromClanId]
  if (!fromClan) {
    throw new Error(`Clan not found: ${fromClanId}`)
  }
  const toClan = state.clanCatalog[toClanId]
  if (!toClan) {
    throw new Error(`Clan not found: ${toClanId}`)
  }
  const fromLeader = state.bushoCatalog[fromClan.leaderId]
  if (!fromLeader) {
    throw new Error(`Leader not found: ${fromClan.leaderId}`)
  }
  const toLeader = state.bushoCatalog[toClan.leaderId]
  if (!toLeader) {
    throw new Error(`Leader not found: ${toClan.leaderId}`)
  }

  const relation = state.diplomacyRelations.find(
    (r) =>
      (r.clan1Id === fromClanId && r.clan2Id === toClanId) ||
      (r.clan1Id === toClanId && r.clan2Id === fromClanId),
  )

  const purposeDesc =
    purpose === 'propose_alliance'
      ? '同盟を申し入れる'
      : purpose === 'threaten'
        ? '威嚇・警告する'
        : '返書を書く'

  const prompt = `あなたは戦国時代の大名「${fromLeader.name}」として書状を書きます。

性格: ${fromLeader.personality.join(', ')}
目的: ${purposeDesc}
送り先: ${toClan.name}の${toLeader.name}殿（関係: ${relation?.type || 'neutral'}）
状況: ${context || `ターン${state.turn}`}

JSON形式のみで出力:
\`\`\`json
{
  "greeting": "冒頭の儀礼文",
  "body": "本題",
  "closing": "末尾の余韻",
  "summary": "要約（30文字以内）"
}
\`\`\``

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {},
    })

    const text = response.text ?? ''
    const jsonMatch =
      text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch?.[1] || jsonMatch?.[0] || '{}')

    return {
      id: `letter_${state.turn}_${fromClanId}_${toClanId}`,
      turn: state.turn,
      fromClanId,
      toClanId,
      greeting: parsed.greeting || '謹んで申し上げます。',
      body: parsed.body || '（本文）',
      closing: parsed.closing || '何卒よしなに。',
      proposedTerms:
        purpose === 'propose_alliance'
          ? { type: 'propose_alliance', conditions: { duration: 12 } }
          : null,
      summary: parsed.summary || '（要約）',
    }
  } catch (e) {
    console.error('Letter generation error:', e)
    return {
      id: `letter_${state.turn}_${fromClanId}_${toClanId}`,
      turn: state.turn,
      fromClanId,
      toClanId,
      greeting: '謹んで申し上げます。',
      body: '（書状の生成に失敗しました）',
      closing: '何卒よしなに。',
      proposedTerms: null,
      summary: '（エラー）',
    }
  }
}
