// 軍師AI・書状生成・ナレーション

import type { GameState, Letter } from '../types.js'
import { ai, MODEL, MODEL_LITE, THINKING } from './client.js'
import { buildGameContextPrompt } from './prompts.js'

// === 評定（複数武将による議論） ===

import type { Busho } from '../types.js'

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
  if (busho.warfare >= 80) skills.push('軍事')
  if (busho.politics >= 80) skills.push('内政')
  if (busho.intelligence >= 80) skills.push('謀略・外交')
  if (busho.charisma >= 80) skills.push('人心掌握')

  return skills.length > 0 ? `${skills.join('・')}に長けた` : ''
}

export async function holdCouncil(
  state: GameState,
  clanId: string,
  topic: string,
): Promise<CouncilOpinion[]> {
  const clan = state.clanCatalog.get(clanId)
  if (!clan) {
    throw new Error(`Clan not found: ${clanId}`)
  }
  const leader = state.bushoCatalog.get(clan.leaderId)
  if (!leader) {
    throw new Error(`Leader not found: ${clan.leaderId}`)
  }

  // 当主以外の家臣を取得（最大4名）
  const retainers = [...state.bushoCatalog.values()]
    .filter((b) => b.clanId === clanId && b.id !== clan.leaderId)
    .slice(0, 4)

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
            thinkingConfig: { thinkingLevel: THINKING.COUNCIL },
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

// 旧API互換（単一回答）
export async function askMilitaryAdvisor(
  state: GameState,
  clanId: string,
  question: string,
): Promise<string> {
  const opinions = await holdCouncil(state, clanId, question)
  return opinions.map((o) => `${o.bushoName}: ${o.opinion}`).join('\n')
}

// === マルチターン評定（代表者方式） ===

// 議題のカテゴリを判定
type TopicCategory =
  | 'military'
  | 'domestic'
  | 'diplomacy'
  | 'intrigue'
  | 'general'

function categorizeTopc(topic: string): TopicCategory {
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

  // スコア順にソートして上位2人を選出
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, 2).map((s) => s.busho)
}

// 議論の1ラウンドを実行（代表者方式：1-2人が発言、たまに他武将に話をふる）
export async function conductCouncilRound(
  state: GameState,
  clanId: string,
  topic: string,
  previousStatements: CouncilStatement[],
  round: number,
): Promise<CouncilStatement[]> {
  const clan = state.clanCatalog.get(clanId)
  if (!clan) {
    throw new Error(`Clan not found: ${clanId}`)
  }
  const leader = state.bushoCatalog.get(clan.leaderId)
  if (!leader) {
    throw new Error(`Leader not found: ${clan.leaderId}`)
  }

  const allRetainers = [...state.bushoCatalog.values()]
    .filter((b) => b.clanId === clanId && b.id !== clan.leaderId)
    .slice(0, 4)

  if (allRetainers.length === 0) {
    return []
  }

  // 議題カテゴリに応じて代表者を選出
  const category = categorizeTopc(topic)
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

      // 他の武将に話をふるかどうか（30%の確率）
      const shouldDelegateToOther =
        otherRetainerNames.length > 0 && Math.random() < 0.3
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

      const prompt = `${gameContext}

主君${leader.name}殿が評定で問うておられる:
「${topic}」

これまでの議論:
${discussionSoFar}

${busho.name}として、これまでの議論を踏まえて意見を述べよ。${delegateInstruction}

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
            thinkingConfig: { thinkingLevel: THINKING.COUNCIL },
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

  // 話をふられた武将の返答を追加（delegateToがあり、かつその武将が代表者でない場合）
  const delegatedStatements: CouncilStatement[] = []
  for (const stmt of statements) {
    if (stmt.delegateTo) {
      const delegatedBusho = otherRetainers.find(
        (r) => r.name === stmt.delegateTo,
      )
      if (delegatedBusho) {
        // 簡単な返答を生成
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

// 議論から具体的な提案をまとめる
export async function summarizeCouncilProposals(
  state: GameState,
  clanId: string,
  topic: string,
  allStatements: CouncilStatement[],
): Promise<CouncilProposal[]> {
  const gameContext = buildGameContextPrompt(state, clanId)
  const clan = state.clanCatalog.get(clanId)
  if (!clan) {
    throw new Error(`Clan not found: ${clanId}`)
  }

  // 議題のカテゴリを判定
  const category = categorizeTopc(topic)

  // 自勢力の城一覧
  const myCastles = clan.castleIds
    .map((id) => {
      const c = state.castleCatalog.get(id)
      if (!c) return null
      return `  - ${c.id}（${c.name}）: 兵${c.soldiers}、農${c.agriculture}、商${c.commerce}`
    })
    .filter(Boolean)
    .join('\n')

  // 隣接する敵城
  const attackTargets: string[] = []
  for (const castleId of clan.castleIds) {
    const castle = state.castleCatalog.get(castleId)
    if (!castle) continue
    for (const adjId of castle.adjacentCastleIds) {
      const adj = state.castleCatalog.get(adjId)
      if (!adj) continue
      if (adj.ownerId !== clanId) {
        attackTargets.push(
          `  - ${castle.id}から${adj.id}（${adj.name}）へ攻撃可能`,
        )
      }
    }
  }

  // 他勢力一覧
  const otherClans = [...state.clanCatalog.values()]
    .filter((c) => c.id !== clanId)
    .map((c) => `  - ${c.id}（${c.name}）`)
    .join('\n')

  // 敵勢力の武将一覧（調略対象）
  const enemyBushos = [...state.bushoCatalog.values()]
    .filter((b) => b.clanId !== clanId && b.clanId !== null)
    .map((b) => {
      const bClan = b.clanId ? state.clanCatalog.get(b.clanId) : null
      const isLeader = bClan?.leaderId === b.id
      return `  - ${b.id}（${b.name}）[${bClan?.name || '不明'}]${isLeader ? ' ※当主' : ''}`
    })
    .join('\n')

  // カテゴリに応じたツール説明を生成
  const buildToolDescriptions = (): string => {
    const parts: string[] = []

    // 内政系（domestic or general）
    if (category === 'domestic' || category === 'general') {
      parts.push(`【内政】※自分の城のIDを使用
- develop_agriculture: 農業発展 → {"castleId": "城ID", "investment": 500}
- develop_commerce: 商業発展 → {"castleId": "城ID", "investment": 500}

自勢力の城:
${myCastles}`)
    }

    // 軍事系（military or general）
    if (category === 'military' || category === 'general') {
      parts.push(`【軍事】※自分の城のIDを使用
- recruit_soldiers: 徴兵 → {"castleId": "城ID", "count": 200}
- fortify: 城郭強化 → {"castleId": "城ID", "investment": 500}
- attack: 攻撃 → {"fromCastleId": "出撃城ID", "targetCastleId": "敵城ID", "soldierCount": 300}

自勢力の城:
${myCastles}

攻撃可能な敵城:
${attackTargets.length > 0 ? attackTargets.join('\n') : '  なし'}`)
    }

    // 外交系（diplomacy or general）
    if (category === 'diplomacy' || category === 'general') {
      parts.push(`【外交】※相手勢力のIDを使用
- propose_alliance: 同盟申込 → {"targetClanId": "勢力ID", "duration": 12}
- send_gift: 贈り物 → {"targetClanId": "勢力ID", "goldAmount": 300}
- threaten: 威嚇 → {"targetClanId": "勢力ID"}

他勢力:
${otherClans}`)
    }

    // 謀略系（intrigue or general）
    if (category === 'intrigue' || category === 'general') {
      parts.push(`【謀略】※敵武将のIDを使用（コスト: bribe=500金、spread_rumor=200金）
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

  // カテゴリに応じた指示
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
      config: {
        thinkingConfig: { thinkingLevel: THINKING.COUNCIL },
      },
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

// === 結果ナレーション生成 ===

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

// === 行動結果に対する家臣コメント生成 ===

import type { ResultGrade } from '../types.js'

export interface RetainerComment {
  bushoName: string
  comment: string
  emotion: 'praise' | 'concern' | 'neutral' | 'angry' | 'relieved'
}

/**
 * 行動結果に対して、評定で発言した家臣がコメントを返す
 */
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
    const busho = [...state.bushoCatalog.values()].find(
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

// === 書状生成 ===

export async function generateLetter(
  state: GameState,
  fromClanId: string,
  toClanId: string,
  purpose: 'propose_alliance' | 'threaten' | 'respond_to_letter',
  context?: string,
): Promise<Letter> {
  const fromClan = state.clanCatalog.get(fromClanId)
  if (!fromClan) {
    throw new Error(`Clan not found: ${fromClanId}`)
  }
  const toClan = state.clanCatalog.get(toClanId)
  if (!toClan) {
    throw new Error(`Clan not found: ${toClanId}`)
  }
  const fromLeader = state.bushoCatalog.get(fromClan.leaderId)
  if (!fromLeader) {
    throw new Error(`Leader not found: ${fromClan.leaderId}`)
  }
  const toLeader = state.bushoCatalog.get(toClan.leaderId)
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
      config: {
        thinkingConfig: { thinkingLevel: THINKING.LETTER },
      },
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
