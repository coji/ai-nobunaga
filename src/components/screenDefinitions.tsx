// 画面定義 - 各画面のコンポーネントと選択時の振る舞いを定義

import { Box, Text } from 'ink'
import type { ReactNode } from 'react'
import type { AITurnResult } from '../ai/index.js'
import type { GameState } from '../types.js'
import type { ScreenData } from './hooks/useGameNavigation.js'
import type { Screen } from './types.js'

import { MainMenu } from './menus/index.js'
import {
  AITurnScreen,
  CouncilScreen,
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

// 画面表示用プロパティ
export interface RenderProps {
  state: GameState
  playerClanId: string
  selectedIndex: number
  screenData: ScreenData
  parentData: ScreenData
  parentIndex: number
  aiResults: { clanName: string; result: AITurnResult }[]
  onCouncilProposal: (result: {
    tool: string
    narrative: string
    success: boolean
  }) => void
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
    render: ({ state, playerClanId, selectedIndex }) => (
      <StatusScreen
        state={state}
        playerClanId={playerClanId}
        selectedIndex={selectedIndex}
      />
    ),
  },

  status_map: {
    render: ({ state, playerClanId }) => (
      <MapScreen state={state} playerClanId={playerClanId} />
    ),
  },

  council: {
    render: ({ state, playerClanId, onCouncilProposal }) => (
      <CouncilScreen
        state={state}
        playerClanId={playerClanId}
        onExecuteProposal={onCouncilProposal}
      />
    ),
  },

  letters: {
    render: ({ state, screenData }) => (
      <LettersScreen state={state} currentLetter={screenData.letter || null} />
    ),
  },

  ai_turn: {
    render: ({ aiResults }) => <AITurnScreen aiResults={aiResults} />,
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
