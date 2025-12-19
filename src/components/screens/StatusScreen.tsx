// 勢力情報画面コンポーネント（折りたたみ式）

import { Box, Text } from 'ink'
import { useGameState, usePlayerClanId } from '../../store/gameStore.js'
import type { DelegationPolicy } from '../../types.js'
import { getDiplomacyLabel, getLoyaltyColor } from '../utils.js'

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

export function StatusScreen({ selectedIndex }: Props) {
  const state = useGameState()
  const playerClanId = usePlayerClanId()

  if (!state) return null

  const clans = [...state.clanCatalog.values()]

  return (
    <Box flexDirection="column">
      <Text bold underline>
        勢力情報 [↑↓で選択]
      </Text>
      {clans.map((clan, index) => {
        const leader = state.bushoCatalog.get(clan.leaderId)
        const isPlayer = clan.id === playerClanId
        const isSelected = index === selectedIndex
        const relation = state.diplomacyRelations.find(
          (r) =>
            (r.clan1Id === playerClanId && r.clan2Id === clan.id) ||
            (r.clan1Id === clan.id && r.clan2Id === playerClanId),
        )
        const totalSoldiers = clan.castleIds.reduce((sum, id) => {
          const c = state.castleCatalog.get(id)
          return sum + (c?.soldiers ?? 0)
        }, 0)

        // 折りたたまれた1行表示
        if (!isSelected) {
          return (
            <Box key={clan.id}>
              <Text dimColor={!isPlayer}>
                {' '}
                {clan.name}
                {isPlayer && '*'} - {leader?.name} | 城{clan.castleIds.length}{' '}
                兵{totalSoldiers}
                {relation && ` [${getDiplomacyLabel(relation.type)}]`}
              </Text>
            </Box>
          )
        }

        // 所属武将一覧を取得（当主除く）
        const retainers = [...state.bushoCatalog.values()].filter(
          (b) => b.clanId === clan.id && b.id !== clan.leaderId,
        )

        // 展開された詳細表示
        return (
          <Box key={clan.id} flexDirection="column" marginY={1}>
            <Text color={isPlayer ? 'cyan' : 'yellow'} bold>
              ▶ {clan.name} {isPlayer && '(あなた)'}
            </Text>
            <Text>
              　当主: {leader?.name} | 金: {clan.gold} | 兵糧: {clan.food} | 武将: {retainers.length + 1}人
            </Text>
            {clan.castleIds.map((id) => {
              const castle = state.castleCatalog.get(id)
              if (!castle) return null
              const castellan = castle.castellanId
                ? state.bushoCatalog.get(castle.castellanId)
                : null
              const loyaltyColor = getLoyaltyColor(castle.loyalty)
              const bushoLoyaltyColor = castellan
                ? getLoyaltyColor(castellan.emotions.loyalty)
                : 'green'
              const delegationLabel = DELEGATION_LABELS[castle.delegationPolicy]
              return (
                <Text key={id}>
                  　　{castle.name}（
                  {castellan ? (
                    <Text color={bushoLoyaltyColor}>{castellan.name}</Text>
                  ) : (
                    '空席'
                  )}
                  ）: 兵{castle.soldiers} 農{castle.agriculture} 商
                  {castle.commerce} 防{castle.defense} 民忠
                  <Text color={loyaltyColor}>{castle.loyalty}</Text>
                  {isPlayer && castle.delegationPolicy !== 'none' && (
                    <Text color="magenta"> 委任:{delegationLabel}</Text>
                  )}
                </Text>
              )
            })}
            {/* 武将一覧（プレイヤー勢力のみ詳細表示） */}
            {isPlayer && retainers.length > 0 && (
              <Box flexDirection="column" marginTop={1}>
                <Text dimColor>　── 家臣 ──</Text>
                {retainers.map((busho) => {
                  const loyaltyColor = getLoyaltyColor(busho.emotions.loyalty)
                  // 城主かどうか確認
                  const isCastellan = clan.castleIds.some((cid) => {
                    const c = state.castleCatalog.get(cid)
                    return c?.castellanId === busho.id
                  })
                  return (
                    <Text key={busho.id}>
                      　　{busho.name}
                      {isCastellan && <Text color="cyan">（城主）</Text>}
                      : 政{busho.politics} 武{busho.warfare} 知{busho.intelligence} 魅{busho.charisma}
                      {' '}忠誠<Text color={loyaltyColor}>{busho.emotions.loyalty}</Text>
                    </Text>
                  )
                })}
              </Box>
            )}
            {!isPlayer && relation && (
              <Text dimColor>　関係: {getDiplomacyLabel(relation.type)}</Text>
            )}
            {isPlayer && (
              <Text color="green">　[Enter] 委任設定</Text>
            )}
          </Box>
        )
      })}
    </Box>
  )
}
