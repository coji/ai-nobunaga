// ナレーション生成・家臣コメント生成

import type { GameState, ResultGrade } from '../types.js'
import { ai, MODEL_LITE } from './client.js'

// === ナレーション生成 ===

/** 行動結果のナレーションを生成 */
export async function generateNarrative(
  leaderName: string,
  action: string,
  result: string,
  success: boolean,
): Promise<string> {
  const prompt = `あなたは戦国時代の軍師です。以下の行動結果を、大名${leaderName}に報告する形式で、戦国時代らしい口調で簡潔に伝えてください（80文字以内）。

行動: ${action}
結果: ${result}
成功: ${success ? '成功' : '失敗'}

【重要】
- 数字は必ずアラビア数字（1234）で書くこと。漢数字（一二三四）は使わない。
- 「忠誠が低下」「忠誠が○○に低下」は主君への忠誠が下がったことを意味する。「上昇」ではなく「低下」と報告せよ。
- 調略（買収）が成功した場合、対象の忠誠は必ず「低下」する（主君から心が離れる）。

例: ×「二千百三十六の兵」 → ○「2136の兵」
例: 忠誠が20低下 → 「忠誠心が揺らぎ、主君への想いが薄れた」

報告文のみを出力してください。`

  try {
    const response = await ai.models.generateContent({
      model: MODEL_LITE,
      contents: prompt,
    })
    return response.text ?? result
  } catch {
    return result
  }
}

// === 家臣コメント生成 ===

export interface RetainerComment {
  bushoName: string
  comment: string
  emotion: 'praise' | 'concern' | 'neutral' | 'angry' | 'relieved'
}

/** 行動結果に対して、評定で発言した家臣がコメントを返す */
export async function generateRetainerComments(
  state: GameState,
  clanId: string,
  actionDescription: string,
  resultDescription: string,
  grade: ResultGrade,
  supporters: string[],
  opponents: string[],
): Promise<RetainerComment[]> {
  // 発言対象の家臣（賛成者・反対者から選ぶ）
  const commenters: { name: string; wasSupporter: boolean }[] = []

  // 大成功・大失敗時は反応するキャラを増やす
  const maxCommenters =
    grade === 'critical_success' || grade === 'critical_failure' ? 2 : 1

  // 賛成者から（成功時は喜び、失敗時は落胆）
  for (const name of supporters.slice(0, maxCommenters)) {
    commenters.push({ name, wasSupporter: true })
  }
  // 反対者から（失敗時は「だから言ったのに」）
  if (grade === 'failure' || grade === 'critical_failure') {
    for (const name of opponents.slice(0, 1)) {
      if (!commenters.some((c) => c.name === name)) {
        commenters.push({ name, wasSupporter: false })
      }
    }
  }

  if (commenters.length === 0) {
    return []
  }

  const results: RetainerComment[] = []

  for (const commenter of commenters) {
    // 武将情報を取得
    const busho = Object.values(state.bushoCatalog).find(
      (b) => b.name === commenter.name && b.clanId === clanId,
    )
    if (!busho) continue

    const gradeText =
      grade === 'critical_success'
        ? '大成功'
        : grade === 'critical_failure'
          ? '大失敗'
          : grade === 'success'
            ? '成功'
            : '失敗'

    const stanceText = commenter.wasSupporter ? '賛成していた' : '反対していた'

    const prompt = `あなたは戦国武将「${busho.name}」です。
性格: ${busho.personality.join('、')}

評定で「${actionDescription}」という案に${stanceText}。
結果: ${resultDescription}（${gradeText}）

この結果に対する短い反応を戦国時代らしい口調で述べよ（25文字以内）。
例:
- 大成功で賛成者→「見事！これぞ天佑」「殿の御英断、流石にございます」
- 大失敗で賛成者→「申し訳ございませぬ…」「これは痛恨の極み」
- 失敗で反対者→「だから申したのに…」「予見通りでござる」
- 成功で反対者→「ふむ、見誤ったか」「これは認めねばなりませぬ」

JSON形式で出力:
\`\`\`json
{"comment": "コメント", "emotion": "praise|concern|neutral|angry|relieved"}
\`\`\``

    try {
      const response = await ai.models.generateContent({
        model: MODEL_LITE,
        contents: prompt,
      })

      const text = response.text ?? ''
      const jsonMatch =
        text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(jsonMatch?.[1] || jsonMatch?.[0] || '{}')

      results.push({
        bushoName: busho.name,
        comment: parsed.comment || '……。',
        emotion: parsed.emotion || 'neutral',
      })
    } catch {
      // 失敗時はデフォルトコメント
      const defaultComments: Record<
        ResultGrade,
        { supporter: string; opponent: string }
      > = {
        critical_success: {
          supporter: '見事にございます！',
          opponent: 'これは驚きました',
        },
        success: { supporter: 'よろしゅうございました', opponent: 'ふむ…' },
        failure: {
          supporter: '残念でございます',
          opponent: 'だから申したのに',
        },
        critical_failure: {
          supporter: '申し訳ございませぬ…',
          opponent: '予見通りでござる',
        },
      }
      results.push({
        bushoName: busho.name,
        comment: commenter.wasSupporter
          ? defaultComments[grade].supporter
          : defaultComments[grade].opponent,
        emotion: commenter.wasSupporter
          ? grade === 'critical_success' || grade === 'success'
            ? 'praise'
            : 'concern'
          : grade === 'failure' || grade === 'critical_failure'
            ? 'neutral'
            : 'relieved',
      })
    }
  }

  return results
}
