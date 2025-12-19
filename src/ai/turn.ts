// AIターン・プレイヤーコマンド実行

import type { GameState, PersonalityTag } from '../types.js'
import { ai, MODEL, MODEL_LITE, THINKING } from './client.js'
import { executeToolCall } from './executor.js'
import {
  buildGameContextPrompt,
  buildPlayerCommandSystemPrompt,
} from './prompts.js'
import { gameTools } from './tools.js'

// 性格に基づく行動傾向ヒントを生成
function getPersonalityHints(personality: PersonalityTag[]): string {
  const hints: string[] = []

  // 実利優先 → 内政重視
  if (personality.includes('実利優先')) {
    hints.push('内政開発（agriculture/commerce）を優先せよ。攻撃は兵力に余裕がある時のみ。')
  }

  // 義理重視 → 外交・同盟重視
  if (personality.includes('義理重視')) {
    hints.push('diplomacyで同盟を結び、信頼を築け。不義の攻撃は避けよ。')
  }

  // 野心家 → 積極的だが準備も怠らない
  if (personality.includes('野心家')) {
    hints.push('領土拡大を目指せ。ただし勝てる戦のみ挑め。兵力不足なら徴兵せよ。')
  }

  // 猜疑心 → 防衛・徴兵重視
  if (personality.includes('猜疑心')) {
    hints.push('防衛を固めよ（fortify）。兵力を蓄え、守りを万全に。')
  }

  // 権威主義 → バランス型だが見栄えを気にする
  if (personality.includes('権威主義')) {
    hints.push('国力を充実させよ。商業発展で富を示し、兵で威を示せ。')
  }

  // 保守的 → 現状維持・防衛優先
  if (personality.includes('保守的')) {
    hints.push('軽挙妄動を避けよ。内政を固め、守りを万全にせよ。攻撃は慎重に。')
  }

  // 革新的 → 積極的な開発
  if (personality.includes('革新的')) {
    hints.push('新しき技術と商業で国を富ませよ。agriculture や commerce を発展させよ。')
  }

  // 性格がない場合のデフォルト
  if (hints.length === 0) {
    hints.push('状況を見極めて行動せよ。')
  }

  return `行動指針: ${hints.join(' ')}`
}

// === AI大名のターン実行 ===

export interface AITurnResult {
  actions: {
    tool: string
    args: Record<string, unknown>
    narrative: string
    success: boolean
  }[]
  summary: string
}

export async function executeAITurn(
  state: GameState,
  clanId: string,
): Promise<AITurnResult> {
  const clan = state.clanCatalog.get(clanId)
  if (!clan) {
    throw new Error(`Clan not found: ${clanId}`)
  }
  const leader = state.bushoCatalog.get(clan.leaderId)
  if (!leader) {
    throw new Error(`Leader not found: ${clan.leaderId}`)
  }

  const results: AITurnResult['actions'] = []

  // 自軍の城IDを取得
  const ownCastleIds = clan.castleIds
  const firstCastleId = ownCastleIds[0] || ''

  // 隣接する敵城を取得
  const attackTargets: { from: string; to: string }[] = []
  for (const castleId of ownCastleIds) {
    const castle = state.castleCatalog.get(castleId)
    if (!castle) continue
    for (const adjId of castle.adjacentCastleIds) {
      const adj = state.castleCatalog.get(adjId)
      if (adj && adj.ownerId !== clanId) {
        attackTargets.push({ from: castleId, to: adjId })
      }
    }
  }

  // 性格に基づく行動傾向を決定
  const personalityHints = getPersonalityHints(leader.personality)

  // シンプルなプロンプトで1回のLLM呼び出しに最適化
  const systemPrompt = `戦国AI大名「${leader.name}」として、1つの行動を選べ。
性格: ${leader.personality.join(', ')}
${personalityHints}
JSONで返答: {"action":"recruit|develop|attack|diplomacy|none","params":{...}}
- recruit: {"castleId":"${firstCastleId}","count":500} 兵を徴募
- develop: {"castleId":"${firstCastleId}","type":"agriculture"} 開発（type: agriculture/commerce/defense）
- attack: {"fromCastleId":"出撃城ID","targetCastleId":"敵城ID","soldierCount":1000} 攻撃
- diplomacy: {"targetClanId":"相手勢力ID"} 同盟提案
- none: 何もしない`

  const contextPrompt = buildGameContextPrompt(state, clanId)

  try {
    const response = await ai.models.generateContent({
      model: MODEL_LITE,
      contents: `${contextPrompt}\n\n1つの行動をJSONで選択せよ。`,
      config: {
        systemInstruction: systemPrompt,
      },
    })

    const text = response.text ?? ''

    // JSONをパース
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const decision = JSON.parse(jsonMatch[0]) as {
        action: string
        params: Record<string, unknown>
      }

      if (decision.action && decision.action !== 'none') {
        let toolName: string | null = null
        let toolParams = decision.params

        switch (decision.action) {
          case 'recruit':
            toolName = 'recruit_soldiers'
            break
          case 'develop': {
            const devType = decision.params.type as string
            if (devType === 'commerce') {
              toolName = 'develop_commerce'
            } else if (devType === 'defense') {
              toolName = 'fortify'
            } else {
              toolName = 'develop_agriculture'
            }
            toolParams = { castleId: decision.params.castleId, investment: 500 }
            break
          }
          case 'attack':
            toolName = 'attack'
            // 攻撃可能な城がなければスキップ
            if (attackTargets.length === 0) {
              toolName = null
            } else {
              // soldierCountがなければデフォルト値
              const fromCastle = state.castleCatalog.get(
                decision.params.fromCastleId as string,
              )
              const soldiers =
                (decision.params.soldierCount as number) ||
                (fromCastle ? Math.floor(fromCastle.soldiers * 0.7) : 500)
              toolParams = { ...decision.params, soldierCount: soldiers }
            }
            break
          case 'diplomacy':
            toolName = 'propose_alliance'
            break
        }

        if (toolName) {
          const { result, narrative } = executeToolCall(
            state,
            clanId,
            toolName,
            toolParams,
          )

          results.push({
            tool: toolName,
            args: toolParams,
            narrative,
            success: result?.success ?? false,
          })
        }
      }
    }
  } catch {
    // パース失敗時は何もしない
  }

  return {
    actions: results,
    summary: results.length > 0 ? '行動完了' : '様子見',
  }
}

// === プレイヤーコマンド実行 ===

export interface PlayerCommandResult {
  tool: string
  args: Record<string, unknown>
  narrative: string
  success: boolean
  aiResponse: string
}

export async function executePlayerCommand(
  state: GameState,
  clanId: string,
  command: string,
): Promise<PlayerCommandResult> {
  const clan = state.clanCatalog.get(clanId)
  if (!clan) {
    throw new Error(`Clan not found: ${clanId}`)
  }
  const leader = state.bushoCatalog.get(clan.leaderId)
  if (!leader) {
    throw new Error(`Leader not found: ${clan.leaderId}`)
  }

  const systemPrompt = buildPlayerCommandSystemPrompt(leader.name)

  const userPrompt = `${buildGameContextPrompt(state, clanId)}

## プレイヤーの指示
「${command}」

この指示を実行するために適切なツールを呼び出してください。`

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      thinkingConfig: { thinkingLevel: THINKING.PLAYER_COMMAND },
      tools: [
        {
          functionDeclarations: gameTools.filter((t) => t.name !== 'end_turn'),
        },
      ],
    },
  })

  const candidate = response.candidates?.[0]
  const part = candidate?.content?.parts?.[0]

  // テキスト応答のみの場合（ツール呼び出しなし）
  if (!part || !('functionCall' in part) || !part.functionCall) {
    const text = part && 'text' in part ? part.text : ''
    return {
      tool: 'none',
      args: {},
      narrative: '指示を理解できませんでした',
      success: false,
      aiResponse:
        text ||
        'コマンドを解釈できませんでした。もう少し具体的に指示してください。',
    }
  }

  const fc = part.functionCall
  const toolName = fc.name ?? 'unknown'
  const args = (fc.args || {}) as Record<string, unknown>

  const { result, narrative } = executeToolCall(state, clanId, toolName, args)

  // 結果に対するAIのコメントを生成
  const commentResponse = await ai.models.generateContent({
    model: MODEL_LITE,
    contents: `あなたは戦国時代の軍師です。以下の行動結果について、${leader.name}に簡潔に報告してください（50文字以内）。

行動: ${toolName}
結果: ${narrative}
成功: ${result?.success ? 'はい' : 'いいえ'}`,
  })

  return {
    tool: toolName,
    args,
    narrative,
    success: result?.success ?? false,
    aiResponse: commentResponse.text ?? narrative,
  }
}
