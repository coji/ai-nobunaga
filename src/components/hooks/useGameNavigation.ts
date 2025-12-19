// 画面ナビゲーション用カスタムフック

import { useState } from 'react'
import type { Letter } from '../../types.js'
import type { Screen } from '../types.js'

// 画面固有データ
export interface ScreenData {
  letter?: Letter
  gameOverReason?: string
  isVictory?: boolean
  castleId?: string // 委任設定画面用
}

interface ScreenState {
  screen: Screen
  index: number
  data: ScreenData
}

export function useGameNavigation() {
  const [screenStack, setScreenStack] = useState<ScreenState[]>([
    { screen: 'main', index: 0, data: {} },
  ])

  const currentScreenState = screenStack[screenStack.length - 1] ?? {
    screen: 'main' as const,
    index: 0,
    data: {},
  }
  const screen = currentScreenState.screen
  const selectedIndex = currentScreenState.index
  const screenData = currentScreenState.data

  const setSelectedIndex = (updater: number | ((prev: number) => number)) => {
    setScreenStack((prev) => {
      const newStack = [...prev]
      const current = newStack[newStack.length - 1]
      if (!current) return prev
      const newIndex =
        typeof updater === 'function' ? updater(current.index) : updater
      newStack[newStack.length - 1] = { ...current, index: newIndex }
      return newStack
    })
  }

  const pushScreen = (newScreen: Screen, data: ScreenData = {}) => {
    setScreenStack((prev) => [...prev, { screen: newScreen, index: 0, data }])
  }

  const popScreen = () => {
    setScreenStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))
  }

  const resetToMain = () => {
    setScreenStack([{ screen: 'main', index: 0, data: {} }])
  }

  const setScreen = (newScreen: Screen, data: ScreenData = {}) => {
    setScreenStack([{ screen: newScreen, index: 0, data }])
  }

  const getParentData = (): ScreenData => {
    if (screenStack.length >= 2) {
      return screenStack[screenStack.length - 2]?.data ?? {}
    }
    return {}
  }

  const getParentIndex = () => {
    if (screenStack.length >= 2) {
      return screenStack[screenStack.length - 2]?.index ?? 0
    }
    return 0
  }

  // 現在の画面データを更新
  const setScreenData = (data: Partial<ScreenData>) => {
    setScreenStack((prev) => {
      const newStack = [...prev]
      const current = newStack[newStack.length - 1]
      if (!current) return prev
      newStack[newStack.length - 1] = {
        ...current,
        data: { ...current.data, ...data },
      }
      return newStack
    })
  }

  return {
    screen,
    selectedIndex,
    screenData,
    setSelectedIndex,
    pushScreen,
    popScreen,
    resetToMain,
    setScreen,
    getParentData,
    getParentIndex,
    setScreenData,
  }
}
