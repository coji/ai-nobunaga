// AI モジュール - re-export

export {
  askMilitaryAdvisor,
  conductCouncilRound,
  generateLetter,
  generateNarrative,
  generateRetainerComments,
  holdCouncil,
  summarizeCouncilProposals,
  type CouncilOpinion,
  type CouncilProposal,
  type CouncilStatement,
  type RetainerComment,
} from './advisor.js'
export { MODEL, ai } from './client.js'
export { executeToolCall } from './executor.js'
export { buildGameContextPrompt, getPersonalityDescription } from './prompts.js'
export { gameTools } from './tools.js'
export {
  decideAIAction,
  executePlayerCommand,
  type AIDecision,
  type AITurnResult,
  type PlayerCommandResult,
} from './turn.js'
