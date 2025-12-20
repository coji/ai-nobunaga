// 評定（複数武将による議論）

import { ACTION_DEFAULTS, COUNCIL_CONFIG } from '../constants/index.js'
import type { Busho, GameState, ResultGrade } from '../types.js'
import { ai, MODEL, MODEL_LITE } from './client.js'
import { buildGameContextPrompt } from './prompts.js'

// === 型定義 ===

/** 同一ターン内のアクション履歴（評定間で共有） */
export interface ActionHistoryEntry {
  topic: string // 議題
  proposal: string // 選択された提案
  result: string // 結果の説明
  grade: ResultGrade // 成功度
  supporters: string[] // 賛成した武将
  opponents: string[] // 反対した武将
}

export interface CouncilOpinion {
  bushoId: string
  bushoName: string
  opinion: string
  stance: '賛成' | '反対' | '慎重' | '積極'
}

// 議論の発言
export interface CouncilStatement {
  bushoId: string
  bushoName: string
  statement: string
  round: number
  // 感情表現（口論・意気投合など）
  emotion?: 'neutral' | 'agree' | 'disagree' | 'angry' | 'excited'
  targetName?: string // 誰に対しての発言か
  delegateTo?: string // 他の武将に意見を求めた相手
  isRepresentative?: boolean // 代表者かどうか
}

// 評定から生成された提案
export interface CouncilProposal {
  id: string
  title: string
  description: string
  tool: string
  args: Record<string, unknown>
  supporters: string[] // 賛成した武将名
  opponents: string[] // 反対した武将名
}

// 議題のカテゴリ
type TopicCategory =
  | 'military'
  | 'domestic'
  | 'diplomacy'
  | 'intrigue'
  | 'general'

// === ヘルパー関数 ===

// 性格から口調のヒントを生成
function getPersonalitySpeechStyle(personality: string[]): string {
  const styles: string[] = []

  if (personality.includes('革新的')) styles.push('新しい視点で大胆に')
  if (personality.includes('保守的')) styles.push('慎重に、伝統を重んじて')
  if (personality.includes('野心家')) styles.push('積極的に、機会を逃さず')
  if (personality.includes('義理重視')) styles.push('道義を重んじ、誠実に')
  if (personality.includes('実利優先')) styles.push('現実的に、損得を計算して')
  if (personality.includes('猜疑心')) styles.push('用心深く、裏を読んで')
  if (personality.includes('残虐')) styles.push('容赦なく、断固として')
  if (personality.includes('権威主義'))
    styles.push('格式を重んじ、威厳をもって')

  return styles.length > 0 ? styles.join('、') : '率直に'
}

// 能力に基づいた専門性
function getExpertise(busho: Busho): string {
  const skills: string[] = []
  if (busho.warfare >= COUNCIL_CONFIG.EXPERTISE_THRESHOLD) skills.push('軍事')
  if (busho.politics >= COUNCIL_CONFIG.EXPERTISE_THRESHOLD) skills.push('内政')
  if (busho.intelligence >= COUNCIL_CONFIG.EXPERTISE_THRESHOLD)
    skills.push('謀略・外交')
  if (busho.charisma >= COUNCIL_CONFIG.EXPERTISE_THRESHOLD)
    skills.push('人心掌握')

  return skills.length > 0 ? `${skills.join('・')}に長けた` : ''
}

// 議題のカテゴリを判定
function categorizeTopic(topic: string): TopicCategory {
  const militaryKeywords = ['攻', '兵', '軍', '戦', '守', '城', '防衛', '侵攻']
  const domesticKeywords = [
    '農',
    '商',
    '開発',
    '金',
    '財',
    '内政',
    '民',
    '発展',
  ]
  const diplomacyKeywords = [
    '同盟',
    '外交',
    '交渉',
    '和平',
    '隣国',
    '敵国',
    '友好',
  ]
  const intrigueKeywords = [
    '調略',
    '寝返',
    '流言',
    '買収',
    '謀略',
    '工作',
    '暗殺',
  ]

  for (const kw of intrigueKeywords) {
    if (topic.includes(kw)) return 'intrigue'
  }
  for (const kw of militaryKeywords) {
    if (topic.includes(kw)) return 'military'
  }
  for (const kw of domesticKeywords) {
    if (topic.includes(kw)) return 'domestic'
  }
  for (const kw of diplomacyKeywords) {
    if (topic.includes(kw)) return 'diplomacy'
  }
  return 'general'
}

// 議題に応じて代表者を選出（1-2人）
function selectRepresentatives(
  retainers: Busho[],
  category: TopicCategory,
): Busho[] {
  if (retainers.length === 0) return []
  if (retainers.length <= 2) return retainers

  // 能力に基づいたスコアリング
  const scored = retainers.map((b) => {
    let score = 0
    switch (category) {
      case 'military':
        score = b.warfare * 2 + b.intelligence
        break
      case 'domestic':
        score = b.politics * 2 + b.charisma
        break
      case 'diplomacy':
        score = b.intelligence * 2 + b.charisma
        break
      case 'intrigue':
        score = b.intelligence * 2 + b.politics
        break
      case 'general':
        score = b.politics + b.intelligence + b.charisma
        break
    }
    return { busho: b, score }
  })

  // スコア順にソートして上位者を選出
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, COUNCIL_CONFIG.REPRESENTATIVES).map((s) => s.busho)
}

// === メイン関数 ===

/** 評定を開催し、家臣の意見を収集 */
export async function holdCouncil(
  state: GameState,
  clanId: string,
  topic: string,
): Promise<CouncilOpinion[]> {
  const clan = state.clanCatalog[clanId]
  if (!clan) {
    throw new Error(`Clan not found: ${clanId}`)
  }
  const leader = state.bushoCatalog[clan.leaderId]
  if (!leader) {
    throw new Error(`Leader not found: ${clan.leaderId}`)
  }

  // 当主以外の家臣を取得
  const retainers = Object.values(state.bushoCatalog)
    .filter((b) => b.clanId === clanId && b.id !== clan.leaderId)
    .slice(0, COUNCIL_CONFIG.MAX_RETAINERS)

  if (retainers.length === 0) {
    return [
      {
        bushoId: clan.leaderId,
        bushoName: leader.name,
        opinion: '家臣がおらぬ…一人で決断せねばならぬ。',
        stance: '慎重',
      },
    ]
  }

  const gameContext = buildGameContextPrompt(state, clanId)

  // 各武将の意見を並列で取得
  const opinions = await Promise.all(
    retainers.map(async (busho) => {
      const speechStyle = getPersonalitySpeechStyle(busho.personality)
      const expertise = getExpertise(busho)

      const systemPrompt = `あなたは戦国時代の武将「${busho.name}」です。
性格: ${busho.personality.join('、')}
能力: 武力${busho.warfare} 政治${busho.politics} 知力${busho.intelligence} 魅力${busho.charisma}
忠誠心: ${busho.emotions.loyalty}

話し方の特徴:
- ${speechStyle}
- ${expertise}武将として発言
- 戦国時代らしい言葉遣い（「〜でござる」「〜にて」「〜かと存ずる」など）
- 自分の性格と能力に基づいた視点で意見を述べる
- 簡潔に（80文字以内）`

      const prompt = `${gameContext}

主君${leader.name}殿が評定で問うておられる:
「${topic}」

${busho.name}として、自分の性格・専門性に基づいて意見を述べよ。
必ず以下のJSON形式で出力せよ:
\`\`\`json
{"opinion": "意見本文", "stance": "賛成|反対|慎重|積極"}
\`\`\``

      try {
        const response = await ai.models.generateContent({
          model: MODEL,
          contents: prompt,
          config: {
            systemInstruction: systemPrompt,
          },
        })

        const text = response.text ?? ''
        const jsonMatch =
          text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/)
        const parsed = JSON.parse(jsonMatch?.[1] || jsonMatch?.[0] || '{}')

        return {
          bushoId: busho.id,
          bushoName: busho.name,
          opinion: parsed.opinion || '……。',
          stance: (parsed.stance as CouncilOpinion['stance']) || '慎重',
        }
      } catch (e) {
        console.error(`Council error for ${busho.name}:`, e)
        return {
          bushoId: busho.id,
          bushoName: busho.name,
          opinion: '……。',
          stance: '慎重' as const,
        }
      }
    }),
  )

  return opinions
}

/** 旧API互換（単一回答） */
export async function askMilitaryAdvisor(
  state: GameState,
  clanId: string,
  question: string,
): Promise<string> {
  const opinions = await holdCouncil(state, clanId, question)
  return opinions.map((o) => `${o.bushoName}: ${o.opinion}`).join('\n')
}

/** 議論の1ラウンドを実行（代表者方式：1-2人が発言、たまに他武将に話をふる） */
export async function conductCouncilRound(
  state: GameState,
  clanId: string,
  topic: string,
  previousStatements: CouncilStatement[],
  round: number,
  actionHistory: ActionHistoryEntry[] = [],
): Promise<CouncilStatement[]> {
  const clan = state.clanCatalog[clanId]
  if (!clan) {
    throw new Error(`Clan not found: ${clanId}`)
  }
  const leader = state.bushoCatalog[clan.leaderId]
  if (!leader) {
    throw new Error(`Leader not found: ${clan.leaderId}`)
  }

  const allRetainers = Object.values(state.bushoCatalog)
    .filter((b) => b.clanId === clanId && b.id !== clan.leaderId)
    .slice(0, COUNCIL_CONFIG.MAX_RETAINERS)

  if (allRetainers.length === 0) {
    return []
  }

  // 議題カテゴリに応じて代表者を選出
  const category = categorizeTopic(topic)
  const representatives = selectRepresentatives(allRetainers, category)
  const otherRetainers = allRetainers.filter(
    (r) => !representatives.some((rep) => rep.id === r.id),
  )

  const gameContext = buildGameContextPrompt(state, clanId)

  // 家臣の名前一覧
  const otherRetainerNames = otherRetainers.map((r) => r.name)
  const allRetainerNames = allRetainers.map((r) => r.name)

  // これまでの議論を文字列化
  const discussionSoFar =
    previousStatements.length > 0
      ? previousStatements
          .map((s) => {
            const emotionTag =
              s.emotion === 'angry'
                ? '（怒）'
                : s.emotion === 'excited'
                  ? '（熱）'
                  : s.emotion === 'agree'
                    ? '（同意）'
                    : s.emotion === 'disagree'
                      ? '（反論）'
                      : ''
            const target = s.targetName ? `→${s.targetName}に対し` : ''
            return `${s.bushoName}${emotionTag}${target}: 「${s.statement}」`
          })
          .join('\n')
      : '（まだ誰も発言していない）'

  // 同一ターン内の過去のアクション履歴を文字列化
  const actionHistoryText =
    actionHistory.length > 0
      ? actionHistory
          .map((a, i) => {
            const gradeText =
              a.grade === 'critical_success'
                ? '大成功'
                : a.grade === 'critical_failure'
                  ? '大失敗'
                  : a.grade === 'success'
                    ? '成功'
                    : '失敗'
            return `${i + 1}. 「${a.topic}」→${a.proposal}（${gradeText}）: ${a.result}`
          })
          .join('\n')
      : null

  // 代表者のみが発言（たまに他の武将に話をふる）
  const statements = await Promise.all(
    representatives.map(async (busho) => {
      // 他の武将（代表者以外も含む）
      const otherNames = allRetainerNames.filter((n) => n !== busho.name)

      // 武将ごとの性格・立場設定
      const characterSettings: Record<
        string,
        { rank: 'veteran' | 'middle' | 'young'; style: string }
      > = {
        柴田勝家: {
          rank: 'veteran',
          style:
            '武骨な老将。主君には「〜にございます」、同僚には「〜じゃ」、若手には厳しく「〜せよ」',
        },
        木下藤吉郎: {
          rank: 'young',
          style:
            '人懐っこい出世頭。主君には「〜でございますれば」と丁寧、先輩には「〜ですなあ」、友には軽く「〜だよ」',
        },
        丹羽長秀: {
          rank: 'middle',
          style:
            '温厚な調整役。主君には「〜かと存じます」、誰にも「〜ではないかな」と穏やか',
        },
        前田利家: {
          rank: 'young',
          style:
            '熱血漢。主君には「〜でございます！」、先輩には「〜ですぞ」、友の秀吉には「〜だな！」',
        },
        佐々成政: {
          rank: 'young',
          style:
            '生真面目。主君には「〜と考えます」、誰にも堅い「〜であります」',
        },
        池田恒興: {
          rank: 'middle',
          style:
            '信長の乳兄弟で気さく。主君には「〜でしょう」、皆に「〜だろう」「まあまあ」',
        },
        森可成: {
          rank: 'veteran',
          style: '歴戦の猛将。主君には「〜にござる」、若手には「〜じゃ」と豪快',
        },
        滝川一益: {
          rank: 'middle',
          style: '冷静沈着。主君には「〜かと」、皆に「〜だな」と淡々',
        },
      }

      const setting = characterSettings[busho.name] || {
        rank: 'middle',
        style: '丁寧に話す',
      }

      // 他の武将に話をふるかどうか
      const shouldDelegateToOther =
        otherRetainerNames.length > 0 &&
        Math.random() < COUNCIL_CONFIG.DELEGATION_CHANCE
      const delegateTarget = shouldDelegateToOther
        ? otherRetainerNames[
            Math.floor(Math.random() * otherRetainerNames.length)
          ]
        : null

      const systemPrompt = `あなたは戦国武将「${busho.name}」。この議題の代表者として評定で主君${leader.name}様に意見を述べる。
性格: ${busho.personality.join('、')}
立場: ${setting.rank === 'veteran' ? '古参の重臣' : setting.rank === 'young' ? '若手の家臣' : '中堅'}
話し方: ${setting.style}

【敬語ルール】
- 主君への提言は必ず丁寧語（〜でございます、〜かと存じます）
- 同僚への反論も礼節を保つ（〇〇殿、いかがか）
- ただし親しい相手や対立相手には感情が出る

【同席者との関係】
${otherNames
  .map((n: string) => {
    if (busho.name === '木下藤吉郎' && n === '柴田勝家')
      return `- ${n}: 対立関係（皮肉を言い合う仲）`
    if (busho.name === '柴田勝家' && n === '木下藤吉郎')
      return `- ${n}: 対立関係（「猿め」と呼ぶ）`
    if (busho.name === '前田利家' && n === '木下藤吉郎')
      return `- ${n}: 親友（気軽に話す）`
    if (busho.name === '木下藤吉郎' && n === '前田利家')
      return `- ${n}: 親友（気軽に話す）`
    if (busho.name === '佐々成政' && n === '柴田勝家')
      return `- ${n}: 尊敬する上官`
    return `- ${n}: 同僚`
  })
  .join('\n')}
${otherRetainerNames.length > 0 ? `\n【同席しているが発言していない武将】${otherRetainerNames.join('、')}` : ''}

【重要】40文字以内で簡潔に。

例:
勝家→主君「殿、ここは攻めるべきかと存じます」
勝家→秀吉「猿、口が過ぎるぞ」
秀吉→主君「殿、調略で崩すが上策でございましょう」
秀吉→勝家「勝家殿は相変わらず猪突猛進ですなあ」
長秀→皆「まあ、落ち着いて話し合おうではないか」
秀吉→利家「利家殿、内政についてはどう思われる？」`

      const delegateInstruction = delegateTarget
        ? `\n【特別指示】発言の中で「${delegateTarget}」に意見を求めよ（例：「${delegateTarget}殿はいかがお考えか」）`
        : ''

      // アクション履歴があれば追加
      const actionHistorySection = actionHistoryText
        ? `\n【本日の評定で既に行った行動】\n${actionHistoryText}\n※これらの結果を踏まえて議論せよ。成功した行動は評価し、失敗した行動からは教訓を得よ。\n`
        : ''

      const prompt = `${gameContext}
${actionHistorySection}
主君${leader.name}殿が評定で問うておられる:
「${topic}」

これまでの議論:
${discussionSoFar}

${busho.name}として、これまでの議論${actionHistoryText ? 'と本日既に行った行動の結果' : ''}を踏まえて意見を述べよ。${delegateInstruction}

JSON形式で出力:
\`\`\`json
{
  "statement": "発言内容",
  "emotion": "neutral|agree|disagree|angry|excited",
  "targetName": "誰への発言か（なければnull）",
  "delegateTo": "意見を求めた相手（なければnull）"
}
\`\`\``

      try {
        const response = await ai.models.generateContent({
          model: MODEL,
          contents: prompt,
          config: {
            systemInstruction: systemPrompt,
          },
        })

        const text = response.text ?? ''
        const jsonMatch =
          text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/)
        const parsed = JSON.parse(jsonMatch?.[1] || jsonMatch?.[0] || '{}')

        return {
          bushoId: busho.id,
          bushoName: busho.name,
          statement: parsed.statement || '……。',
          round,
          emotion: parsed.emotion || 'neutral',
          targetName: parsed.targetName || undefined,
          delegateTo: parsed.delegateTo || undefined,
          isRepresentative: true,
        }
      } catch (e) {
        console.error(`Council round error for ${busho.name}:`, e)
        return {
          bushoId: busho.id,
          bushoName: busho.name,
          statement: '……。',
          round,
          emotion: 'neutral' as const,
          isRepresentative: true,
        }
      }
    }),
  )

  // 話をふられた武将の返答を追加
  const delegatedStatements: CouncilStatement[] = []
  for (const stmt of statements) {
    if (stmt.delegateTo) {
      const delegatedBusho = otherRetainers.find(
        (r) => r.name === stmt.delegateTo,
      )
      if (delegatedBusho) {
        try {
          const response = await ai.models.generateContent({
            model: MODEL_LITE,
            contents: `あなたは戦国武将「${delegatedBusho.name}」です。評定で${stmt.bushoName}から意見を求められました。
議題: ${topic}
${stmt.bushoName}の発言:「${stmt.statement}」

25文字以内で簡潔に返答せよ。返答のみを出力。`,
          })
          delegatedStatements.push({
            bushoId: delegatedBusho.id,
            bushoName: delegatedBusho.name,
            statement: response.text?.trim() || '左様でございますな。',
            round,
            emotion: 'neutral',
            targetName: stmt.bushoName,
            isRepresentative: false,
          })
        } catch {
          delegatedStatements.push({
            bushoId: delegatedBusho.id,
            bushoName: delegatedBusho.name,
            statement: '御意にございます。',
            round,
            emotion: 'neutral',
            targetName: stmt.bushoName,
            isRepresentative: false,
          })
        }
      }
    }
  }

  return [...statements, ...delegatedStatements]
}

/** 議論から具体的な提案をまとめる */
export async function summarizeCouncilProposals(
  state: GameState,
  clanId: string,
  topic: string,
  allStatements: CouncilStatement[],
): Promise<CouncilProposal[]> {
  const gameContext = buildGameContextPrompt(state, clanId)
  const clan = state.clanCatalog[clanId]
  if (!clan) {
    throw new Error(`Clan not found: ${clanId}`)
  }

  // 議題のカテゴリを判定
  const category = categorizeTopic(topic)

  // 自勢力の城一覧
  const myCastles = clan.castleIds
    .map((id) => {
      const c = state.castleCatalog[id]
      if (!c) return null
      return `  - ${c.id}（${c.name}）: 兵${c.soldiers}、農${c.agriculture}、商${c.commerce}`
    })
    .filter(Boolean)
    .join('\n')

  // 隣接する敵城
  const attackTargets: string[] = []
  for (const castleId of clan.castleIds) {
    const castle = state.castleCatalog[castleId]
    if (!castle) continue
    for (const adjId of castle.adjacentCastleIds) {
      const adj = state.castleCatalog[adjId]
      if (!adj) continue
      if (adj.ownerId !== clanId) {
        attackTargets.push(
          `  - ${castle.id}から${adj.id}（${adj.name}）へ攻撃可能`,
        )
      }
    }
  }

  // 他勢力一覧
  const otherClans = Object.values(state.clanCatalog)
    .filter((c) => c.id !== clanId)
    .map((c) => `  - ${c.id}（${c.name}）`)
    .join('\n')

  // 敵勢力の武将一覧（調略対象）
  const enemyBushos = Object.values(state.bushoCatalog)
    .filter((b) => b.clanId !== clanId && b.clanId !== null)
    .map((b) => {
      const bClan = b.clanId ? state.clanCatalog[b.clanId] : null
      const isLeader = bClan?.leaderId === b.id
      return `  - ${b.id}（${b.name}）[${bClan?.name || '不明'}]${isLeader ? ' ※当主' : ''}`
    })
    .join('\n')

  // カテゴリに応じたツール説明を生成
  const buildToolDescriptions = (): string => {
    const parts: string[] = []

    if (category === 'domestic' || category === 'general') {
      parts.push(`【内政】※自分の城のIDを使用
- develop_agriculture: 農業発展 → {"castleId": "城ID", "investment": ${ACTION_DEFAULTS.DEVELOP.INVESTMENT}}
- develop_commerce: 商業発展 → {"castleId": "城ID", "investment": ${ACTION_DEFAULTS.DEVELOP.INVESTMENT}}

自勢力の城:
${myCastles}`)
    }

    if (category === 'military' || category === 'general') {
      parts.push(`【軍事】※自分の城のIDを使用
- recruit_soldiers: 徴兵 → {"castleId": "城ID", "count": ${ACTION_DEFAULTS.RECRUIT.MAX_COUNT}}
- fortify: 城郭強化 → {"castleId": "城ID", "investment": ${ACTION_DEFAULTS.DEVELOP.INVESTMENT}}
- attack: 攻撃 → {"fromCastleId": "出撃城ID", "targetCastleId": "敵城ID", "soldierCount": 出撃城兵力の${Math.floor(ACTION_DEFAULTS.ATTACK.SOLDIER_RATIO * 100)}%}

自勢力の城:
${myCastles}

攻撃可能な敵城:
${attackTargets.length > 0 ? attackTargets.join('\n') : '  なし'}`)
    }

    if (category === 'diplomacy' || category === 'general') {
      parts.push(`【外交】※相手勢力のIDを使用
- propose_alliance: 同盟申込 → {"targetClanId": "勢力ID", "duration": 12}
- send_gift: 贈り物 → {"targetClanId": "勢力ID", "goldAmount": ${ACTION_DEFAULTS.DIPLOMACY.GIFT_AMOUNT}}
- threaten: 威嚇 → {"targetClanId": "勢力ID"}

他勢力:
${otherClans}`)
    }

    if (category === 'intrigue' || category === 'general') {
      parts.push(`【謀略】※敵武将のIDを使用（コスト: bribe=${ACTION_DEFAULTS.INTRIGUE.BRIBE_AMOUNT}金、spread_rumor=200金）
- bribe: 買収（忠誠低下） → {"targetBushoId": "武将ID"}
- spread_rumor: 流言（不満増加） → {"targetBushoId": "武将ID"}

敵武将:
${enemyBushos || '  なし'}`)
    }

    parts.push(`現在の資源: 金${clan.gold}、兵糧${clan.food}`)

    return parts.join('\n\n')
  }

  const toolDescriptions = buildToolDescriptions()

  const discussionText = allStatements
    .map((s) => `${s.bushoName}(第${s.round}回): 「${s.statement}」`)
    .join('\n')

  const categoryInstruction =
    category === 'general'
      ? '議論で言及された内容に基づいて'
      : `この${category === 'domestic' ? '内政' : category === 'military' ? '軍事' : category === 'diplomacy' ? '外交' : '謀略'}の議論に基づいて`

  const prompt = `${gameContext}

評定の議題:「${topic}」

家臣たちの議論:
${discussionText}

${toolDescriptions}

【重要】${categoryInstruction}、具体的な行動案を2-3個まとめよ。
- 議論で家臣が言及した内容のみを提案すること
- 議論に出てこなかった行動は提案しないこと
- 上記の城ID・勢力ID・武将IDを正確に使用すること

JSON形式で出力:
\`\`\`json
[
  {
    "title": "案の名前",
    "description": "案の説明（30文字以内）",
    "tool": "ツール名",
    "args": {"パラメータ": "値"},
    "supporters": ["賛成武将名"],
    "opponents": ["反対武将名"]
  }
]
\`\`\``

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {},
    })

    const text = response.text ?? ''
    const jsonMatch =
      text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\[[\s\S]*\]/)
    const parsed = JSON.parse(jsonMatch?.[1] || jsonMatch?.[0] || '[]')

    return parsed.map(
      (
        p: {
          title?: string
          description?: string
          tool?: string
          args?: Record<string, unknown>
          supporters?: string[]
          opponents?: string[]
        },
        i: number,
      ) => ({
        id: `proposal_${i}`,
        title: p.title || `案${i + 1}`,
        description: p.description || '',
        tool: p.tool || '',
        args: p.args || {},
        supporters: p.supporters || [],
        opponents: p.opponents || [],
      }),
    )
  } catch (e) {
    console.error('Proposal summarization error:', e)
    return []
  }
}
