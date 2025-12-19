// メインメニューコンポーネント

import { Box, Text } from 'ink'

interface Props {
  selectedIndex: number
}

export function MainMenu({ selectedIndex }: Props) {
  const options = [
    { key: '1', label: '勢力情報', desc: '自勢力と他勢力の状況を確認' },
    { key: '2', label: '評定', desc: '家臣と相談して行動を決める' },
    { key: '3', label: '書状', desc: '受け取った書状を確認' },
    { key: '4', label: 'ターン終了', desc: 'AI勢力が行動します' },
  ]

  return (
    <Box flexDirection="column">
      <Text bold underline>
        コマンド
      </Text>
      {options.map((opt, i) => (
        <Box key={opt.key}>
          {i === selectedIndex ? (
            <Text color="cyan">
              ▶ [{opt.key}] {opt.label}
            </Text>
          ) : (
            <Text>
              {'  '}[{opt.key}] {opt.label}
            </Text>
          )}
          <Text dimColor> - {opt.desc}</Text>
        </Box>
      ))}
    </Box>
  )
}
