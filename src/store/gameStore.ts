// zustand + immer による状態管理ストア

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { executeToolCall as executeToolCallFn } from '../ai/executor.js'
import { processTurnEnd as processTurnEndFn } from '../engine/turn.js'
import type { AITurnResult } from '../ai/index.js'
import type { ActionResult, GameState } from '../types.js'

// executeToolCall の戻り値型
interface ExecuteResult {
  result: ActionResult | null
  narrative: string
  endTurn: boolean
}

// UI State（コンポーネント間で共有する状態）
interface UIState {
  message: string
  isProcessing: boolean
  actionsRemaining: number
  aiResults: { clanName: string; result: AITurnResult }[]
}

// Store の型定義
interface GameStore extends UIState {
  // Game State
  gameState: GameState | null

  // 定数
  maxActions: number

  // Game State アクション
  initializeState: (state: GameState) => void
  getState: () => GameState

  // UI State アクション
  setMessage: (message: string) => void
  setIsProcessing: (isProcessing: boolean) => void
  setActionsRemaining: (remaining: number) => void
  resetActions: () => void
  addAiResult: (clanName: string, result: AITurnResult) => void
  clearAiResults: () => void

  // ゲームアクション（engine 関数をラップ）
  executeGameAction: (
    executor: (state: GameState) => ActionResult,
  ) => ActionResult
  updateGameState: (updater: (state: GameState) => void) => void

  // ツール実行（CouncilScreen などから使用）
  executeToolCall: (
    clanId: string,
    toolName: string,
    args: Record<string, unknown>,
  ) => ExecuteResult

  // ターン終了処理
  processTurnEnd: () => string[]
}

export const useGameStore = create<GameStore>()(
  immer((set, get) => ({
    // 初期値
    gameState: null,
    message: '',
    isProcessing: false,
    actionsRemaining: 3,
    aiResults: [],
    maxActions: 3,

    // Game State アクション
    initializeState: (state) => {
      set((draft) => {
        draft.gameState = state
        draft.actionsRemaining = draft.maxActions
        draft.message = ''
        draft.isProcessing = false
        draft.aiResults = []
      })
    },

    getState: () => {
      const state = get().gameState
      if (!state) {
        throw new Error('Game state not initialized')
      }
      return state
    },

    // UI State アクション
    setMessage: (message) => {
      set((draft) => {
        draft.message = message
      })
    },

    setIsProcessing: (isProcessing) => {
      set((draft) => {
        draft.isProcessing = isProcessing
      })
    },

    setActionsRemaining: (remaining) => {
      set((draft) => {
        draft.actionsRemaining = remaining
      })
    },

    resetActions: () => {
      set((draft) => {
        draft.actionsRemaining = draft.maxActions
      })
    },

    addAiResult: (clanName, result) => {
      set((draft) => {
        draft.aiResults.push({ clanName, result })
      })
    },

    clearAiResults: () => {
      set((draft) => {
        draft.aiResults = []
      })
    },

    // ゲームアクション実行（engine 関数をラップ）
    // executor は draft を受け取り、直接ミューテーションして結果を返す
    executeGameAction: (executor) => {
      let result: ActionResult | undefined

      set((draft) => {
        if (!draft.gameState) {
          throw new Error('Game state not initialized')
        }
        // immer の draft を通じて engine 関数を実行
        // engine 関数は draft を直接ミューテーションする
        result = executor(draft.gameState as GameState)
      })

      if (!result) {
        throw new Error('Action executor did not return a result')
      }
      return result
    },

    // 汎用的な状態更新（ターン終了処理など）
    updateGameState: (updater) => {
      set((draft) => {
        if (!draft.gameState) {
          throw new Error('Game state not initialized')
        }
        updater(draft.gameState as GameState)
      })
    },

    // ツール実行（CouncilScreen などから使用）
    // immer の draft を通じて state を変更し、React に変更を検知させる
    executeToolCall: (clanId, toolName, args) => {
      let execResult: ExecuteResult | undefined

      set((draft) => {
        if (!draft.gameState) {
          throw new Error('Game state not initialized')
        }
        // immer の draft を通じて executeToolCall を実行
        execResult = executeToolCallFn(
          draft.gameState as GameState,
          clanId,
          toolName,
          args,
        )
      })

      if (!execResult) {
        throw new Error('executeToolCall did not return a result')
      }
      return execResult
    },

    // ターン終了処理（immer の draft を通じて実行）
    processTurnEnd: () => {
      let changes: string[] = []

      set((draft) => {
        if (!draft.gameState) {
          throw new Error('Game state not initialized')
        }
        changes = processTurnEndFn(draft.gameState as GameState)
      })

      return changes
    },
  })),
)

// セレクター（よく使うデータへのアクセサ）
export const usePlayerClanId = () =>
  useGameStore((s) => s.gameState?.playerClanId ?? '')

export const usePlayerClan = () =>
  useGameStore((s) => {
    if (!s.gameState) return null
    return s.gameState.clanCatalog.get(s.gameState.playerClanId)
  })

export const usePlayerLeader = () =>
  useGameStore((s) => {
    if (!s.gameState) return null
    const clan = s.gameState.clanCatalog.get(s.gameState.playerClanId)
    if (!clan) return null
    return s.gameState.bushoCatalog.get(clan.leaderId)
  })

export const useTurn = () => useGameStore((s) => s.gameState?.turn ?? 0)

export const useIsGameInitialized = () =>
  useGameStore((s) => s.gameState !== null)

// GameState 全体を取得（Screen コンポーネント用）
export const useGameState = () => useGameStore((s) => s.gameState)

// AI ターン結果を取得
export const useAiResults = () => useGameStore((s) => s.aiResults)
