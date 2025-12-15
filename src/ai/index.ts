// AI モジュール - re-export

export { ai, MODEL } from "./client.js";
export { gameTools } from "./tools.js";
export { executeToolCall } from "./executor.js";
export { buildGameContextPrompt, getPersonalityDescription } from "./prompts.js";
export {
  executeAITurn,
  executePlayerCommand,
  type AITurnResult,
  type PlayerCommandResult,
} from "./turn.js";
export {
  holdCouncil,
  askMilitaryAdvisor,
  conductCouncilRound,
  summarizeCouncilProposals,
  generateNarrative,
  generateLetter,
  generateRetainerComments,
  type CouncilOpinion,
  type CouncilStatement,
  type CouncilProposal,
  type RetainerComment,
} from "./advisor.js";
