// プレイログシステム - 全アクションを記録してファイル出力

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { ActionResult, GameState, ResultGrade } from '../types.js'

/** 単一アクションのログエントリ */
export interface PlayLogEntry {
  timestamp: string
  turn: number
  phase: 'player' | 'ai' | 'council'
  clanId: string
  clanName: string
  action: {
    type: string
    params: Record<string, unknown>
  }
  result: {
    success: boolean
    grade: ResultGrade
    message: string
    stateChanges: string[]
  }
  /** アクション後のスナップショット（リソース等） */
  snapshot?: {
    gold: number
    food: number
    totalSoldiers: number
    castleCount: number
  }
}

/** ターン終了時のサマリー */
export interface TurnSummary {
  turn: number
  clans: {
    clanId: string
    clanName: string
    gold: number
    food: number
    totalSoldiers: number
    castleCount: number
    bushoCount: number
  }[]
}

/** ゲーム全体のプレイログ */
export interface PlayLog {
  gameId: string
  startedAt: string
  endedAt?: string
  playerClanId: string
  entries: PlayLogEntry[]
  turnSummaries: TurnSummary[]
  result?: {
    winner: string
    turns: number
    reason: string
  }
}

/** プレイログマネージャー */
class PlayLogManager {
  private currentLog: PlayLog | null = null
  private logsDir: string

  constructor() {
    this.logsDir = path.join(process.cwd(), 'logs')
  }

  /** 日時を見やすい形式にフォーマット */
  private formatDateTime(date: Date): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const h = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${d}_${h}-${min}`
  }

  /** 新しいゲームセッション開始 */
  startSession(playerClanId: string): void {
    const now = new Date()
    this.currentLog = {
      gameId: `game_${this.formatDateTime(now)}`,
      startedAt: now.toISOString(),
      playerClanId,
      entries: [],
      turnSummaries: [],
    }
  }

  /** アクションを記録 */
  logAction(
    state: GameState,
    clanId: string,
    phase: 'player' | 'ai' | 'council',
    actionType: string,
    params: Record<string, unknown>,
    result: ActionResult,
  ): void {
    if (!this.currentLog) return

    const clan = state.clanCatalog[clanId]
    if (!clan) return

    // 勢力のスナップショットを取得
    const totalSoldiers = clan.castleIds.reduce((sum, castleId) => {
      const castle = state.castleCatalog[castleId]
      return sum + (castle?.soldiers ?? 0)
    }, 0)

    const entry: PlayLogEntry = {
      timestamp: new Date().toISOString(),
      turn: state.turn,
      phase,
      clanId,
      clanName: clan.name,
      action: {
        type: actionType,
        params,
      },
      result: {
        success: result.success,
        grade: result.grade,
        message: result.message,
        stateChanges: result.stateChanges,
      },
      snapshot: {
        gold: clan.gold,
        food: clan.food,
        totalSoldiers,
        castleCount: clan.castleIds.length,
      },
    }

    this.currentLog.entries.push(entry)
  }

  /** ターン終了時のサマリーを記録 */
  logTurnEnd(state: GameState): void {
    if (!this.currentLog) return

    const clans = Object.values(state.clanCatalog).map((clan) => {
      const totalSoldiers = clan.castleIds.reduce((sum, castleId) => {
        const castle = state.castleCatalog[castleId]
        return sum + (castle?.soldiers ?? 0)
      }, 0)

      const bushoCount = Object.values(state.bushoCatalog).filter(
        (b) => b.clanId === clan.id,
      ).length

      return {
        clanId: clan.id,
        clanName: clan.name,
        gold: clan.gold,
        food: clan.food,
        totalSoldiers,
        castleCount: clan.castleIds.length,
        bushoCount,
      }
    })

    this.currentLog.turnSummaries.push({
      turn: state.turn,
      clans,
    })
  }

  /** ゲーム終了を記録 */
  endSession(winner: string, reason: string): void {
    if (!this.currentLog) return

    this.currentLog.endedAt = new Date().toISOString()
    this.currentLog.result = {
      winner,
      turns: this.currentLog.turnSummaries.length,
      reason,
    }

    this.saveToFile()
  }

  /** ファイルに保存 */
  private saveToFile(): void {
    if (!this.currentLog) return

    // logsディレクトリがなければ作成
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true })
    }

    const filename = `${this.currentLog.gameId}.json`
    const filepath = path.join(this.logsDir, filename)

    fs.writeFileSync(
      filepath,
      JSON.stringify(this.currentLog, null, 2),
      'utf-8',
    )
  }

  /** 現在のログを取得（デバッグ用） */
  getCurrentLog(): PlayLog | null {
    return this.currentLog
  }

  /** ログをクリア（新規ゲーム時など） */
  clear(): void {
    this.currentLog = null
  }

  /** セッション途中で保存（自動保存用） */
  saveIntermediate(): void {
    this.saveToFile()
  }
}

/** シングルトンインスタンス */
export const playLogger = new PlayLogManager()
