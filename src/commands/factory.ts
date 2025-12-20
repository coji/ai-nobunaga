// コマンドファクトリー

import type { Castle } from '../types.js'
import { DevelopAgricultureCommand, DevelopCommerceCommand } from './domestic.js'
import {
  ProposeAllianceCommand,
  SendGiftCommand,
  ThreatenCommand,
} from './diplomacy.js'
import { AssassinateCommand, BribeCommand } from './intrigue.js'
import { AttackCommand, FortifyCommand, RecruitSoldiersCommand } from './military.js'
import { DelegateCommand, EndTurnCommand } from './turn.js'
import type { GameCommand } from './types.js'

/** ツール名のエイリアス（LLMの出力揺れに対応） */
const toolNameAliases: Record<string, string> = {
  // 内政
  develop_agriculture: 'develop_agriculture',
  agriculture: 'develop_agriculture',
  farm: 'develop_agriculture',
  develop_commerce: 'develop_commerce',
  commerce: 'develop_commerce',
  trade: 'develop_commerce',
  improve_commerce: 'develop_commerce',
  // 軍事
  recruit_soldiers: 'recruit_soldiers',
  recruit: 'recruit_soldiers',
  enlist: 'recruit_soldiers',
  fortify: 'fortify',
  build_fortification: 'fortify',
  defense: 'fortify',
  attack: 'attack',
  assault: 'attack',
  // 外交
  propose_alliance: 'propose_alliance',
  alliance: 'propose_alliance',
  ally: 'propose_alliance',
  diplomacy: 'propose_alliance',
  send_gift: 'send_gift',
  gift: 'send_gift',
  threaten: 'threaten',
  intimidate: 'threaten',
  // 謀略
  bribe: 'bribe',
  sabotage: 'bribe',
  assassinate: 'assassinate',
  assassination: 'assassinate',
  // システム
  end_turn: 'end_turn',
  delegate: 'delegate',
}

/** ツール名を正規化 */
function normalizeToolName(toolName: string): string {
  const lower = toolName.toLowerCase()
  return toolNameAliases[lower] ?? lower
}

/** ツール名からコマンドを生成 */
export function createCommand(
  toolName: string,
  args: Record<string, unknown>,
): GameCommand | null {
  const normalized = normalizeToolName(toolName)

  switch (normalized) {
    // 内政
    case 'develop_agriculture':
      return new DevelopAgricultureCommand(
        args.castleId as string,
        (args.investment as number) ?? 500,
      )
    case 'develop_commerce':
      return new DevelopCommerceCommand(
        args.castleId as string,
        (args.investment as number) ?? 500,
      )

    // 軍事
    case 'recruit_soldiers':
      return new RecruitSoldiersCommand(
        args.castleId as string,
        (args.count as number) ?? 100,
      )
    case 'fortify':
      return new FortifyCommand(
        args.castleId as string,
        (args.investment as number) ?? 500,
      )
    case 'attack':
      return new AttackCommand(
        args.fromCastleId as string,
        args.targetCastleId as string,
        args.soldierCount as number,
      )

    // 外交
    case 'propose_alliance':
      return new ProposeAllianceCommand(args.targetClanId as string)
    case 'send_gift':
      return new SendGiftCommand(
        args.targetClanId as string,
        (args.goldAmount as number) ?? 300,
      )
    case 'threaten':
      return new ThreatenCommand(args.targetClanId as string)

    // 謀略
    case 'bribe':
      return new BribeCommand(
        args.targetBushoId as string,
        (args.goldAmount as number) ?? 500,
      )
    case 'assassinate':
      return new AssassinateCommand(args.targetBushoId as string)

    // システム
    case 'end_turn':
      return new EndTurnCommand()
    case 'delegate':
      return new DelegateCommand(
        args.castleId as string,
        args.policy as Castle['delegationPolicy'],
      )

    default:
      return null
  }
}

/** 利用可能なツール名一覧 */
export const availableTools = [
  'develop_agriculture',
  'develop_commerce',
  'recruit_soldiers',
  'fortify',
  'attack',
  'propose_alliance',
  'send_gift',
  'threaten',
  'bribe',
  'assassinate',
  'end_turn',
  'delegate',
] as const

export type ToolName = (typeof availableTools)[number]
