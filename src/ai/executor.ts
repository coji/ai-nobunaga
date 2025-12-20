// ツール実行

import { createCommand } from '../commands/index.js'
import type { ActionResult, GameState } from '../types.js'

interface ExecuteResult {
  result: ActionResult | null
  narrative: string
  endTurn: boolean
  newState?: GameState
}

// LLMがよく間違えるツール名のエイリアス
const toolAliases: Record<string, string> = {
  improve_commerce: 'develop_commerce',
  improve_agriculture: 'develop_agriculture',
  build_commerce: 'develop_commerce',
  build_agriculture: 'develop_agriculture',
  increase_commerce: 'develop_commerce',
  increase_agriculture: 'develop_agriculture',
  hire_soldiers: 'recruit_soldiers',
  train_soldiers: 'recruit_soldiers',
  raise_soldiers: 'recruit_soldiers',
  strengthen_defense: 'fortify',
  build_fortification: 'fortify',
  siege: 'attack',
  assault: 'attack',
  invade: 'attack',
  alliance: 'propose_alliance',
  form_alliance: 'propose_alliance',
  gift: 'send_gift',
  give_gift: 'send_gift',
  intimidate: 'threaten',
  coerce: 'threaten',
  corrupt: 'bribe',
  buy_off: 'bribe',
  rumor: 'spread_rumor',
  spread_rumors: 'spread_rumor',
  gossip: 'spread_rumor',
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
  const normalizedToolName = toolAliases[toolName] || toolName

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
