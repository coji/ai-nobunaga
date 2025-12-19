// メインゲームUIコンポーネント

import { Box, Text, useApp, useInput } from 'ink'
import Spinner from 'ink-spinner'
import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore.js'
import type { GameState } from '../types.js'

// フック
import { useGameActions, useGameNavigation } from './hooks/index.js'

// 画面定義
import {
  screenDefinitions,
  type RenderProps,
  type ScreenContext,
} from './screenDefinitions.js'

interface Props {
  initialState: GameState
}

export function GameUI({ initialState }: Props) {
  const { exit } = useApp()

  // Store から状態とアクションを取得
  const { gameState, initializeState } = useGameStore()

  // 初回マウント時に Store を初期化
  useEffect(() => {
    initializeState(initialState)
  }, [initialState, initializeState])

  const nav = useGameNavigation()
  const actions = useGameActions({
    resetToMain: nav.resetToMain,
    setScreen: nav.setScreen,
  })

  // 現在の画面定義（gameState が null でも安全に取得）
  const currentScreen = screenDefinitions[nav.screen]

  // useInput は常に呼び出す（Hooks のルール）
  useInput((input, key) => {
    // gameState が未初期化または処理中は無視
    if (!gameState || actions.isProcessing) return

    // ゲーム終了画面
    if (nav.screen === 'game_over') {
      if (key.escape) exit()
      return
    }

    // 終了確認画面
    if (nav.screen === 'confirm_exit') {
      if (input === 'y' || input === 'Y') {
        exit()
      } else if (input === 'n' || input === 'N' || key.escape) {
        nav.popScreen()
      }
      return
    }

    // テキスト入力がある画面ではBackspaceを戻るに使わない
    const hasTextInput = nav.screen === 'council'

    // ESCで戻る（テキスト入力画面以外ではBackspaceでも戻る）
    if (key.escape || (!hasTextInput && (key.backspace || key.delete))) {
      if (nav.screen === 'main') {
        if (key.escape) nav.pushScreen('confirm_exit')
      } else {
        nav.popScreen()
      }
      return
    }

    // 上下キー
    if (key.upArrow) nav.setSelectedIndex((i) => Math.max(0, i - 1))
    if (key.downArrow) nav.setSelectedIndex((i) => i + 1)

    // 選択
    if (key.return) {
      const playerClan = gameState.clanCatalog.get(gameState.playerClanId)
      if (!playerClan) return

      const screenContext: ScreenContext = {
        pushScreen: nav.pushScreen,
        selectedIndex: nav.selectedIndex,
        screenData: nav.screenData,
        getParentIndex: nav.getParentIndex,
        getParentData: nav.getParentData,
        state: gameState,
        processEndTurn: actions.processEndTurn,
        handleCouncilProposal: actions.handleCouncilProposal,
      }
      currentScreen.onSelect?.(screenContext)
    }

    // 数字キー
    const num = parseInt(input, 10)
    if (!Number.isNaN(num) && num >= 1 && num <= 9) {
      nav.setSelectedIndex(num - 1)
      setTimeout(() => {
        if (!gameState) return
        const playerClan = gameState.clanCatalog.get(gameState.playerClanId)
        if (!playerClan) return

        const screenContext: ScreenContext = {
          pushScreen: nav.pushScreen,
          selectedIndex: num - 1,
          screenData: nav.screenData,
          getParentIndex: nav.getParentIndex,
          getParentData: nav.getParentData,
          state: gameState,
          processEndTurn: actions.processEndTurn,
          handleCouncilProposal: actions.handleCouncilProposal,
        }
        currentScreen.onSelect?.(screenContext)
      }, 50)
    }
  })

  // Store が初期化されるまで待機
  if (!gameState) {
    return (
      <Box padding={1}>
        <Text>
          <Spinner type="dots" /> 初期化中...
        </Text>
      </Box>
    )
  }

  const playerClan = gameState.clanCatalog.get(gameState.playerClanId)
  if (!playerClan) {
    throw new Error(`Clan not found: ${gameState.playerClanId}`)
  }
  const playerLeader = gameState.bushoCatalog.get(playerClan.leaderId)
  if (!playerLeader) {
    throw new Error(`Leader not found: ${playerClan.leaderId}`)
  }

  // 画面表示用プロパティ（簡素化：多くは Store から直接取得）
  const renderProps: RenderProps = {
    state: gameState,
    playerClanId: playerClan.id,
    selectedIndex: nav.selectedIndex,
    screenData: nav.screenData,
    onCouncilProposal: actions.handleCouncilProposal,
  }

  return (
    <Box flexDirection="column" padding={1}>
      {/* ヘッダー */}
      <Box borderStyle="double" paddingX={2}>
        <Text bold color="yellow">
          npx 信長
        </Text>
        <Text> - ターン {gameState.turn} - </Text>
        <Text color="cyan">{playerClan.name}</Text>
        <Text> ({playerLeader.name})</Text>
      </Box>

      {/* ステータスバー */}
      <Box marginY={1}>
        <Text>
          金: <Text color="yellow">{playerClan.gold}</Text> | 兵糧:{' '}
          <Text color="green">{playerClan.food}</Text> | 兵:{' '}
          <Text color="red">
            {playerClan.castleIds.reduce(
              (sum, id) =>
                sum + (gameState.castleCatalog.get(id)?.soldiers || 0),
              0,
            )}
          </Text>{' '}
          | 城: <Text color="cyan">{playerClan.castleIds.length}</Text> | 行動:{' '}
          <Text color="magenta">
            {actions.actionsRemaining}/{actions.maxActions}
          </Text>
        </Text>
      </Box>

      {/* メインコンテンツ */}
      {currentScreen.render(renderProps)}

      {/* メッセージ */}
      {actions.message && (
        <Box marginTop={1} borderStyle="single" paddingX={1}>
          {actions.isProcessing && (
            <Text color="green">
              <Spinner type="dots" />{' '}
            </Text>
          )}
          <Text>{actions.message}</Text>
        </Box>
      )}

      {/* フッター */}
      <Box marginTop={1}>
        <Text dimColor>
          [↑↓] 選択 [Enter] 決定 [BS/ESC] 戻る [1-9] クイック選択
        </Text>
      </Box>
    </Box>
  )
}
