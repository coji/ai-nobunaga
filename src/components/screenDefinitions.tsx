// 画面定義 - 各画面のコンポーネントと選択時の振る舞いを定義

import { Box, Text } from 'ink'
import type { ReactNode } from 'react'
import type { GameState } from '../types.js'
import type { ScreenData } from './hooks/useGameNavigation.js'
import type { Screen } from './types.js'

import { MainMenu } from './menus/index.js'
import {
  AITurnScreen,
  CastleSelectScreen,
  CouncilScreen,
  DelegationScreen,
  LettersScreen,
  MapScreen,
  StatusMenu,
  StatusScreen,
} from './screens/index.js'

// 勢力情報サブメニューオプション
const STATUS_OPTIONS: Screen[] = ['status_list', 'status_map']

// 画面操作用コンテキスト
export interface ScreenContext {
  // ナビゲーション
  pushScreen: (screen: Screen, data?: ScreenData) => void
  selectedIndex: number
  screenData: ScreenData
  getParentIndex: () => number
  getParentData: () => ScreenData
  // 状態
  state: GameState
  // アクション
  processEndTurn: () => void
  handleCouncilProposal: (result: {
    tool: string
    narrative: string
    success: boolean
  }) => void
}

// 画面表示用プロパティ（簡素化：多くのコンポーネントは Store から直接取得）
export interface RenderProps {
  state: GameState
  playerClanId: string
  selectedIndex: number
  screenData: ScreenData
  popScreen: () => void
  onCouncilProposal: (result: {
    tool: string
    narrative: string
    success: boolean
  }) => void
  actionsRemaining: number
  onTurnEnd: () => void
}

// 画面定義の型
interface ScreenDefinition {
  render: (props: RenderProps) => ReactNode
  onSelect?: (ctx: ScreenContext) => void
}

// メニューオプション定義（シンプル化）
const MAIN_OPTIONS: Screen[] = ['status', 'council', 'letters']

// 画面定義
export const screenDefinitions: Record<Screen, ScreenDefinition> = {
  main: {
    render: ({ selectedIndex }) => <MainMenu selectedIndex={selectedIndex} />,
    onSelect: (ctx) => {
      const selected = MAIN_OPTIONS[ctx.selectedIndex]
      if (selected === undefined) {
        // end_turn (index 3)
        ctx.processEndTurn()
      } else {
        ctx.pushScreen(selected)
      }
    },
  },

  status: {
    render: ({ selectedIndex }) => <StatusMenu selectedIndex={selectedIndex} />,
    onSelect: (ctx) => {
      const selected = STATUS_OPTIONS[ctx.selectedIndex]
      if (selected) {
        ctx.pushScreen(selected)
      }
    },
  },

  status_list: {
    render: ({ selectedIndex }) => <StatusScreen selectedIndex={selectedIndex} />,
    onSelect: (ctx) => {
      // 選択した勢力が自国なら城選択画面へ
      const clans = Object.values(ctx.state.clanCatalog)
      const selectedClan = clans[ctx.selectedIndex]
      if (selectedClan && selectedClan.id === ctx.state.playerClanId) {
        ctx.pushScreen('castle_select')
      }
    },
  },

  status_map: {
    render: () => <MapScreen />,
  },

  castle_select: {
    render: ({ selectedIndex }) => (
      <CastleSelectScreen selectedIndex={selectedIndex} />
    ),
    onSelect: (ctx) => {
      // 選択した城の委任設定画面へ
      const playerClan = ctx.state.clanCatalog[ctx.state.playerClanId]
      if (playerClan) {
        const castleId = playerClan.castleIds[ctx.selectedIndex]
        if (castleId) {
          ctx.pushScreen('delegation', { castleId })
        }
      }
    },
  },

  delegation: {
    render: ({ screenData, popScreen }) => (
      <DelegationScreen
        castleId={screenData.castleId || ''}
        onClose={popScreen}
      />
    ),
  },

  council: {
    render: ({
      state,
      playerClanId,
      onCouncilProposal,
      actionsRemaining,
      onTurnEnd,
    }) => (
      <CouncilScreen
        state={state}
        playerClanId={playerClanId}
        onExecuteProposal={onCouncilProposal}
        actionsRemaining={actionsRemaining}
        onTurnEnd={onTurnEnd}
      />
    ),
  },

  letters: {
    render: ({ screenData }) => (
      <LettersScreen currentLetter={screenData.letter || null} />
    ),
  },

  ai_turn: {
    render: () => <AITurnScreen />,
  },

  confirm_exit: {
    render: () => (
      <Box flexDirection="column">
        <Text bold color="yellow">
          ゲームを終了しますか？
        </Text>
        <Text>[Y] はい {'  '} [N] いいえ</Text>
      </Box>
    ),
  },

  game_over: {
    render: ({ screenData }) => (
      <Box flexDirection="column" alignItems="center" paddingY={2}>
        <Text bold color={screenData.isVictory ? 'green' : 'red'}>
          {screenData.isVictory ? '天下統一！' : '滅亡...'}
        </Text>
        <Box marginY={1}>
          <Text>{screenData.gameOverReason}</Text>
        </Box>
        <Text dimColor>[ESC] 終了</Text>
      </Box>
    ),
  },
}
