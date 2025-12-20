// zustand による状態管理ストア（Command Pattern 使用）

import { create } from 'zustand'
import type { AITurnResult } from '../ai/turn.js'
import {
  createCommand,
  EndTurnCommand,
  type CommandResult,
  type GameCommand,
} from '../commands/index.js'
import type { GameState } from '../types.js'

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

  // コマンド履歴（将来のUndo/Redo用）
  commandHistory: GameCommand[]

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

  // コマンド実行
  executeCommand: (clanId: string, command: GameCommand) => CommandResult

  // ツール名から実行（AI/UI互換用）
  executeToolCall: (
    clanId: string,
    toolName: string,
    args: Record<string, unknown>,
  ) => CommandResult | null

  // ターン終了処理
  processTurnEnd: () => string[]
}

export const useGameStore = create<GameStore>()((set, get) => ({
  // 初期値
  gameState: null,
  commandHistory: [],
  message: '',
  isProcessing: false,
  actionsRemaining: 3,
  aiResults: [],
  maxActions: 3,

  // Game State アクション
  initializeState: (state) => {
    set({
      gameState: state,
      actionsRemaining: 3,
      message: '',
      isProcessing: false,
      aiResults: [],
      commandHistory: [],
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
    set({ message })
  },

  setIsProcessing: (isProcessing) => {
    set({ isProcessing })
  },

  setActionsRemaining: (remaining) => {
    set({ actionsRemaining: remaining })
  },

  resetActions: () => {
    set({ actionsRemaining: get().maxActions })
  },

  addAiResult: (clanName, result) => {
    set({ aiResults: [...get().aiResults, { clanName, result }] })
  },

  clearAiResults: () => {
    set({ aiResults: [] })
  },

  // コマンド実行（純粋関数のため状態を置き換える）
  executeCommand: (clanId, command) => {
    const state = get().gameState
    if (!state) {
      throw new Error('Game state not initialized')
    }

    // コマンドを実行（純粋関数: 新しい状態を返す）
    const result = command.execute(state, clanId)

    // 状態を更新
    set({
      gameState: result.newState,
      commandHistory: [...get().commandHistory, command],
    })

    return result
  },

  // ツール名から実行（createCommand でコマンドを生成）
  executeToolCall: (clanId, toolName, args) => {
    const command = createCommand(toolName, args)
    if (!command) {
      console.warn(`Unknown tool: ${toolName}`)
      return null
    }
    return get().executeCommand(clanId, command)
  },

  // ターン終了処理
  processTurnEnd: () => {
    const command = new EndTurnCommand()
    const result = get().executeCommand('', command)
    return result.result.stateChanges
  },
}))

// セレクター（よく使うデータへのアクセサ）
export const usePlayerClanId = () =>
  useGameStore((s) => s.gameState?.playerClanId ?? '')

export const usePlayerClan = () =>
  useGameStore((s) => {
    if (!s.gameState) return null
    return s.gameState.clanCatalog[s.gameState.playerClanId]
  })

export const usePlayerLeader = () =>
  useGameStore((s) => {
    if (!s.gameState) return null
    const clan = s.gameState.clanCatalog[s.gameState.playerClanId]
    if (!clan) return null
    return s.gameState.bushoCatalog[clan.leaderId]
  })

export const useTurn = () => useGameStore((s) => s.gameState?.turn ?? 0)

export const useIsGameInitialized = () =>
  useGameStore((s) => s.gameState !== null)

// GameState 全体を取得（Screen コンポーネント用）
export const useGameState = () => useGameStore((s) => s.gameState)

// AI ターン結果を取得
export const useAiResults = () => useGameStore((s) => s.aiResults)
