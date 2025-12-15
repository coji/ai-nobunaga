// ツール実行

import type { ActionResult, GameState } from "../types.js";
import { executeAction } from "../engine.js";

interface ExecuteResult {
  result: ActionResult | null;
  narrative: string;
  endTurn: boolean;
}

export function executeToolCall(
  state: GameState,
  clanId: string,
  toolName: string,
  args: Record<string, unknown>
): ExecuteResult {
  if (toolName === "end_turn") {
    return {
      result: null,
      narrative: (args["summary"] as string) || "行動を終了",
      endTurn: true,
    };
  }

  const action = buildAction(toolName, args);
  if (!action) {
    return {
      result: null,
      narrative: `不明なコマンド: ${toolName}`,
      endTurn: false,
    };
  }

  const result = executeAction(state, clanId, action);
  return {
    result,
    narrative: result.success
      ? `${result.message}: ${result.stateChanges.join(", ")}`
      : `失敗 - ${result.message}`,
    endTurn: false,
  };
}

function buildAction(toolName: string, args: Record<string, unknown>) {
  // LLMがよく間違えるツール名のエイリアス
  const toolAliases: Record<string, string> = {
    improve_commerce: "develop_commerce",
    improve_agriculture: "develop_agriculture",
    build_commerce: "develop_commerce",
    build_agriculture: "develop_agriculture",
    increase_commerce: "develop_commerce",
    increase_agriculture: "develop_agriculture",
    hire_soldiers: "recruit_soldiers",
    train_soldiers: "recruit_soldiers",
    raise_soldiers: "recruit_soldiers",
    strengthen_defense: "fortify",
    build_fortification: "fortify",
    siege: "attack",
    assault: "attack",
    invade: "attack",
    alliance: "propose_alliance",
    form_alliance: "propose_alliance",
    gift: "send_gift",
    give_gift: "send_gift",
    intimidate: "threaten",
    coerce: "threaten",
    corrupt: "bribe",
    buy_off: "bribe",
    rumor: "spread_rumor",
    spread_rumors: "spread_rumor",
    gossip: "spread_rumor",
  };
  const normalizedToolName = toolAliases[toolName] || toolName;

  // デフォルトのintent（AIターンではintentが渡されないため）
  const defaultIntents: Record<string, string> = {
    develop_agriculture: "農業発展",
    develop_commerce: "商業発展",
    recruit_soldiers: "兵力増強",
    fortify: "防御強化",
    attack: "敵城攻略",
    propose_alliance: "同盟締結",
    send_gift: "友好促進",
    threaten: "威嚇",
    bribe: "調略",
    spread_rumor: "流言工作",
  };
  const intent = (args["intent"] as string) || defaultIntents[normalizedToolName] || "";

  switch (normalizedToolName) {
    case "develop_agriculture":
      return {
        category: "内政" as const,
        type: "develop_agriculture" as const,
        targetId: args["castleId"] as string,
        intent,
        riskTolerance: 0.5,
        value: args["investment"] as number,
      };

    case "develop_commerce":
      return {
        category: "内政" as const,
        type: "develop_commerce" as const,
        targetId: args["castleId"] as string,
        intent,
        riskTolerance: 0.5,
        value: args["investment"] as number,
      };

    case "recruit_soldiers":
      return {
        category: "軍事" as const,
        type: "recruit_soldiers" as const,
        targetId: args["castleId"] as string,
        intent,
        riskTolerance: 0.5,
        value: args["count"] as number,
      };

    case "fortify":
      return {
        category: "軍事" as const,
        type: "fortify" as const,
        targetId: args["castleId"] as string,
        intent,
        riskTolerance: 0.5,
        value: args["investment"] as number,
      };

    case "attack":
      return {
        category: "軍事" as const,
        type: "attack" as const,
        targetId: args["targetCastleId"] as string,
        intent,
        riskTolerance: 0.7,
        soldierCount: args["soldierCount"] as number,
        fromCastleId: args["fromCastleId"] as string,
      };

    case "propose_alliance":
      return {
        category: "外交" as const,
        type: "propose_alliance" as const,
        targetId: args["targetClanId"] as string,
        intent,
        riskTolerance: 0.5,
        conditions: { duration: (args["duration"] as number) || 12 },
      };

    case "send_gift":
      return {
        category: "外交" as const,
        type: "send_gift" as const,
        targetId: args["targetClanId"] as string,
        intent,
        riskTolerance: 0.3,
        conditions: { goldOffered: args["goldAmount"] as number },
      };

    case "threaten":
      return {
        category: "外交" as const,
        type: "threaten" as const,
        targetId: args["targetClanId"] as string,
        intent,
        riskTolerance: 0.6,
      };

    case "bribe":
      return {
        category: "謀略" as const,
        type: "bribe" as const,
        targetId: args["targetBushoId"] as string,
        intent,
        riskTolerance: 0.5,
      };

    case "spread_rumor":
      return {
        category: "謀略" as const,
        type: "spread_rumor" as const,
        targetId: args["targetBushoId"] as string,
        intent,
        riskTolerance: 0.4,
      };

    default:
      return null;
  }
}
