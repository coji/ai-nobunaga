// ゲームエンジン：後方互換性のためのre-export
// 新しいコードは src/engine/ 配下のモジュールを直接importしてください

export { executeAction } from './engine/actions.js'
export { processTurnEnd } from './engine/turn.js'
export { validateAction } from './engine/validation.js'
export { checkVictory } from './engine/victory.js'
