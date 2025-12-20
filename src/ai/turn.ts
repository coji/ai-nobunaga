// AIターン・プレイヤーコマンド実行

import { createCommand } from '../commands/index.js'
import type { GameState, PersonalityTag } from '../types.js'
import { ai, MODEL, MODEL_LITE } from './client.js'
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
    hints.push(
      '内政開発（agriculture/commerce）を優先せよ。攻撃は兵力に余裕がある時のみ。',
    )
  }

  // 義理重視 → 外交・同盟重視
  if (personality.includes('義理重視')) {
    hints.push('diplomacyで同盟を結び、信頼を築け。不義の攻撃は避けよ。')
  }

  // 野心家 → 積極的だが準備も怠らない
  if (personality.includes('野心家')) {
    hints.push(
      '領土拡大を目指せ。ただし勝てる戦のみ挑め。兵力不足なら徴兵せよ。',
    )
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
    hints.push(
      '新しき技術と商業で国を富ませよ。agriculture や commerce を発展させよ。',
    )
  }

  // 性格がない場合のデフォルト
  if (hints.length === 0) {
    hints.push('状況を見極めて行動せよ。')
  }

  return `行動指針: ${hints.join(' ')}`
}

// === AI大名のターン実行 ===

// AI行動決定の結果（実行前）
export interface AIDecision {
  toolName: string | null
  toolParams: Record<string, unknown>
}

export interface AITurnResult {
  actions: {
    tool: string
    args: Record<string, unknown>
    narrative: string
    success: boolean
  }[]
  summary: string
}

// AIの行動を決定する（実行はしない）
export async function decideAIAction(
  state: GameState,
  clanId: string,
): Promise<AIDecision> {
  const clan = state.clanCatalog[clanId]
  if (!clan) {
    throw new Error(`Clan not found: ${clanId}`)
  }
  const leader = state.bushoCatalog[clan.leaderId]
  if (!leader) {
    throw new Error(`Leader not found: ${clan.leaderId}`)
  }

  // 自軍の城IDを取得
  const ownCastleIds = clan.castleIds
  const firstCastleId = ownCastleIds[0] || ''

  // 隣接する敵城を取得
  const attackTargets: { from: string; to: string }[] = []
  for (const castleId of ownCastleIds) {
    const castle = state.castleCatalog[castleId]
    if (!castle) continue
    for (const adjId of castle.adjacentCastleIds) {
      const adj = state.castleCatalog[adjId]
      if (adj && adj.ownerId !== clanId) {
        attackTargets.push({ from: castleId, to: adjId })
      }
    }
  }

  // 性格に基づく行動傾向を決定
  const personalityHints = getPersonalityHints(leader.personality)

  // 総兵力を計算
  const totalSoldiers = ownCastleIds.reduce((sum, id) => {
    const c = state.castleCatalog[id]
    return sum + (c?.soldiers ?? 0)
  }, 0)

  // 状況に応じた推奨行動を生成
  const getRecommendedAction = (): string => {
    // 兵力が少なければ徴兵優先
    if (totalSoldiers < 300) {
      return '兵力不足。recruit で兵を増やせ。'
    }
    // 金が少なければ開発
    if (clan.gold < 500) {
      return '資金不足。develop で commerce を発展させよ。'
    }
    // 攻撃可能で兵力十分なら攻撃を検討
    const firstTarget = attackTargets[0]
    if (firstTarget && totalSoldiers >= 800) {
      const targetCastle = state.castleCatalog[firstTarget.to]
      if (targetCastle && totalSoldiers > targetCastle.soldiers * 1.5) {
        return `attack で ${targetCastle.name} を攻めるチャンス。`
      }
    }
    // 同盟国がいなければ外交
    const hasAlliance = state.diplomacyRelations.some(
      (r) =>
        r.type === 'alliance' && (r.clan1Id === clanId || r.clan2Id === clanId),
    )
    if (!hasAlliance) {
      return 'diplomacy で同盟を結べ。孤立は危険。'
    }
    // それ以外は開発
    return 'develop で国力を高めよ。'
  }

  // シンプルなプロンプトで1回のLLM呼び出しに最適化
  const systemPrompt = `戦国AI大名「${leader.name}」として、必ず1つの行動を実行せよ。
性格: ${leader.personality.join(', ')}
${personalityHints}

【重要】毎ターン必ず何かを実行せよ。様子見は弱者の証。天下を狙うなら動け。
現状分析: ${getRecommendedAction()}

JSONで返答: {"action":"recruit|develop|attack|diplomacy","params":{...}}
- recruit: {"castleId":"${firstCastleId}","count":${Math.min(500, Math.floor(clan.gold / 3))}} 兵を徴募（兵糧消費）
- develop: {"castleId":"${firstCastleId}","type":"agriculture|commerce|defense"} 開発（金500消費）
- attack: {"fromCastleId":"出撃城ID","targetCastleId":"敵城ID","soldierCount":兵数} 攻撃
- diplomacy: {"targetClanId":"相手勢力ID"} 同盟提案

※ "none" は選択不可。必ず上記4つから選べ。`

  const contextPrompt = buildGameContextPrompt(state, clanId)

  // ルールベースで行動を決定（LLMに頼らず確実に行動する）
  let toolName: string | null = null
  let toolParams: Record<string, unknown> = {}

  // LLMで行動を決定してみる
  try {
    const response = await ai.models.generateContent({
      model: MODEL_LITE,
      contents: `${contextPrompt}\n\n1つの行動をJSONで選択せよ。`,
      config: {
        systemInstruction: systemPrompt,
      },
    })

    const text = response.text ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const decision = JSON.parse(jsonMatch[0]) as {
        action: string
        params: Record<string, unknown>
      }

      if (decision.action && decision.action !== 'none') {
        switch (decision.action) {
          case 'recruit':
            toolName = 'recruit_soldiers'
            toolParams = decision.params
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
            if (attackTargets.length > 0) {
              toolName = 'attack'
              const fromCastle =
                state.castleCatalog[decision.params.fromCastleId as string]
              const soldiers =
                (decision.params.soldierCount as number) ||
                (fromCastle ? Math.floor(fromCastle.soldiers * 0.7) : 500)
              toolParams = { ...decision.params, soldierCount: soldiers }
            }
            break
          case 'diplomacy':
            toolName = 'propose_alliance'
            toolParams = decision.params
            break
        }
      }
    }
  } catch {
    // パース失敗時はフォールバックへ
  }

  // LLMが行動を返さなかった場合、ルールベースで強制行動
  if (!toolName) {
    // 優先順位: 1.兵力不足なら徴兵 2.金不足なら開発 3.攻撃可能なら攻撃 4.それ以外は開発
    if (totalSoldiers < 500 && clan.gold >= 300) {
      // 徴兵
      toolName = 'recruit_soldiers'
      toolParams = {
        castleId: firstCastleId,
        count: Math.min(300, Math.floor(clan.gold / 2)),
      }
    } else if (clan.gold < 1000) {
      // 商業開発で金を稼ぐ
      toolName = 'develop_commerce'
      toolParams = {
        castleId: firstCastleId,
        investment: Math.min(500, clan.gold),
      }
    } else if (totalSoldiers >= 3000) {
      // 攻撃可能で兵力十分なら攻撃
      const target = attackTargets[0]
      if (target) {
        const targetCastle = state.castleCatalog[target.to]
        const fromCastle = state.castleCatalog[target.from]
        if (
          targetCastle &&
          fromCastle &&
          fromCastle.soldiers > targetCastle.soldiers * 1.2
        ) {
          toolName = 'attack'
          toolParams = {
            fromCastleId: target.from,
            targetCastleId: target.to,
            soldierCount: Math.floor(fromCastle.soldiers * 0.7),
          }
        }
      }
    }

    // それでも行動が決まらなければ農業開発
    if (!toolName && clan.gold >= 100) {
      toolName = 'develop_agriculture'
      toolParams = {
        castleId: firstCastleId,
        investment: Math.min(500, clan.gold),
      }
    }
  }

  // 決定のみを返す（実行は呼び出し側で行う）
  return { toolName, toolParams }
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
  const clan = state.clanCatalog[clanId]
  if (!clan) {
    throw new Error(`Clan not found: ${clanId}`)
  }
  const leader = state.bushoCatalog[clan.leaderId]
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

  // コマンドパターンで実行
  const cmd = createCommand(toolName, args)
  if (!cmd) {
    return {
      tool: toolName,
      args,
      narrative: `不明なコマンド: ${toolName}`,
      success: false,
      aiResponse: 'コマンドを実行できませんでした。',
    }
  }

  const cmdResult = cmd.execute(state, clanId)

  // 結果に対するAIのコメントを生成
  const commentResponse = await ai.models.generateContent({
    model: MODEL_LITE,
    contents: `あなたは戦国時代の軍師です。以下の行動結果について、${leader.name}に簡潔に報告してください（50文字以内）。

行動: ${toolName}
結果: ${cmdResult.narrative}
成功: ${cmdResult.result.success ? 'はい' : 'いいえ'}`,
  })

  return {
    tool: toolName,
    args,
    narrative: cmdResult.narrative,
    success: cmdResult.result.success,
    aiResponse: commentResponse.text ?? cmdResult.narrative,
  }
}
