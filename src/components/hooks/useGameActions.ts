// ゲームアクション用カスタムフック

import { useState } from "react";
import type { GameState } from "../../types.js";
import type { DomesticType, MilitaryType, Screen } from "../types.js";
import type { ScreenData } from "./useGameNavigation.js";
import {
  executeAction,
  processTurnEnd,
  checkVictory,
  validateAction,
} from "../../engine.js";
import {
  executeAITurn,
  generateLetter,
  generateNarrative,
  type AITurnResult,
} from "../../ai.js";

interface UseGameActionsProps {
  state: GameState;
  setState: (state: GameState) => void;
  resetToMain: () => void;
  setScreen: (screen: Screen, data?: ScreenData) => void;
}

export function useGameActions({
  state,
  setState,
  resetToMain,
  setScreen,
}: UseGameActionsProps) {
  const MAX_ACTIONS = 3;
  const [message, setMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionsRemaining, setActionsRemaining] = useState(MAX_ACTIONS);
  const [aiResults, setAiResults] = useState<
    { clanName: string; result: AITurnResult }[]
  >([]);

  const playerClan = state.clanCatalog.get(state.playerClanId)!;
  const playerLeader = state.bushoCatalog.get(playerClan.leaderId)!;

  const useAction = () => {
    const remaining = actionsRemaining - 1;
    setActionsRemaining(remaining);
    if (remaining <= 0) {
      setTimeout(() => processEndTurn(), 100);
    }
  };

  const handleDomesticAction = async (
    selectedIndex: number,
    selectedDomesticType: DomesticType
  ) => {
    if (actionsRemaining <= 0) {
      setMessage("行動ポイントがありません");
      return;
    }

    const castles = playerClan.castleIds.map((id) =>
      state.castleCatalog.get(id)!
    );
    const castle = castles[selectedIndex];
    if (!castle) return;

    const typeLabel =
      selectedDomesticType === "develop_agriculture" ? "農業開発" : "商業開発";
    const action = {
      category: "内政" as const,
      type: selectedDomesticType,
      targetId: castle.id,
      intent: `${castle.name}の${typeLabel}`,
      riskTolerance: 0.5,
      value: 500,
    };

    const validation = validateAction(state, playerClan.id, action);
    if (!validation.valid) {
      setMessage(`実行不可: ${validation.reason}`);
      return;
    }

    setIsProcessing(true);
    const result = executeAction(state, playerClan.id, action);
    setState({ ...state });

    const narrative = await generateNarrative(
      playerLeader.name,
      `${castle.name}の${typeLabel}`,
      result.stateChanges.join(", "),
      result.success
    );
    setMessage(narrative);
    setIsProcessing(false);
    resetToMain();
    useAction();
  };

  const handleMilitaryCastleAction = async (
    selectedIndex: number,
    selectedMilitaryType: MilitaryType
  ) => {
    if (actionsRemaining <= 0) {
      setMessage("行動ポイントがありません");
      return;
    }

    const castles = playerClan.castleIds.map((id) =>
      state.castleCatalog.get(id)!
    );
    const castle = castles[selectedIndex];
    if (!castle) return;

    const isRecruit = selectedMilitaryType === "recruit_soldiers";
    const typeLabel = isRecruit ? "徴兵" : "城修築";
    const value = isRecruit ? 500 : 750;

    const action = {
      category: "軍事" as const,
      type: selectedMilitaryType,
      targetId: castle.id,
      intent: `${castle.name}の${typeLabel}`,
      riskTolerance: 0.5,
      value,
    };

    const validation = validateAction(state, playerClan.id, action);
    if (!validation.valid) {
      setMessage(`実行不可: ${validation.reason}`);
      return;
    }

    setIsProcessing(true);
    const result = executeAction(state, playerClan.id, action);
    setState({ ...state });

    const narrative = await generateNarrative(
      playerLeader.name,
      `${castle.name}の${typeLabel}`,
      result.stateChanges.join(", "),
      result.success
    );
    setMessage(narrative);
    setIsProcessing(false);
    resetToMain();
    useAction();
  };

  const handleMilitaryAttackAction = async (selectedIndex: number) => {
    if (actionsRemaining <= 0) {
      setMessage("行動ポイントがありません");
      return;
    }

    const attackTargets: {
      from: string;
      to: string;
      toName: string;
      fromName: string;
    }[] = [];
    for (const castleId of playerClan.castleIds) {
      const castle = state.castleCatalog.get(castleId)!;
      for (const adjId of castle.adjacentCastleIds) {
        const adjCastle = state.castleCatalog.get(adjId)!;
        if (adjCastle.ownerId !== playerClan.id) {
          attackTargets.push({
            from: castleId,
            to: adjId,
            toName: adjCastle.name,
            fromName: castle.name,
          });
        }
      }
    }

    const target = attackTargets[selectedIndex];
    if (!target) return;

    const fromCastle = state.castleCatalog.get(target.from)!;
    const soldiers = Math.floor(fromCastle.soldiers * 0.7);

    const action = {
      category: "軍事" as const,
      type: "attack" as const,
      targetId: target.to,
      intent: `${target.toName}を攻撃`,
      riskTolerance: 0.6,
      soldierCount: soldiers,
      fromCastleId: target.from,
    };

    setIsProcessing(true);
    const result = executeAction(state, playerClan.id, action);
    setState({ ...state });

    const narrative = await generateNarrative(
      playerLeader.name,
      `${target.fromName}から${target.toName}への攻撃（${soldiers}人）`,
      result.stateChanges.join(", "),
      result.success
    );
    setMessage(narrative);
    setIsProcessing(false);

    const victory = checkVictory(state);
    if (victory.gameOver) {
      setScreen("game_over", {
        gameOverReason: victory.reason || "ゲーム終了",
        isVictory: victory.winner === playerClan.id,
      });
    } else {
      resetToMain();
      useAction();
    }
  };

  const handleDiplomacyAction = async (selectedIndex: number) => {
    if (actionsRemaining <= 0) {
      setMessage("行動ポイントがありません");
      return;
    }

    const otherClans = [...state.clanCatalog.values()].filter(
      (c) => c.id !== playerClan.id
    );
    const targetClan = otherClans[selectedIndex];
    if (!targetClan) return;

    setIsProcessing(true);
    setMessage(`${targetClan.name}への書状を作成中...`);

    try {
      const letter = await generateLetter(
        state,
        playerClan.id,
        targetClan.id,
        "propose_alliance",
        `${playerClan.name}から${targetClan.name}への同盟申し入れ`
      );
      state.letters.push(letter);

      const action = {
        category: "外交" as const,
        type: "propose_alliance" as const,
        targetId: targetClan.id,
        intent: `${targetClan.name}に同盟を申し入れる`,
        riskTolerance: 0.5,
        conditions: { duration: 12 },
      };
      const result = executeAction(state, playerClan.id, action);
      setState({ ...state });

      const narrative = await generateNarrative(
        playerLeader.name,
        `${targetClan.name}への同盟申し入れ`,
        result.stateChanges.join(", ") ||
          (result.success ? "同盟成立" : "同盟拒否"),
        result.success
      );
      setMessage(narrative);
      resetToMain();
      useAction();
    } catch (e) {
      setMessage(`エラー: ${e}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const processEndTurn = async () => {
    setIsProcessing(true);
    setScreen("ai_turn");
    setAiResults([]);

    try {
      for (const clan of state.clanCatalog.values()) {
        if (clan.id === playerClan.id) continue;

        setMessage(`${clan.name}が思考中...`);
        const result = await executeAITurn(state, clan.id);
        setAiResults((r) => [...r, { clanName: clan.name, result }]);
      }

      processTurnEnd(state);
      setMessage(`ターン${state.turn}開始`);
      setState({ ...state });
      setActionsRemaining(MAX_ACTIONS);

      const victory = checkVictory(state);
      if (victory.gameOver) {
        setIsProcessing(false);
        setScreen("game_over", {
          gameOverReason: victory.reason || "ゲーム終了",
          isVictory: victory.winner === playerClan.id,
        });
        return;
      }
    } catch (e) {
      setMessage(`エラー: ${e}`);
    } finally {
      setIsProcessing(false);
      resetToMain();
    }
  };

  return {
    message,
    isProcessing,
    actionsRemaining,
    aiResults,
    maxActions: MAX_ACTIONS,
    handleDomesticAction,
    handleMilitaryCastleAction,
    handleMilitaryAttackAction,
    handleDiplomacyAction,
    processEndTurn,
  };
}
