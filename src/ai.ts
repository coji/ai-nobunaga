// AI意思決定システム（Gemini Function Calling 使用）

import { GoogleGenAI, Type } from "@google/genai";
import type {
  ActionResult,
  Busho,
  GameState,
  Letter,
} from "./types.js";
import { executeAction, validateAction } from "./engine.js";

const ai = new GoogleGenAI({ apiKey: process.env["GEMINI_API_KEY"] ?? "" });

// === ゲームツール定義 ===

const gameTools = [
  {
    name: "develop_agriculture",
    description: "城の農業力を発展させる（内政）- 兵糧生産を増加",
    parameters: {
      type: Type.OBJECT,
      properties: {
        castleId: { type: Type.STRING, description: "対象の城ID" },
        investment: { type: Type.NUMBER, description: "投資額（100-2000金）" },
        intent: { type: Type.STRING, description: "行動の意図（20文字以内）" },
      },
      required: ["castleId", "investment", "intent"],
    },
  },
  {
    name: "develop_commerce",
    description: "城の商業力を発展させる（内政）- 金収入を増加",
    parameters: {
      type: Type.OBJECT,
      properties: {
        castleId: { type: Type.STRING, description: "対象の城ID" },
        investment: { type: Type.NUMBER, description: "投資額（100-2000金）" },
        intent: { type: Type.STRING, description: "行動の意図（20文字以内）" },
      },
      required: ["castleId", "investment", "intent"],
    },
  },
  {
    name: "recruit_soldiers",
    description: "城で兵を徴兵する（軍事）- 兵糧を消費",
    parameters: {
      type: Type.OBJECT,
      properties: {
        castleId: { type: Type.STRING, description: "対象の城ID" },
        count: { type: Type.NUMBER, description: "徴兵数" },
        intent: { type: Type.STRING, description: "行動の意図（20文字以内）" },
      },
      required: ["castleId", "count", "intent"],
    },
  },
  {
    name: "fortify",
    description: "城の防御力を強化する（軍事）- 金を消費",
    parameters: {
      type: Type.OBJECT,
      properties: {
        castleId: { type: Type.STRING, description: "対象の城ID" },
        investment: { type: Type.NUMBER, description: "投資額（100-2000金）" },
        intent: { type: Type.STRING, description: "行動の意図（20文字以内）" },
      },
      required: ["castleId", "investment", "intent"],
    },
  },
  {
    name: "attack",
    description: "敵の城を攻撃する（軍事）。隣接する城のみ攻撃可能",
    parameters: {
      type: Type.OBJECT,
      properties: {
        fromCastleId: { type: Type.STRING, description: "出撃元の城ID" },
        targetCastleId: { type: Type.STRING, description: "攻撃対象の城ID" },
        soldierCount: { type: Type.NUMBER, description: "動員する兵数" },
        intent: { type: Type.STRING, description: "行動の意図（20文字以内）" },
      },
      required: ["fromCastleId", "targetCastleId", "soldierCount", "intent"],
    },
  },
  {
    name: "propose_alliance",
    description: "他勢力に同盟を申し入れる（外交）",
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetClanId: { type: Type.STRING, description: "対象の勢力ID" },
        duration: { type: Type.NUMBER, description: "同盟期間（ターン数）" },
        intent: { type: Type.STRING, description: "行動の意図（20文字以内）" },
      },
      required: ["targetClanId", "intent"],
    },
  },
  {
    name: "send_gift",
    description: "他勢力に贈り物を送る（外交）",
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetClanId: { type: Type.STRING, description: "対象の勢力ID" },
        goldAmount: { type: Type.NUMBER, description: "贈答金額" },
        intent: { type: Type.STRING, description: "行動の意図（20文字以内）" },
      },
      required: ["targetClanId", "goldAmount", "intent"],
    },
  },
  {
    name: "threaten",
    description: "他勢力を威嚇する（外交）",
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetClanId: { type: Type.STRING, description: "対象の勢力ID" },
        intent: { type: Type.STRING, description: "行動の意図（20文字以内）" },
      },
      required: ["targetClanId", "intent"],
    },
  },
  {
    name: "bribe",
    description: "敵の武将を買収する（謀略）",
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetBushoId: { type: Type.STRING, description: "対象の武将ID" },
        intent: { type: Type.STRING, description: "行動の意図（20文字以内）" },
      },
      required: ["targetBushoId", "intent"],
    },
  },
  {
    name: "spread_rumor",
    description: "敵の武将について流言を広める（謀略）",
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetBushoId: { type: Type.STRING, description: "対象の武将ID" },
        intent: { type: Type.STRING, description: "行動の意図（20文字以内）" },
      },
      required: ["targetBushoId", "intent"],
    },
  },
  {
    name: "end_turn",
    description: "このターンの行動を終了する",
    parameters: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING, description: "このターンの総括（50文字以内）" },
      },
      required: ["summary"],
    },
  },
];

// === ツール実行 ===

function executeToolCall(
  state: GameState,
  clanId: string,
  toolName: string,
  args: Record<string, unknown>
): { result: ActionResult | null; narrative: string; endTurn: boolean } {
  const clan = state.clanCatalog.get(clanId)!;

  if (toolName === "end_turn") {
    return {
      result: null,
      narrative: args["summary"] as string || "行動を終了",
      endTurn: true,
    };
  }

  // ツール名からアクションに変換
  let action;
  switch (toolName) {
    case "develop_agriculture":
      action = {
        category: "内政" as const,
        type: "develop_agriculture" as const,
        targetId: args["castleId"] as string,
        intent: args["intent"] as string,
        riskTolerance: 0.5,
        value: args["investment"] as number,
      };
      break;
    case "develop_commerce":
      action = {
        category: "内政" as const,
        type: "develop_commerce" as const,
        targetId: args["castleId"] as string,
        intent: args["intent"] as string,
        riskTolerance: 0.5,
        value: args["investment"] as number,
      };
      break;
    case "recruit_soldiers":
      action = {
        category: "軍事" as const,
        type: "recruit_soldiers" as const,
        targetId: args["castleId"] as string,
        intent: args["intent"] as string,
        riskTolerance: 0.5,
        value: args["count"] as number,
      };
      break;
    case "fortify":
      action = {
        category: "軍事" as const,
        type: "fortify" as const,
        targetId: args["castleId"] as string,
        intent: args["intent"] as string,
        riskTolerance: 0.5,
        value: args["investment"] as number,
      };
      break;
    case "attack":
      action = {
        category: "軍事" as const,
        type: "attack" as const,
        targetId: args["targetCastleId"] as string,
        intent: args["intent"] as string,
        riskTolerance: 0.7,
        soldierCount: args["soldierCount"] as number,
        fromCastleId: args["fromCastleId"] as string,
      };
      break;
    case "propose_alliance":
      action = {
        category: "外交" as const,
        type: "propose_alliance" as const,
        targetId: args["targetClanId"] as string,
        intent: args["intent"] as string,
        riskTolerance: 0.5,
        conditions: { duration: (args["duration"] as number) || 12 },
      };
      break;
    case "send_gift":
      action = {
        category: "外交" as const,
        type: "send_gift" as const,
        targetId: args["targetClanId"] as string,
        intent: args["intent"] as string,
        riskTolerance: 0.3,
        conditions: { goldOffered: args["goldAmount"] as number },
      };
      break;
    case "threaten":
      action = {
        category: "外交" as const,
        type: "threaten" as const,
        targetId: args["targetClanId"] as string,
        intent: args["intent"] as string,
        riskTolerance: 0.6,
      };
      break;
    case "bribe":
      action = {
        category: "謀略" as const,
        type: "bribe" as const,
        targetId: args["targetBushoId"] as string,
        intent: args["intent"] as string,
        riskTolerance: 0.5,
      };
      break;
    case "spread_rumor":
      action = {
        category: "謀略" as const,
        type: "spread_rumor" as const,
        targetId: args["targetBushoId"] as string,
        intent: args["intent"] as string,
        riskTolerance: 0.4,
      };
      break;
    default:
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

// === プロンプト生成 ===

function buildGameContextPrompt(state: GameState, clanId: string): string {
  const clan = state.clanCatalog.get(clanId)!;
  const leader = state.bushoCatalog.get(clan.leaderId)!;

  const ownCastles = clan.castleIds
    .map((id) => {
      const c = state.castleCatalog.get(id)!;
      return `  - ${c.name}(ID:${c.id}): 兵${c.soldiers}, 防御${c.defense}, 農業${c.agriculture}, 商業${c.commerce}`;
    })
    .join("\n");

  const ownBusho = [...state.bushoCatalog.values()]
    .filter((b) => b.clanId === clanId)
    .map((b) => `  - ${b.name}(ID:${b.id}): 忠誠${b.emotions.loyalty}`)
    .join("\n");

  const otherClans = [...state.clanCatalog.values()]
    .filter((c) => c.id !== clanId)
    .map((c) => {
      const l = state.bushoCatalog.get(c.leaderId);
      const castles = c.castleIds
        .map((id) => {
          const castle = state.castleCatalog.get(id)!;
          return `${castle.name}(ID:${id}, 兵${castle.soldiers})`;
        })
        .join(", ");
      const relation = state.diplomacyRelations.find(
        (r) =>
          (r.clan1Id === clanId && r.clan2Id === c.id) ||
          (r.clan1Id === c.id && r.clan2Id === clanId)
      );
      return `  - ${c.name}(ID:${c.id}): 当主${l?.name}, 関係=${relation?.type || "neutral"}, 城=[${castles}]`;
    })
    .join("\n");

  const adjacentEnemies: string[] = [];
  for (const castleId of clan.castleIds) {
    const castle = state.castleCatalog.get(castleId)!;
    for (const adjId of castle.adjacentCastleIds) {
      const adj = state.castleCatalog.get(adjId)!;
      if (adj.ownerId !== clanId) {
        adjacentEnemies.push(
          `  ${castle.name}(${castleId}) → ${adj.name}(${adjId}): ${state.clanCatalog.get(adj.ownerId)?.name}, 兵${adj.soldiers}`
        );
      }
    }
  }

  const enemyBusho = [...state.bushoCatalog.values()]
    .filter((b) => b.clanId && b.clanId !== clanId)
    .map((b) => `  - ${b.name}(ID:${b.id}, ${state.clanCatalog.get(b.clanId!)?.name}): 忠誠${b.emotions.loyalty}`)
    .join("\n");

  return `
# ターン${state.turn} - ${clan.name}（${leader.name}）

## 資源
金: ${clan.gold}, 兵糧: ${clan.food}

## 自軍の城
${ownCastles}

## 自軍の武将
${ownBusho}

## 他勢力
${otherClans}

## 攻撃可能な敵城（隣接）
${adjacentEnemies.length > 0 ? adjacentEnemies.join("\n") : "  なし"}

## 敵武将（謀略対象）
${enemyBusho || "  なし"}
`.trim();
}

function getPersonalityDescription(leader: Busho): string {
  return `あなたは${leader.name}。性格: ${leader.personality.join(", ")}。この性格に基づいて行動せよ。`;
}

// === AI大名のターン実行 ===

export interface AITurnResult {
  actions: { tool: string; args: Record<string, unknown>; narrative: string; success: boolean }[];
  summary: string;
}

export async function executeAITurn(
  state: GameState,
  clanId: string
): Promise<AITurnResult> {
  const clan = state.clanCatalog.get(clanId)!;
  const leader = state.bushoCatalog.get(clan.leaderId)!;

  const results: AITurnResult["actions"] = [];
  let turnEnded = false;
  let summary = "";
  let turnCount = 0;
  const maxTurns = 5;

  const systemPrompt = `あなたは戦国シミュレーションゲームのAI大名です。
${getPersonalityDescription(leader)}

与えられたツールを使ってこのターンの行動を決定してください。
1ターンに最大3つの行動ができます。行動が終わったら必ずend_turnを呼んでください。

重要:
- 攻撃は隣接する城にのみ可能
- 資金・兵糧の残量を確認すること
- IDは正確に指定すること`;

  const messages: { role: "user" | "model"; parts: { text: string }[] }[] = [
    { role: "user", parts: [{ text: buildGameContextPrompt(state, clanId) }] },
  ];

  while (!turnEnded && turnCount < maxTurns) {
    turnCount++;

    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: messages,
      config: {
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: gameTools }],
      },
    });

    const candidate = response.candidates?.[0];
    if (!candidate) break;

    const part = candidate.content?.parts?.[0];
    if (!part) break;

    // テキスト応答の場合
    if ("text" in part && part.text) {
      messages.push({ role: "model", parts: [{ text: part.text }] });
      continue;
    }

    // Function Call の場合
    if ("functionCall" in part && part.functionCall) {
      const fc = part.functionCall;
      const toolName = fc.name ?? "unknown";
      const args = (fc.args || {}) as Record<string, unknown>;

      const { result, narrative, endTurn } = executeToolCall(state, clanId, toolName, args);

      if (endTurn) {
        turnEnded = true;
        summary = narrative;
      } else {
        results.push({
          tool: toolName,
          args,
          narrative,
          success: result?.success ?? false,
        });
      }

      // 結果をモデルに返す
      messages.push({
        role: "model",
        parts: [{ text: `[${toolName}を実行]` }],
      });
      messages.push({
        role: "user",
        parts: [{ text: `結果: ${narrative}\n\n次の行動を選択してください。行動が終わったらend_turnを呼んでください。` }],
      });
    }
  }

  return { actions: results, summary: summary || "行動終了" };
}

// === プレイヤーコマンド実行 ===

export interface PlayerCommandResult {
  tool: string;
  args: Record<string, unknown>;
  narrative: string;
  success: boolean;
  aiResponse: string;
}

export async function executePlayerCommand(
  state: GameState,
  clanId: string,
  command: string
): Promise<PlayerCommandResult> {
  const clan = state.clanCatalog.get(clanId)!;
  const leader = state.bushoCatalog.get(clan.leaderId)!;

  const systemPrompt = `あなたは戦国シミュレーションゲームの軍師です。
プレイヤー（${leader.name}）の指示を解釈し、適切なツールを1つ呼び出してください。

重要:
- 攻撃は隣接する城にのみ可能
- IDは正確に指定すること
- 不明な点があれば確認してから実行

指示が曖昧な場合は、最も妥当な解釈で実行してください。`;

  const userPrompt = `${buildGameContextPrompt(state, clanId)}

## プレイヤーの指示
「${command}」

この指示を実行するために適切なツールを呼び出してください。`;

  const response = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      tools: [{ functionDeclarations: gameTools.filter(t => t.name !== "end_turn") }],
    },
  });

  const candidate = response.candidates?.[0];
  const part = candidate?.content?.parts?.[0];

  // テキスト応答のみの場合（ツール呼び出しなし）
  if (!part || !("functionCall" in part) || !part.functionCall) {
    const text = part && "text" in part ? part.text : "";
    return {
      tool: "none",
      args: {},
      narrative: "指示を理解できませんでした",
      success: false,
      aiResponse: text || "コマンドを解釈できませんでした。もう少し具体的に指示してください。",
    };
  }

  const fc = part.functionCall;
  const toolName = fc.name ?? "unknown";
  const args = (fc.args || {}) as Record<string, unknown>;

  const { result, narrative } = executeToolCall(state, clanId, toolName, args);

  // 結果に対するAIのコメントを生成
  const commentResponse = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: `あなたは戦国時代の軍師です。以下の行動結果について、${leader.name}に簡潔に報告してください（50文字以内）。

行動: ${toolName}
結果: ${narrative}
成功: ${result?.success ? "はい" : "いいえ"}`,
  });

  return {
    tool: toolName,
    args,
    narrative,
    success: result?.success ?? false,
    aiResponse: commentResponse.text ?? narrative,
  };
}

// === 結果ナレーション生成 ===

export async function generateNarrative(
  leaderName: string,
  action: string,
  result: string,
  success: boolean
): Promise<string> {
  const prompt = `あなたは戦国時代の軍師です。以下の行動結果を、大名${leaderName}に報告する形式で、戦国時代らしい口調で簡潔に伝えてください（80文字以内）。

行動: ${action}
結果: ${result}
成功: ${success ? "成功" : "失敗"}

報告文のみを出力してください。`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
    });
    return response.text ?? result;
  } catch {
    return result;
  }
}

// === 書状生成 ===

export async function generateLetter(
  state: GameState,
  fromClanId: string,
  toClanId: string,
  purpose: "propose_alliance" | "threaten" | "respond_to_letter",
  context?: string
): Promise<Letter> {
  const fromClan = state.clanCatalog.get(fromClanId)!;
  const toClan = state.clanCatalog.get(toClanId)!;
  const fromLeader = state.bushoCatalog.get(fromClan.leaderId)!;
  const toLeader = state.bushoCatalog.get(toClan.leaderId)!;

  const relation = state.diplomacyRelations.find(
    (r) =>
      (r.clan1Id === fromClanId && r.clan2Id === toClanId) ||
      (r.clan1Id === toClanId && r.clan2Id === fromClanId)
  );

  const purposeDesc =
    purpose === "propose_alliance"
      ? "同盟を申し入れる"
      : purpose === "threaten"
        ? "威嚇・警告する"
        : "返書を書く";

  const prompt = `あなたは戦国時代の大名「${fromLeader.name}」として書状を書きます。

性格: ${fromLeader.personality.join(", ")}
目的: ${purposeDesc}
送り先: ${toClan.name}の${toLeader.name}殿（関係: ${relation?.type || "neutral"}）
状況: ${context || `ターン${state.turn}`}

JSON形式のみで出力:
\`\`\`json
{
  "greeting": "冒頭の儀礼文",
  "body": "本題",
  "closing": "末尾の余韻",
  "summary": "要約（30文字以内）"
}
\`\`\``;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
    });

    const text = response.text ?? "";
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[1] || jsonMatch?.[0] || "{}");

    return {
      id: `letter_${state.turn}_${fromClanId}_${toClanId}`,
      turn: state.turn,
      fromClanId,
      toClanId,
      greeting: parsed.greeting || "謹んで申し上げます。",
      body: parsed.body || "（本文）",
      closing: parsed.closing || "何卒よしなに。",
      proposedTerms:
        purpose === "propose_alliance"
          ? { type: "propose_alliance", conditions: { duration: 12 } }
          : null,
      summary: parsed.summary || "（要約）",
    };
  } catch (e) {
    console.error("Letter generation error:", e);
    return {
      id: `letter_${state.turn}_${fromClanId}_${toClanId}`,
      turn: state.turn,
      fromClanId,
      toClanId,
      greeting: "謹んで申し上げます。",
      body: "（書状の生成に失敗しました）",
      closing: "何卒よしなに。",
      proposedTerms: null,
      summary: "（エラー）",
    };
  }
}
