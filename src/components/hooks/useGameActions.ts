// ゲームアクション用カスタムフック（zustand store 使用版）

import { useCallback, useRef } from 'react'
import { executeAITurn } from '../../ai/index.js'
import { checkVictory, processTurnEnd } from '../../engine.js'
import { useGameStore } from '../../store/gameStore.js'
import type { Screen } from '../types.js'
import type { ScreenData } from './useGameNavigation.js'

interface UseGameActionsProps {
  resetToMain: () => void
  setScreen: (screen: Screen, data?: ScreenData) => void
}

export function useGameActions({
  resetToMain,
  setScreen,
}: UseGameActionsProps) {
  const {
    message,
    isProcessing,
    actionsRemaining,
    aiResults,
    maxActions,
    setMessage,
    setIsProcessing,
    setActionsRemaining,
    resetActions,
    addAiResult,
    clearAiResults,
    updateGameState,
    getState,
  } = useGameStore()

  // processEndTurn への参照を保持（循環依存を解消）
  const processEndTurnRef = useRef<() => Promise<void>>(undefined)

  const consumeAction = useCallback(() => {
    const remaining = actionsRemaining - 1
    setActionsRemaining(remaining)
    return remaining
  }, [actionsRemaining, setActionsRemaining])

  const handleCouncilProposal = useCallback(
    (result: { tool: string; narrative: string; success: boolean }) => {
      if (actionsRemaining <= 0) {
        setMessage('行動ポイントがありません')
        return
      }

      setMessage(result.narrative)

      // immer により変更は自動で検知されるため、
      // Map の新規作成は不要になった
      // updateGameState を呼ぶ必要もない（engine 側で既に変更済み）

      // 行動ポイントを消費
      // 注: 最後の行動後は CouncilScreen で結果確認後に processEndTurn を呼ぶ
      consumeAction()
    },
    [actionsRemaining, setMessage, consumeAction],
  )

  const processEndTurn = useCallback(async () => {
    setIsProcessing(true)
    setScreen('ai_turn')
    clearAiResults()

    const state = getState()
    const playerClan = state.clanCatalog.get(state.playerClanId)
    if (!playerClan) {
      throw new Error(`Clan not found: ${state.playerClanId}`)
    }

    try {
      for (const clan of state.clanCatalog.values()) {
        if (clan.id === playerClan.id) continue

        setMessage(`${clan.name}が思考中...`)
        const result = await executeAITurn(state, clan.id)
        addAiResult(clan.name, result)
      }

      // ターン終了処理（immer の draft を通じて実行）
      updateGameState((draft) => {
        processTurnEnd(draft)
      })

      const currentState = getState()
      setMessage(`ターン${currentState.turn}開始`)
      resetActions()

      const victory = checkVictory(currentState)
      if (victory.gameOver) {
        setIsProcessing(false)
        setScreen('game_over', {
          gameOverReason: victory.reason || 'ゲーム終了',
          isVictory: victory.winner === playerClan.id,
        })
        return
      }
    } catch (e) {
      setMessage(`エラー: ${e}`)
    } finally {
      setIsProcessing(false)
      resetToMain()
    }
  }, [
    setIsProcessing,
    setScreen,
    clearAiResults,
    getState,
    setMessage,
    addAiResult,
    updateGameState,
    resetActions,
    resetToMain,
  ])

  // ref を最新の processEndTurn に更新
  processEndTurnRef.current = processEndTurn

  return {
    message,
    isProcessing,
    actionsRemaining,
    aiResults,
    maxActions,
    handleCouncilProposal,
    processEndTurn,
  }
}
