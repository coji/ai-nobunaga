// ツール実行

import { normalizeToolName } from '../commands/aliases.js'
import { createCommand } from '../commands/index.js'
import type { ActionResult, GameState } from '../types.js'

interface ExecuteResult {
  result: ActionResult | null
  narrative: string
  endTurn: boolean
  newState?: GameState
}

export function executeToolCall(
  state: GameState,
  clanId: string,
  toolName: string,
  args: Record<string, unknown>,
): ExecuteResult {
  if (toolName === 'end_turn') {
    return {
      result: null,
      narrative: (args.summary as string) || '行動を終了',
      endTurn: true,
    }
  }

  // ツール名を正規化
  const normalizedToolName = normalizeToolName(toolName)

  // コマンドを生成
  const command = createCommand(normalizedToolName, args)
  if (!command) {
    return {
      result: null,
      narrative: `不明なコマンド: ${toolName}`,
      endTurn: false,
    }
  }

  // コマンドを実行
  const cmdResult = command.execute(state, clanId)

  return {
    result: cmdResult.result,
    narrative: cmdResult.narrative,
    endTurn: false,
    newState: cmdResult.newState,
  }
}
