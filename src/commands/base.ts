// 基底コマンドクラス
// 共通のバリデーション・エラーハンドリング・状態操作を提供

import type { Castle, Clan, GameAction, GameState } from '../types.js'
import {
  createFailureResult,
  getGradeMultiplier,
  getGradeNarrative,
  rollForGrade,
  type CommandResult,
  type GameCommand,
} from './types.js'

/** コマンド実行コンテキスト（状態のコピーとエンティティへの参照） */
export interface CommandContext {
  /** 新しい状態（ミュータブル） */
  newState: GameState
  /** 実行者の勢力 */
  clan: Clan
  /** 元の状態（読み取り専用） */
  originalState: GameState
  /** 実行者のclanId */
  clanId: string
}

/** 城操作用の拡張コンテキスト */
export interface CastleCommandContext extends CommandContext {
  /** 対象の城 */
  castle: Castle
}

/** 実行結果のグレード情報 */
export interface GradeInfo {
  grade: ReturnType<typeof rollForGrade>
  multiplier: number
  narrative: string
}

/**
 * 基底コマンドクラス
 * 共通のパターンを抽象化し、各コマンドはテンプレートメソッドを実装する
 */
export abstract class BaseCommand implements GameCommand {
  abstract readonly name: string

  /** アクション定義を取得 */
  protected abstract getAction(): GameAction

  /** コマンドを実行 */
  abstract execute(state: GameState, clanId: string): CommandResult

  /**
   * 勢力の存在を検証
   * @returns 勢力が見つからない場合は失敗結果、見つかった場合は null
   */
  protected validateClan(
    state: GameState,
    clanId: string,
  ): CommandResult | null {
    const clan = state.clanCatalog[clanId]
    if (!clan) {
      return createFailureResult(
        state,
        this.getAction(),
        `勢力が見つかりません: ${clanId}`,
      )
    }
    return null
  }

  /**
   * 城の存在と所有権を検証
   * @param requireOwnership 所有権チェックを行うか
   * @returns エラーがある場合は失敗結果、ない場合は null
   */
  protected validateCastle(
    state: GameState,
    clanId: string,
    castleId: string,
    requireOwnership = true,
    errorMessage = '他勢力の城は操作できません',
  ): CommandResult | null {
    const castle = state.castleCatalog[castleId]
    if (!castle) {
      return createFailureResult(
        state,
        this.getAction(),
        `城が見つかりません: ${castleId}`,
      )
    }
    if (requireOwnership && castle.ownerId !== clanId) {
      return createFailureResult(state, this.getAction(), errorMessage)
    }
    return null
  }

  /**
   * 資金が足りているか検証
   */
  protected validateGold(
    state: GameState,
    clanId: string,
    required: number,
  ): CommandResult | null {
    const clan = state.clanCatalog[clanId]
    if (!clan || clan.gold < required) {
      return createFailureResult(state, this.getAction(), '資金が不足しています')
    }
    return null
  }

  /**
   * 状態をディープコピーし、勢力への参照を取得
   * @throws コピー後のエンティティが見つからない場合
   */
  protected prepareContext(state: GameState, clanId: string): CommandContext {
    const newState = structuredClone(state)
    const clan = newState.clanCatalog[clanId]
    if (!clan) {
      throw new Error(`内部エラー: コピー後の勢力が見つかりません: ${clanId}`)
    }
    return {
      newState,
      clan,
      originalState: state,
      clanId,
    }
  }

  /**
   * 状態をディープコピーし、勢力と城への参照を取得
   */
  protected prepareCastleContext(
    state: GameState,
    clanId: string,
    castleId: string,
  ): CastleCommandContext {
    const ctx = this.prepareContext(state, clanId)
    const castle = ctx.newState.castleCatalog[castleId]
    if (!castle) {
      throw new Error(`内部エラー: コピー後の城が見つかりません: ${castleId}`)
    }
    return { ...ctx, castle }
  }

  /**
   * グレード判定を実行
   */
  protected rollGrade(baseSuccess = true): GradeInfo {
    const grade = rollForGrade(baseSuccess)
    const multiplier = getGradeMultiplier(grade)
    const narrative = getGradeNarrative(grade)
    return { grade, multiplier, narrative }
  }

  /**
   * 内部エラー結果を生成（structuredClone後のエンティティが見つからない場合）
   */
  protected internalError(state: GameState): CommandResult {
    return createFailureResult(state, this.getAction(), '内部エラー')
  }
}

/**
 * 城を対象とするコマンドの基底クラス
 * 事前バリデーション（勢力・城・資金）を共通化
 */
export abstract class CastleCommand extends BaseCommand {
  constructor(
    protected readonly castleId: string,
    protected readonly investment: number,
  ) {
    super()
  }

  /**
   * 共通の事前バリデーション
   */
  protected validatePreConditions(
    state: GameState,
    clanId: string,
  ): CommandResult | null {
    // 勢力の存在
    const clanError = this.validateClan(state, clanId)
    if (clanError) return clanError

    // 城の存在と所有権
    const castleError = this.validateCastle(state, clanId, this.castleId)
    if (castleError) return castleError

    // 資金
    const goldError = this.validateGold(state, clanId, this.investment)
    if (goldError) return goldError

    return null
  }
}
