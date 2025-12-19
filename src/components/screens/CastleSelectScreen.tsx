// 城選択画面コンポーネント

import { Box, Text } from 'ink'
import { useGameState, usePlayerClanId } from '../../store/gameStore.js'
import type { DelegationPolicy } from '../../types.js'
import { getLoyaltyColor } from '../utils.js'

// 委任方針の日本語ラベル
const DELEGATION_LABELS: Record<DelegationPolicy, string> = {
  none: '-',
  agriculture: '農業',
  commerce: '商業',
  military: '軍備',
  defense: '防衛',
  balanced: 'バランス',
}

interface Props {
  selectedIndex: number
}

export function CastleSelectScreen({ selectedIndex }: Props) {
  const state = useGameState()
  const playerClanId = usePlayerClanId()

  if (!state) return null

  const playerClan = state.clanCatalog.get(playerClanId)
  if (!playerClan) return null

  return (
    <Box flexDirection="column">
      <Text bold underline>
        城選択 [↑↓で選択] [Enter] 委任設定 [ESC] 戻る
      </Text>
      {playerClan.castleIds.map((castleId, index) => {
        const castle = state.castleCatalog.get(castleId)
        if (!castle) return null

        const castellan = castle.castellanId
          ? state.bushoCatalog.get(castle.castellanId)
          : null
        const isSelected = index === selectedIndex
        const loyaltyColor = getLoyaltyColor(castle.loyalty)
        const bushoLoyaltyColor = castellan
          ? getLoyaltyColor(castellan.emotions.loyalty)
          : 'green'
        const delegationLabel = DELEGATION_LABELS[castle.delegationPolicy]

        return (
          <Box key={castleId} flexDirection="column" marginY={isSelected ? 1 : 0}>
            <Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>
              {isSelected ? '▶ ' : '  '}
              {castle.name}（{castellan ? castellan.name : '空席'}）
            </Text>
            {isSelected && (
              <Box flexDirection="column" marginLeft={4}>
                <Text>
                  兵力: {castle.soldiers} | 防御: {castle.defense}
                </Text>
                <Text>
                  農業: {castle.agriculture} | 商業: {castle.commerce}
                </Text>
                <Text>
                  民忠: <Text color={loyaltyColor}>{castle.loyalty}</Text>
                </Text>
                {castellan && (
                  <Text>
                    城主忠誠: <Text color={bushoLoyaltyColor}>{castellan.emotions.loyalty}</Text>
                  </Text>
                )}
                <Text color="magenta">
                  委任: {delegationLabel}
                </Text>
              </Box>
            )}
          </Box>
        )
      })}
    </Box>
  )
}
