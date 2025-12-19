// 委任設定画面コンポーネント

import { Box, Text, useInput } from 'ink'
import { useState } from 'react'
import { useGameStore } from '../../store/gameStore.js'
import type { DelegationPolicy } from '../../types.js'

const POLICIES: { value: DelegationPolicy; label: string; desc: string }[] = [
  { value: 'none', label: 'なし', desc: '委任しない' },
  { value: 'agriculture', label: '農業', desc: '農業力+3〜6/ターン' },
  { value: 'commerce', label: '商業', desc: '商業力+3〜6/ターン' },
  { value: 'military', label: '軍備', desc: '兵+50〜100/ターン（金200消費）' },
  { value: 'defense', label: '防衛', desc: '防御力+2〜4/ターン' },
  { value: 'balanced', label: 'バランス', desc: '全て少しずつ成長' },
]

interface Props {
  castleId: string
  onClose: () => void
}

export function DelegationScreen({ castleId, onClose }: Props) {
  const { gameState, updateGameState } = useGameStore()
  const castle = gameState?.castleCatalog.get(castleId)
  const castellan = castle?.castellanId
    ? gameState?.bushoCatalog.get(castle.castellanId)
    : null

  const currentPolicyIndex = castle
    ? POLICIES.findIndex((p) => p.value === castle.delegationPolicy)
    : 0
  const [selectedIndex, setSelectedIndex] = useState(
    currentPolicyIndex >= 0 ? currentPolicyIndex : 0,
  )

  useInput((input, key) => {
    if (key.escape) {
      onClose()
      return
    }

    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(0, i - 1))
    }
    if (key.downArrow) {
      setSelectedIndex((i) => Math.min(POLICIES.length - 1, i + 1))
    }

    if (key.return) {
      const policy = POLICIES[selectedIndex]
      if (policy && castle) {
        updateGameState((state) => {
          const c = state.castleCatalog.get(castleId)
          if (c) {
            c.delegationPolicy = policy.value
          }
        })
        onClose()
      }
    }
  })

  if (!castle || !gameState) {
    return <Text color="red">城が見つかりません</Text>
  }

  // 城主がいない場合は委任不可
  if (!castellan) {
    return (
      <Box flexDirection="column">
        <Text bold underline>
          委任設定 - {castle.name}
        </Text>
        <Box marginY={1}>
          <Text color="yellow">城主が不在のため委任できません</Text>
        </Box>
        <Text dimColor>[ESC] 戻る</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Text bold underline>
        委任設定 - {castle.name}
      </Text>
      <Box marginY={1}>
        <Text>
          城主: <Text color="cyan">{castellan.name}</Text> (政治{' '}
          {castellan.politics})
        </Text>
      </Box>

      <Box flexDirection="column" marginY={1}>
        {POLICIES.map((policy, index) => {
          const isSelected = index === selectedIndex
          const isCurrent = policy.value === castle.delegationPolicy
          return (
            <Box key={policy.value}>
              <Text color={isSelected ? 'yellow' : 'white'}>
                {isSelected ? '▶ ' : '  '}
                {policy.label}
                {isCurrent ? ' [現在]' : ''}
              </Text>
              {isSelected && (
                <Text dimColor> - {policy.desc}</Text>
              )}
            </Box>
          )
        })}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          ※ 城主の政治力が高いほど成長量が増加します
        </Text>
      </Box>
      <Text dimColor>[↑↓] 選択 [Enter] 決定 [ESC] 戻る</Text>
    </Box>
  )
}
