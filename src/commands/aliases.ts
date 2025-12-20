// ツール名エイリアス
// LLMがよく間違えるツール名を正規の名前にマッピング

/** ツール名エイリアスのマッピング */
export const toolAliases: Record<string, string> = {
  // 内政系
  improve_commerce: 'develop_commerce',
  improve_agriculture: 'develop_agriculture',
  build_commerce: 'develop_commerce',
  build_agriculture: 'develop_agriculture',
  increase_commerce: 'develop_commerce',
  increase_agriculture: 'develop_agriculture',

  // 軍事系
  hire_soldiers: 'recruit_soldiers',
  train_soldiers: 'recruit_soldiers',
  raise_soldiers: 'recruit_soldiers',
  strengthen_defense: 'fortify',
  build_fortification: 'fortify',
  siege: 'attack',
  assault: 'attack',
  invade: 'attack',

  // 外交系
  alliance: 'propose_alliance',
  form_alliance: 'propose_alliance',
  gift: 'send_gift',
  give_gift: 'send_gift',
  intimidate: 'threaten',
  coerce: 'threaten',

  // 謀略系
  corrupt: 'bribe',
  buy_off: 'bribe',
  rumor: 'spread_rumor',
  spread_rumors: 'spread_rumor',
  gossip: 'spread_rumor',
}

/**
 * ツール名を正規化
 * エイリアスがあればマッピング、なければそのまま返す
 */
export function normalizeToolName(toolName: string): string {
  return toolAliases[toolName] ?? toolName
}
