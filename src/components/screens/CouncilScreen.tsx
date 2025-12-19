// 評定（家臣会議）画面コンポーネント - マルチターン議論対応

import { Box, Text, useInput } from 'ink'
import Spinner from 'ink-spinner'
import TextInput from 'ink-text-input'
import { useState } from 'react'
import { ai, MODEL_LITE } from '../../ai/client.js'
import { executeToolCall } from '../../ai/executor.js'
import {
  conductCouncilRound,
  generateNarrative,
  generateRetainerComments,
  summarizeCouncilProposals,
  type CouncilProposal,
  type CouncilStatement,
  type RetainerComment,
} from '../../ai/index.js'
import type { GameState, ResultGrade } from '../../types.js'

interface Props {
  state: GameState
  playerClanId: string
  onExecuteProposal?: (result: {
    tool: string
    narrative: string
    success: boolean
  }) => void
}

// 感情に応じた色とアイコン
function getEmotionStyle(emotion?: string): { color: string; icon: string } {
  switch (emotion) {
    case 'angry':
      return { color: 'red', icon: '💢' }
    case 'excited':
      return { color: 'yellow', icon: '🔥' }
    case 'agree':
      return { color: 'green', icon: '👍' }
    case 'disagree':
      return { color: 'magenta', icon: '✋' }
    default:
      return { color: 'white', icon: '' }
  }
}

type Phase =
  | 'input'
  | 'report'
  | 'discussing'
  | 'proposals'
  | 'executing'
  | 'result'

// プリセット議題
const PRESET_TOPICS = [
  { label: '状況報告', topic: '__REPORT__', isReport: true },
  {
    label: '今後の方針',
    topic: '今後、我が家はどのような方針で天下を目指すべきか',
  },
  {
    label: '軍備増強',
    topic: '兵を増やし軍備を整えるべきか、内政を優先すべきか',
  },
  {
    label: '隣国への対応',
    topic: '隣国にどう対処すべきか。攻めるか、同盟を結ぶか',
  },
  { label: '財政改善', topic: '金銭と兵糧をいかにして増やすべきか' },
  { label: '城の強化', topic: 'どの城を重点的に強化すべきか' },
  {
    label: '調略',
    topic: '敵の武将を調略して寝返らせるか、流言で混乱させるか',
  },
  { label: '自由入力', topic: '' },
] as const

export function CouncilScreen({
  state,
  playerClanId,
  onExecuteProposal,
}: Props) {
  const [input, setInput] = useState('')
  const [topic, setTopic] = useState<string | null>(null)
  const [statements, setStatements] = useState<CouncilStatement[]>([])
  const [proposals, setProposals] = useState<CouncilProposal[]>([])
  const [phase, setPhase] = useState<Phase>('input')
  const [currentRound, setCurrentRound] = useState(0)
  const [selectedProposal, setSelectedProposal] = useState(0)
  const [executionResult, setExecutionResult] = useState<{
    narrative: string
    success: boolean
    grade: ResultGrade
    retainerComments: RetainerComment[]
  } | null>(null)
  const [selectedPreset, setSelectedPreset] = useState(0)
  const [isCustomInput, setIsCustomInput] = useState(false)
  const [showDiscussionLog, setShowDiscussionLog] = useState(false)
  const [reportUsed, setReportUsed] = useState(false) // 状況報告は1ターン1回
  const [reportContent, setReportContent] = useState<string | null>(null)

  const playerClan = state.clanCatalog.get(playerClanId)
  if (!playerClan) {
    throw new Error(`Clan not found: ${playerClanId}`)
  }
  const leader = state.bushoCatalog.get(playerClan.leaderId)
  if (!leader) {
    throw new Error(`Leader not found: ${playerClan.leaderId}`)
  }

  // 家臣一覧を取得
  const retainers = [...state.bushoCatalog.values()]
    .filter((b) => b.clanId === playerClanId && b.id !== playerClan.leaderId)
    .slice(0, 4)

  // 状況報告を生成
  const handleShowReport = async () => {
    if (reportUsed) return

    setPhase('report')
    setReportUsed(true)

    // 状況をまとめるプロンプト
    const ownCastles = playerClan.castleIds
      .map((id) => {
        const c = state.castleCatalog.get(id)
        if (!c) return null
        return `${c.name}: 兵${c.soldiers}, 防御${c.defense}, 農業${c.agriculture}, 商業${c.commerce}`
      })
      .filter(Boolean)

    const enemyInfo = [...state.clanCatalog.values()]
      .filter((c) => c.id !== playerClanId)
      .map((c) => {
        const l = state.bushoCatalog.get(c.leaderId)
        const relation = state.diplomacyRelations.find(
          (r) =>
            (r.clan1Id === playerClanId && r.clan2Id === c.id) ||
            (r.clan1Id === c.id && r.clan2Id === playerClanId),
        )
        const totalSoldiers = c.castleIds.reduce(
          (sum, id) => sum + (state.castleCatalog.get(id)?.soldiers || 0),
          0,
        )
        return `${c.name}(${l?.name}): 城${c.castleIds.length}, 総兵${totalSoldiers}, 関係=${relation?.type || '中立'}`
      })

    const prompt = `あなたは戦国時代の軍師です。主君${leader.name}に現在の状況を簡潔に報告せよ。

【自軍】${playerClan.name}
金: ${playerClan.gold}, 兵糧: ${playerClan.food}
城: ${ownCastles.join(' / ')}
武将: ${retainers.map((r) => r.name).join('、')}

【諸勢力】
${enemyInfo.join('\n')}

以下の形式で、戦国時代の軍師らしく報告せよ（150文字以内）:
- 自軍の現状
- 周辺情勢
- 注意すべき点

【重要】数字はアラビア数字で書くこと。`

    try {
      const response = await ai.models.generateContent({
        model: MODEL_LITE,
        contents: prompt,
      })
      setReportContent(response.text ?? '報告を生成できませんでした。')
    } catch {
      setReportContent('報告の生成に失敗しました。')
    }
  }

  // 議題を投げかけて議論開始
  const handleSubmitTopic = async (value: string) => {
    if (!value.trim() || phase !== 'input') return

    setTopic(value)
    setInput('')
    setPhase('discussing')
    setStatements([])
    setCurrentRound(1)

    // 2ラウンドの議論を実行
    let allStatements: CouncilStatement[] = []

    for (let round = 1; round <= 2; round++) {
      setCurrentRound(round)
      const roundStatements = await conductCouncilRound(
        state,
        playerClanId,
        value,
        allStatements,
        round,
      )
      allStatements = [...allStatements, ...roundStatements]
      setStatements([...allStatements])
    }

    // 提案をまとめる
    const councilProposals = await summarizeCouncilProposals(
      state,
      playerClanId,
      value,
      allStatements,
    )
    setProposals(councilProposals)
    setPhase('proposals')
    setSelectedProposal(0)
  }

  // 提案選択時のキー入力
  useInput(
    (input, key) => {
      if (phase !== 'proposals' || proposals.length === 0) return

      // Tabで議論ログの表示切替
      if (key.tab) {
        setShowDiscussionLog((v) => !v)
        return
      }

      if (key.upArrow) {
        setSelectedProposal((i) => Math.max(0, i - 1))
      }
      if (key.downArrow) {
        setSelectedProposal((i) => Math.min(proposals.length - 1, i + 1))
      }
      if (key.return) {
        void executeSelectedProposal()
      }

      // 数字キーでクイック選択
      const num = parseInt(input, 10)
      if (!Number.isNaN(num) && num >= 1 && num <= proposals.length) {
        setSelectedProposal(num - 1)
        setTimeout(() => void executeSelectedProposal(), 50)
      }
    },
    { isActive: phase === 'proposals' },
  )

  // 結果フェーズでのキー入力
  useInput(
    (_input, key) => {
      // Tabで議論ログの表示切替
      if (key.tab) {
        setShowDiscussionLog((v) => !v)
        return
      }
      if (key.return) {
        handleNewTopic()
      }
    },
    { isActive: phase === 'result' },
  )

  // プリセット選択の処理
  const handlePresetSelect = (preset: (typeof PRESET_TOPICS)[number]) => {
    if ('isReport' in preset && preset.isReport) {
      if (!reportUsed) {
        void handleShowReport()
      }
    } else if (preset.topic === '') {
      setIsCustomInput(true)
    } else {
      void handleSubmitTopic(preset.topic)
    }
  }

  // 入力フェーズ（プリセット選択）でのキー入力
  useInput(
    (inputKey, key) => {
      if (phase !== 'input' || isCustomInput) return

      if (key.upArrow) {
        setSelectedPreset((i) => Math.max(0, i - 1))
      }
      if (key.downArrow) {
        setSelectedPreset((i) => Math.min(PRESET_TOPICS.length - 1, i + 1))
      }
      if (key.return) {
        const preset = PRESET_TOPICS[selectedPreset]
        if (preset) {
          handlePresetSelect(preset)
        }
      }

      // 数字キーでクイック選択
      const num = parseInt(inputKey, 10)
      if (!Number.isNaN(num) && num >= 1 && num <= PRESET_TOPICS.length) {
        const preset = PRESET_TOPICS[num - 1]
        if (preset) {
          handlePresetSelect(preset)
        }
      }
    },
    { isActive: phase === 'input' && !isCustomInput },
  )

  // 報告フェーズでのキー入力（Enterで戻る）
  useInput(
    (_input, key) => {
      if (key.return) {
        setPhase('input')
      }
    },
    { isActive: phase === 'report' },
  )

  // 提案を実行
  const executeSelectedProposal = async () => {
    const proposal = proposals[selectedProposal]
    if (!proposal || !proposal.tool) return

    setPhase('executing')

    const { result, narrative } = executeToolCall(
      state,
      playerClanId,
      proposal.tool,
      proposal.args,
    )

    const success = result?.success ?? false
    const grade: ResultGrade =
      result?.grade ?? (success ? 'success' : 'failure')

    // ナレーションを生成
    const richNarrative = await generateNarrative(
      leader.name,
      proposal.title,
      narrative,
      success,
    )

    // 家臣たちの反応を生成（新しいAPI）
    const retainerComments = await generateRetainerComments(
      state,
      playerClanId,
      proposal.title,
      narrative,
      grade,
      proposal.supporters,
      proposal.opponents,
    )

    const execResult = {
      tool: proposal.tool,
      narrative: richNarrative,
      success,
    }

    setExecutionResult({
      narrative: richNarrative,
      success,
      grade,
      retainerComments,
    })
    setPhase('result')

    // 親コンポーネントに通知
    onExecuteProposal?.(execResult)
  }

  // 新しい議題を開始
  const handleNewTopic = () => {
    setTopic(null)
    setStatements([])
    setProposals([])
    setPhase('input')
    setCurrentRound(0)
    setExecutionResult(null)
    setSelectedPreset(0)
    setIsCustomInput(false)
    setInput('')
    setShowDiscussionLog(false)
    setReportContent(null)
    setSelectedProposal(0)
  }

  return (
    <Box flexDirection="column">
      <Text bold underline>
        評定
      </Text>

      {/* 家臣一覧 */}
      <Box marginY={1}>
        <Text dimColor>
          参加者:{' '}
          {retainers.length > 0
            ? retainers.map((r) => r.name).join('、')
            : '（家臣なし）'}
        </Text>
      </Box>

      {/* 議題 */}
      {topic && (
        <Box marginBottom={1}>
          <Text>
            <Text color="cyan" bold>
              {leader.name}:
            </Text>{' '}
            「{topic}」
          </Text>
        </Box>
      )}

      {/* 状況報告フェーズ */}
      {phase === 'report' && (
        <Box flexDirection="column" marginY={1}>
          <Text bold color="yellow">
            ── 状況報告 ──
          </Text>
          {reportContent ? (
            <Box marginTop={1} marginLeft={1} flexDirection="column">
              <Text>{reportContent}</Text>
            </Box>
          ) : (
            <Box marginTop={1}>
              <Text color="yellow">
                <Spinner type="dots" />
              </Text>
              <Text dimColor> 報告を準備中...</Text>
            </Box>
          )}
          {reportContent && (
            <Box marginTop={1}>
              <Text dimColor>[Enter] 議題選択に戻る</Text>
            </Box>
          )}
        </Box>
      )}

      {/* 議論フェーズ */}
      {phase === 'discussing' && (
        <Box flexDirection="column" marginY={1}>
          <Box marginBottom={1}>
            <Text color="yellow">
              <Spinner type="dots" />
            </Text>
            <Text dimColor> 第{currentRound}回 議論中...</Text>
          </Box>

          {/* これまでの発言を表示 */}
          {statements.map((s, i) => {
            const style = getEmotionStyle(s.emotion)
            const isDelegate = s.isRepresentative === false
            return (
              <Box
                key={i}
                marginLeft={isDelegate ? 3 : 1}
                flexDirection="column"
              >
                <Box>
                  <Text>
                    {style.icon && `${style.icon} `}
                    {isDelegate && <Text dimColor>└ </Text>}
                    <Text bold color={isDelegate ? 'gray' : style.color}>
                      {s.bushoName}
                    </Text>
                    {s.targetName && <Text dimColor> →{s.targetName}に</Text>}
                    <Text>: </Text>
                  </Text>
                </Box>
                <Box marginLeft={2}>
                  <Text color={isDelegate ? 'gray' : style.color}>
                    「{s.statement}」
                  </Text>
                </Box>
              </Box>
            )
          })}
        </Box>
      )}

      {/* 提案選択フェーズ */}
      {phase === 'proposals' && (
        <Box flexDirection="column" marginY={1}>
          {/* 議論ログ（展開時） */}
          {showDiscussionLog ? (
            <Box flexDirection="column" marginBottom={1}>
              <Text bold color="yellow">
                ── 議論ログ ──
              </Text>
              {statements.map((s, i) => {
                const style = getEmotionStyle(s.emotion)
                const isDelegate = s.isRepresentative === false
                return (
                  <Box key={i} marginLeft={isDelegate ? 3 : 1}>
                    <Text>
                      {style.icon && `${style.icon} `}
                      {isDelegate && <Text dimColor>└ </Text>}
                      <Text color={isDelegate ? 'gray' : style.color} bold>
                        {s.bushoName}
                      </Text>
                      {s.targetName && <Text dimColor> →{s.targetName}</Text>}
                      <Text color={isDelegate ? 'gray' : style.color}>
                        : 「{s.statement}」
                      </Text>
                    </Text>
                  </Box>
                )
              })}
              <Box marginTop={1}>
                <Text dimColor>────────────</Text>
              </Box>
            </Box>
          ) : (
            <Box>
              <Text dimColor>── 議論終了（[Tab]で議論ログを表示）──</Text>
            </Box>
          )}

          <Text bold color="yellow">
            提案された行動案:
          </Text>
          {proposals.map((p, i) => (
            <Box key={i} flexDirection="column" marginY={1}>
              <Box>
                <Text
                  color={i === selectedProposal ? 'cyan' : 'white'}
                  bold={i === selectedProposal}
                >
                  {i === selectedProposal ? '▶ ' : '  '}
                  {i + 1}. {p.title}
                </Text>
              </Box>
              <Box marginLeft={4}>
                <Text dimColor>{p.description}</Text>
              </Box>
              <Box marginLeft={4}>
                {p.supporters.length > 0 && (
                  <Text color="green">賛成: {p.supporters.join('、')} </Text>
                )}
                {p.opponents.length > 0 && (
                  <Text color="red">反対: {p.opponents.join('、')}</Text>
                )}
              </Box>
            </Box>
          ))}

          {proposals.length === 0 && (
            <Text dimColor>（具体的な提案がまとまりませんでした）</Text>
          )}
        </Box>
      )}

      {/* 実行中フェーズ */}
      {phase === 'executing' && (
        <Box marginY={1}>
          <Text color="yellow">
            <Spinner type="dots" />
          </Text>
          <Text> 実行中...</Text>
        </Box>
      )}

      {/* 結果表示フェーズ */}
      {phase === 'result' && executionResult && (
        <Box flexDirection="column" marginY={1}>
          {/* 議論ログ（展開時） */}
          {showDiscussionLog && (
            <Box flexDirection="column" marginBottom={1}>
              <Text bold color="yellow">
                ── 議論ログ ──
              </Text>
              {statements.map((s, i) => {
                const style = getEmotionStyle(s.emotion)
                const isDelegate = s.isRepresentative === false
                return (
                  <Box key={i} marginLeft={isDelegate ? 3 : 1}>
                    <Text>
                      {style.icon && `${style.icon} `}
                      {isDelegate && <Text dimColor>└ </Text>}
                      <Text color={isDelegate ? 'gray' : style.color} bold>
                        {s.bushoName}
                      </Text>
                      {s.targetName && <Text dimColor> →{s.targetName}</Text>}
                      <Text color={isDelegate ? 'gray' : style.color}>
                        : 「{s.statement}」
                      </Text>
                    </Text>
                  </Box>
                )
              })}
              <Box marginTop={1}>
                <Text dimColor>────────────</Text>
              </Box>
            </Box>
          )}

          <Box
            borderStyle="round"
            paddingX={1}
            borderColor={
              executionResult.grade === 'critical_success'
                ? 'yellow'
                : executionResult.grade === 'critical_failure'
                  ? 'magenta'
                  : executionResult.success
                    ? 'green'
                    : 'red'
            }
          >
            <Text
              color={
                executionResult.grade === 'critical_success'
                  ? 'yellow'
                  : executionResult.grade === 'critical_failure'
                    ? 'magenta'
                    : executionResult.success
                      ? 'green'
                      : 'red'
              }
              bold
            >
              {executionResult.grade === 'critical_success'
                ? '★ 大成功！'
                : executionResult.grade === 'critical_failure'
                  ? '✗ 大失敗…'
                  : executionResult.success
                    ? '◎ 成功'
                    : '× 失敗'}
            </Text>
          </Box>
          <Box marginTop={1} marginLeft={1}>
            <Text>{executionResult.narrative}</Text>
          </Box>

          {/* 家臣たちの反応 */}
          {executionResult.retainerComments.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text dimColor>── 家臣の反応 ──</Text>
              {executionResult.retainerComments.map((c, i) => (
                <Box key={i} marginLeft={1}>
                  <Text>
                    <Text
                      bold
                      color={
                        c.emotion === 'praise'
                          ? 'green'
                          : c.emotion === 'concern'
                            ? 'yellow'
                            : c.emotion === 'angry'
                              ? 'red'
                              : c.emotion === 'relieved'
                                ? 'cyan'
                                : 'white'
                      }
                    >
                      {c.bushoName}:
                    </Text>{' '}
                    「{c.comment}」
                  </Text>
                </Box>
              ))}
            </Box>
          )}

          {/* ログ表示ヒント */}
          {!showDiscussionLog && (
            <Box marginTop={1}>
              <Text dimColor>[Tab] 議論ログを表示</Text>
            </Box>
          )}
        </Box>
      )}

      {/* 入力欄 */}
      {phase === 'input' && !isCustomInput && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="yellow">
            議題を選択:
          </Text>
          {PRESET_TOPICS.map((preset, i) => {
            const isReport = 'isReport' in preset && preset.isReport
            const isDisabled = isReport && reportUsed
            return (
              <Box key={i} marginLeft={1}>
                <Text
                  color={
                    isDisabled
                      ? 'gray'
                      : i === selectedPreset
                        ? 'cyan'
                        : 'white'
                  }
                  bold={i === selectedPreset && !isDisabled}
                  dimColor={isDisabled}
                >
                  {i === selectedPreset ? '▶ ' : '  '}
                  {i + 1}. {preset.label}
                  {isDisabled && '（使用済み）'}
                </Text>
                {preset.topic &&
                  preset.topic !== '__REPORT__' &&
                  i === selectedPreset &&
                  !isDisabled && (
                    <Text dimColor> - {preset.topic.slice(0, 25)}...</Text>
                  )}
              </Box>
            )
          })}
        </Box>
      )}

      {/* 自由入力モード */}
      {phase === 'input' && isCustomInput && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="yellow">
            自由入力:
          </Text>
          <Box marginTop={1}>
            <Text color="cyan">議題: </Text>
            <TextInput
              value={input}
              onChange={setInput}
              onSubmit={handleSubmitTopic}
              placeholder="家臣に問いたい事を入力..."
            />
          </Box>
        </Box>
      )}

      {/* フッター */}
      <Box marginTop={1}>
        <Text dimColor>
          {phase === 'input' &&
            !isCustomInput &&
            '[↑↓] 選択 [Enter] 決定 [1-7] クイック選択 [ESC] 戻る'}
          {phase === 'input' &&
            isCustomInput &&
            '[Enter] 評定を開く [ESC] 戻る'}
          {phase === 'report' && reportContent && '[Enter] 戻る'}
          {phase === 'report' && !reportContent && '報告中...'}
          {phase === 'discussing' && '議論中...'}
          {phase === 'proposals' &&
            '[↑↓] 選択 [Enter] 決定 [Tab] 議論ログ [ESC] 戻る'}
          {phase === 'result' && '[Enter] 新しい議題 [Tab] 議論ログ [ESC] 戻る'}
        </Text>
      </Box>
    </Box>
  )
}
