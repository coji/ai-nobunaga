// ゲームアクション用カスタムフック

import { useState } from "react";
import type { GameState } from "../../types.js";
import type { Screen } from "../types.js";
import type { ScreenData } from "./useGameNavigation.js";
import { processTurnEnd, checkVictory } from "../../engine.js";
import { executeAITurn, type AITurnResult } from "../../ai/index.js";

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

  const useAction = () => {
    const remaining = actionsRemaining - 1;
    setActionsRemaining(remaining);
    if (remaining <= 0) {
      setTimeout(() => processEndTurn(), 100);
    }
  };

  const handleCouncilProposal = (result: {
    tool: string;
    narrative: string;
    success: boolean;
  }) => {
    if (actionsRemaining <= 0) {
      setMessage("行動ポイントがありません");
      return;
    }

    setMessage(result.narrative);
    setState({ ...state });

    // 行動ポイントを消費
    useAction();
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
    handleCouncilProposal,
    processEndTurn,
  };
}
