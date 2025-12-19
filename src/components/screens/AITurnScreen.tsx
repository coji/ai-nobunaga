// AI行動画面コンポーネント

import { Box, Text } from 'ink'
import { useAiResults } from '../../store/gameStore.js'

// ツール名を日本語に変換
function getToolDisplayName(tool: string): string {
  const toolNames: Record<string, string> = {
    develop_agriculture: '農業開発',
    develop_commerce: '商業開発',
    recruit_soldiers: '徴兵',
    fortify: '城郭強化',
    attack: '攻撃',
    propose_alliance: '同盟申込',
    send_gift: '贈答',
    threaten: '威嚇',
    bribe: '買収',
    spread_rumor: '流言',
  }
  return toolNames[tool] || tool
}

// narrativeを整形（undefined除去、簡潔化）
function formatNarrative(narrative: string): string {
  // "undefined: " を除去
  let text = narrative.replace(/^undefined:\s*/, '')
  // "失敗 - " の重複を整理
  text = text.replace(/^失敗\s*-\s*/, '')
  return text
}

export function AITurnScreen() {
  const aiResults = useAiResults()

  return (
    <Box flexDirection="column">
      <Text bold underline>
        AI勢力の行動
      </Text>
      {aiResults.map(({ clanName, result }) => (
        <Box key={clanName} flexDirection="column" marginY={1}>
          <Text bold color="cyan">
            {clanName}
          </Text>
          {result.actions.length === 0 ? (
            <Text dimColor> 様子見</Text>
          ) : (
            result.actions.map((action) => (
              <Box
                key={`${clanName}-${action.tool}-${action.narrative}`}
                marginLeft={1}
              >
                <Text color={action.success ? 'green' : 'red'}>
                  {action.success ? '○' : '×'} {getToolDisplayName(action.tool)}
                  : {formatNarrative(action.narrative)}
                </Text>
              </Box>
            ))
          )}
        </Box>
      ))}
    </Box>
  )
}
