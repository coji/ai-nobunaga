// 行動実行ロジック

import type {
  ActionResult,
  DiplomacyAction,
  DomesticAction,
  GameAction,
  GameState,
  GrudgeEvent,
  IntrigueAction,
  MilitaryAction,
} from "../types.js";
import { validateAction } from "./validation.js";

/** 行動を実行して結果を返す */
export function executeAction(
  state: GameState,
  clanId: string,
  action: GameAction
): ActionResult {
  const validation = validateAction(state, clanId, action);
  if (!validation.valid) {
    return {
      success: false,
      action,
      message: validation.reason || "不明なエラー",
      stateChanges: [],
    };
  }

  switch (action.category) {
    case "内政":
      return executeDomesticAction(state, clanId, action);
    case "外交":
      return executeDiplomacyAction(state, clanId, action);
    case "軍事":
      return executeMilitaryAction(state, clanId, action);
    case "謀略":
      return executeIntrigueAction(state, clanId, action);
  }
}

function executeDomesticAction(
  state: GameState,
  clanId: string,
  action: DomesticAction
): ActionResult {
  const castle = state.castleCatalog.get(action.targetId)!;
  const clan = state.clanCatalog.get(clanId)!;
  const leader = state.bushoCatalog.get(clan.leaderId)!;
  const changes: string[] = [];

  // 君主の政治力で効果が変動（政治50で1.0倍、100で1.5倍、1で0.5倍）
  const politicsModifier = 0.5 + leader.politics / 100;
  // ランダム要素（0.8〜1.2倍）
  const randomModifier = 0.8 + Math.random() * 0.4;
  const effectModifier = politicsModifier * randomModifier;

  switch (action.type) {
    case "develop_agriculture":
      clan.gold = Math.max(0, clan.gold - action.value);
      const agriBoost = Math.max(1, Math.floor((action.value / 100) * effectModifier));
      castle.agriculture = Math.min(100, castle.agriculture + agriBoost);
      // 内政で民忠上昇
      const agriLoyaltyBoost = Math.max(1, Math.floor((action.value / 200) * effectModifier));
      castle.loyalty = Math.min(100, castle.loyalty + agriLoyaltyBoost);
      changes.push(`${castle.name}の農業力+${agriBoost}、民忠+${agriLoyaltyBoost}`);
      break;
    case "develop_commerce":
      clan.gold = Math.max(0, clan.gold - action.value);
      const commBoost = Math.max(1, Math.floor((action.value / 100) * effectModifier));
      castle.commerce = Math.min(100, castle.commerce + commBoost);
      // 内政で民忠上昇
      const commLoyaltyBoost = Math.max(1, Math.floor((action.value / 200) * effectModifier));
      castle.loyalty = Math.min(100, castle.loyalty + commLoyaltyBoost);
      changes.push(`${castle.name}の商業力+${commBoost}、民忠+${commLoyaltyBoost}`);
      break;
  }

  return {
    success: true,
    action,
    message: action.intent,
    stateChanges: changes,
  };
}

function executeDiplomacyAction(
  state: GameState,
  clanId: string,
  action: DiplomacyAction
): ActionResult {
  const changes: string[] = [];
  const clan = state.clanCatalog.get(clanId)!;
  const targetClan = state.clanCatalog.get(action.targetId)!;
  const ownLeader = state.bushoCatalog.get(clan.leaderId)!;

  // 君主の魅力で成功率が変動（魅力50で+0%、100で+25%）
  const charismaBonus = (ownLeader.charisma - 50) / 200;
  // ランダム要素（-0.1〜+0.1）
  const randomBonus = (Math.random() - 0.5) * 0.2;

  // 外交行動の成功率計算（リスク許容度と相手の感情を考慮）
  const leader = state.bushoCatalog.get(targetClan.leaderId)!;
  const baseChance =
    action.type === "propose_alliance"
      ? 0.3
      : action.type === "send_gift"
        ? 0.8
        : 0.5;
  const successChance = Math.min(0.95, Math.max(0.05, baseChance + action.riskTolerance * 0.2 + charismaBonus + randomBonus));
  const roll = Math.random();

  if (action.type === "propose_alliance") {
    if (roll < successChance) {
      // 既存の関係を更新
      const existingRelation = state.diplomacyRelations.find(
        (r) =>
          (r.clan1Id === clanId && r.clan2Id === action.targetId) ||
          (r.clan1Id === action.targetId && r.clan2Id === clanId)
      );
      if (existingRelation) {
        existingRelation.type = "alliance";
        existingRelation.expirationTurn =
          state.turn + (action.conditions?.duration || 12);
      }
      changes.push(`${targetClan.name}と同盟を締結`);
      return {
        success: true,
        action,
        message: `${targetClan.name}との同盟交渉が成立`,
        stateChanges: changes,
      };
    } else {
      changes.push(`${targetClan.name}が同盟を拒否`);
      return {
        success: false,
        action,
        message: `${targetClan.name}は同盟を拒否した`,
        stateChanges: changes,
      };
    }
  }

  if (action.type === "send_gift") {
    const giftAmount = action.conditions?.goldOffered || 500;
    clan.gold = Math.max(0, clan.gold - giftAmount);
    // 相手の感情を改善
    leader.emotions.respect = Math.min(100, leader.emotions.respect + 10);
    leader.emotions.discontent = Math.max(0, leader.emotions.discontent - 5);
    changes.push(`${targetClan.name}に${giftAmount}金を贈答`);
    return {
      success: true,
      action,
      message: `${targetClan.name}への贈答`,
      stateChanges: changes,
    };
  }

  if (action.type === "break_alliance") {
    const existingRelation = state.diplomacyRelations.find(
      (r) =>
        (r.clan1Id === clanId && r.clan2Id === action.targetId) ||
        (r.clan1Id === action.targetId && r.clan2Id === clanId)
    );
    if (existingRelation && existingRelation.type === "alliance") {
      existingRelation.type = "hostile";
      existingRelation.expirationTurn = null;
      // 怨恨を記録
      const grudge: GrudgeEvent = {
        id: `grudge_${state.turn}_${clanId}_${action.targetId}`,
        turn: state.turn,
        actorId: clanId,
        targetId: action.targetId,
        type: "alliance_break",
        description: `${clan.name}が同盟を破棄`,
        emotionImpact: { respect: -30, discontent: 20 },
      };
      state.grudgeHistory.push(grudge);
      changes.push(`${targetClan.name}との同盟を破棄（怨恨発生）`);
    }
    return {
      success: true,
      action,
      message: `${targetClan.name}との同盟破棄`,
      stateChanges: changes,
    };
  }

  if (action.type === "threaten") {
    leader.emotions.fear = Math.min(100, leader.emotions.fear + 15);
    leader.emotions.discontent = Math.min(100, leader.emotions.discontent + 10);
    changes.push(`${targetClan.name}を威嚇`);
    return {
      success: true,
      action,
      message: `${targetClan.name}への威嚇`,
      stateChanges: changes,
    };
  }

  return {
    success: true,
    action,
    message: action.intent,
    stateChanges: changes,
  };
}

function executeMilitaryAction(
  state: GameState,
  clanId: string,
  action: MilitaryAction
): ActionResult {
  const targetCastle = state.castleCatalog.get(action.targetId)!;
  const clan = state.clanCatalog.get(clanId)!;
  const leader = state.bushoCatalog.get(clan.leaderId)!;
  const changes: string[] = [];

  // 君主の武勇で効果が変動（武勇50で1.0倍、100で1.5倍）
  const warfareModifier = 0.5 + leader.warfare / 100;
  // ランダム要素（0.8〜1.2倍）
  const randomModifier = 0.8 + Math.random() * 0.4;
  const effectModifier = warfareModifier * randomModifier;

  if (action.type === "recruit_soldiers") {
    const count = action.value || 0;
    const foodCost = count * 3;
    clan.food = Math.max(0, clan.food - foodCost);
    // 武勇が高いと徴兵効率UP
    const actualCount = Math.max(1, Math.floor(count * effectModifier));
    targetCastle.soldiers += actualCount;
    // 徴兵で民忠低下（効率がいいほど民への負担も軽減）
    const loyaltyDrop = Math.max(1, Math.floor(count / 100 / effectModifier));
    targetCastle.loyalty = Math.max(0, targetCastle.loyalty - loyaltyDrop);
    changes.push(`${targetCastle.name}で${actualCount}人を徴兵（民忠-${loyaltyDrop}）`);
    return {
      success: true,
      action,
      message: action.intent,
      stateChanges: changes,
    };
  }

  if (action.type === "fortify") {
    const cost = action.value || 0;
    clan.gold = Math.max(0, clan.gold - cost);
    // 武勇が高いと城修築効率UP
    const defBoost = Math.max(1, Math.floor((cost / 150) * effectModifier));
    targetCastle.defense = Math.min(100, targetCastle.defense + defBoost);
    changes.push(`${targetCastle.name}の防御力が${defBoost}上昇`);
    return {
      success: true,
      action,
      message: action.intent,
      stateChanges: changes,
    };
  }

  if (action.type === "attack") {
    const fromCastle = state.castleCatalog.get(action.fromCastleId || "")!;
    const soldierCount = Math.min(action.soldierCount || 0, fromCastle.soldiers);
    fromCastle.soldiers = Math.max(0, fromCastle.soldiers - soldierCount);

    // 戦闘計算（武勇で攻撃力ボーナス）
    const attackPower = soldierCount * (1 + action.riskTolerance * 0.3) * effectModifier;
    const defensePower =
      targetCastle.soldiers * (1 + targetCastle.defense / 100);

    const attackerLosses = Math.floor(
      soldierCount * 0.2 * (defensePower / attackPower)
    );
    const defenderLosses = Math.floor(
      targetCastle.soldiers * 0.3 * (attackPower / defensePower)
    );

    const remainingAttackers = Math.max(0, soldierCount - attackerLosses);
    targetCastle.soldiers = Math.max(0, targetCastle.soldiers - defenderLosses);

    if (targetCastle.soldiers === 0 && remainingAttackers > 0) {
      // 城を奪取
      const previousOwner = targetCastle.ownerId;
      const previousClan = state.clanCatalog.get(previousOwner)!;
      previousClan.castleIds = previousClan.castleIds.filter(
        (id) => id !== targetCastle.id
      );

      targetCastle.ownerId = clanId;
      targetCastle.soldiers = remainingAttackers;
      targetCastle.castellanId = null;
      clan.castleIds.push(targetCastle.id);

      // 怨恨を記録
      const grudge: GrudgeEvent = {
        id: `grudge_${state.turn}_${clanId}_${previousOwner}`,
        turn: state.turn,
        actorId: clanId,
        targetId: previousOwner,
        type: "territory_loss",
        description: `${clan.name}が${targetCastle.name}を奪取`,
        emotionImpact: { respect: -20, discontent: 30 },
      };
      state.grudgeHistory.push(grudge);

      changes.push(
        `${targetCastle.name}を攻略！（損害: ${attackerLosses}人、敵損害: ${defenderLosses}人）`
      );
      return {
        success: true,
        action,
        message: `${targetCastle.name}攻略成功`,
        stateChanges: changes,
      };
    } else {
      // 撤退
      fromCastle.soldiers += remainingAttackers;
      changes.push(
        `${targetCastle.name}攻撃失敗（損害: ${attackerLosses}人、敵損害: ${defenderLosses}人）`
      );
      return {
        success: false,
        action,
        message: `${targetCastle.name}攻略失敗`,
        stateChanges: changes,
      };
    }
  }

  return {
    success: false,
    action,
    message: "行動を実行できませんでした",
    stateChanges: changes,
  };
}

function executeIntrigueAction(
  state: GameState,
  clanId: string,
  action: IntrigueAction
): ActionResult {
  const clan = state.clanCatalog.get(clanId)!;
  const leader = state.bushoCatalog.get(clan.leaderId)!;
  const changes: string[] = [];

  const costs: Record<IntrigueAction["type"], number> = {
    bribe: 500,
    assassinate: 1000,
    spread_rumor: 200,
    incite_rebellion: 800,
  };
  clan.gold = Math.max(0, clan.gold - costs[action.type]);

  // 君主の知略で成功率が変動（知略50で+0%、100で+25%）
  const intelligenceBonus = (leader.intelligence - 50) / 200;
  // ランダム要素（-0.1〜+0.1）
  const randomBonus = (Math.random() - 0.5) * 0.2;

  // 謀略の成功率（リスク許容度に大きく依存）
  const baseChance =
    action.type === "bribe"
      ? 0.4
      : action.type === "assassinate"
        ? 0.2
        : action.type === "spread_rumor"
          ? 0.6
          : 0.3;
  const successChance = Math.min(0.95, Math.max(0.05, baseChance + action.riskTolerance * 0.3 + intelligenceBonus + randomBonus));
  const roll = Math.random();

  if (roll < successChance) {
    const target = state.bushoCatalog.get(action.targetId);
    if (target) {
      switch (action.type) {
        case "bribe":
          target.emotions.loyalty -= 20;
          target.emotions.discontent += 15;
          changes.push(`${target.name}を買収（忠誠低下）`);
          break;
        case "assassinate":
          // 暗殺成功（武将を除去）
          if (target.clanId) {
            const targetClan = state.clanCatalog.get(target.clanId);
            if (targetClan && targetClan.leaderId === target.id) {
              changes.push(`${target.name}暗殺成功（当主死亡！）`);
            } else {
              changes.push(`${target.name}暗殺成功`);
            }
          }
          state.bushoCatalog.delete(target.id);
          break;
        case "spread_rumor":
          target.emotions.discontent += 25;
          changes.push(`${target.name}に関する流言が広まった`);
          break;
        case "incite_rebellion":
          target.emotions.loyalty -= 30;
          target.emotions.discontent += 30;
          changes.push(`${target.name}に謀反を唆した`);
          break;
      }
    }
    return {
      success: true,
      action,
      message: action.intent,
      stateChanges: changes,
    };
  } else {
    changes.push(`謀略失敗（発覚の恐れあり）`);
    return {
      success: false,
      action,
      message: `謀略は失敗に終わった`,
      stateChanges: changes,
    };
  }
}
