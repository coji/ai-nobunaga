// コマンドモジュール - re-export

export { normalizeToolName, toolAliases } from './aliases.js'
export {
  BaseCommand,
  CastleCommand,
  type CastleCommandContext,
  type CommandContext,
  type GradeInfo,
} from './base.js'
export { DevelopAgricultureCommand, DevelopCommerceCommand } from './domestic.js'
export {
  ProposeAllianceCommand,
  SendGiftCommand,
  ThreatenCommand,
} from './diplomacy.js'
export { AssassinateCommand, BribeCommand } from './intrigue.js'
export {
  AttackCommand,
  FortifyCommand,
  RecruitSoldiersCommand,
} from './military.js'
export { DelegateCommand, EndTurnCommand } from './turn.js'
export { availableTools, createCommand, type ToolName } from './factory.js'
export {
  createFailureResult,
  createSuccessResult,
  getGradeMultiplier,
  getGradeNarrative,
  rollForGrade,
  type CommandResult,
  type GameCommand,
  type UndoableCommand,
} from './types.js'
