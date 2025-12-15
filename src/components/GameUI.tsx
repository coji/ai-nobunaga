// メインゲームUIコンポーネント

import { useState } from "react";
import { Box, Text, useInput, useApp } from "ink";
import Spinner from "ink-spinner";
import type { GameState } from "../types.js";

// フック
import { useGameNavigation, useGameActions } from "./hooks/index.js";

// 画面定義
import {
  screenDefinitions,
  type ScreenContext,
  type RenderProps,
} from "./screenDefinitions.js";

interface Props {
  initialState: GameState;
}

export function GameUI({ initialState }: Props) {
  const { exit } = useApp();
  const [state, setState] = useState<GameState>(initialState);

  const nav = useGameNavigation();
  const actions = useGameActions({
    state,
    setState,
    resetToMain: nav.resetToMain,
    setScreen: nav.setScreen,
  });

  const playerClan = state.clanCatalog.get(state.playerClanId)!;
  const playerLeader = state.bushoCatalog.get(playerClan.leaderId)!;

  // 画面操作コンテキスト
  const screenContext: ScreenContext = {
    pushScreen: nav.pushScreen,
    selectedIndex: nav.selectedIndex,
    screenData: nav.screenData,
    getParentIndex: nav.getParentIndex,
    getParentData: nav.getParentData,
    state,
    processEndTurn: actions.processEndTurn,
    handleDomesticAction: actions.handleDomesticAction,
    handleMilitaryCastleAction: actions.handleMilitaryCastleAction,
    handleMilitaryAttackAction: actions.handleMilitaryAttackAction,
    handleDiplomacyAction: actions.handleDiplomacyAction,
  };

  // 画面表示用プロパティ
  const renderProps: RenderProps = {
    state,
    playerClanId: playerClan.id,
    selectedIndex: nav.selectedIndex,
    screenData: nav.screenData,
    parentData: nav.getParentData(),
    parentIndex: nav.getParentIndex(),
    aiResults: actions.aiResults,
  };

  // 現在の画面定義
  const currentScreen = screenDefinitions[nav.screen];

  useInput((input, key) => {
    if (actions.isProcessing) return;

    // ゲーム終了画面
    if (nav.screen === "game_over") {
      if (key.escape) exit();
      return;
    }

    // 終了確認画面
    if (nav.screen === "confirm_exit") {
      if (input === "y" || input === "Y") {
        exit();
      } else if (input === "n" || input === "N" || key.escape) {
        nav.popScreen();
      }
      return;
    }

    // ESC/Backspaceで戻る
    if (key.escape || key.backspace || key.delete) {
      if (nav.screen === "main") {
        if (key.escape) nav.pushScreen("confirm_exit");
      } else {
        nav.popScreen();
      }
      return;
    }

    // 上下キー
    if (key.upArrow) nav.setSelectedIndex((i) => Math.max(0, i - 1));
    if (key.downArrow) nav.setSelectedIndex((i) => i + 1);

    // 選択
    if (key.return) {
      currentScreen.onSelect?.(screenContext);
    }

    // 数字キー
    const num = parseInt(input);
    if (!isNaN(num) && num >= 1 && num <= 9) {
      nav.setSelectedIndex(num - 1);
      setTimeout(() => currentScreen.onSelect?.(screenContext), 50);
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      {/* ヘッダー */}
      <Box borderStyle="double" paddingX={2}>
        <Text bold color="yellow">
          npx 信長
        </Text>
        <Text> - ターン {state.turn} - </Text>
        <Text color="cyan">{playerClan.name}</Text>
        <Text> ({playerLeader.name})</Text>
      </Box>

      {/* ステータスバー */}
      <Box marginY={1}>
        <Text>
          金: <Text color="yellow">{playerClan.gold}</Text> | 兵糧:{" "}
          <Text color="green">{playerClan.food}</Text> | 兵:{" "}
          <Text color="red">
            {playerClan.castleIds.reduce(
              (sum, id) => sum + (state.castleCatalog.get(id)?.soldiers || 0),
              0
            )}
          </Text>{" "}
          | 城: <Text color="cyan">{playerClan.castleIds.length}</Text> | 行動:{" "}
          <Text color="magenta">
            {actions.actionsRemaining}/{actions.maxActions}
          </Text>
        </Text>
      </Box>

      {/* メインコンテンツ */}
      {currentScreen.render(renderProps)}

      {/* メッセージ */}
      {actions.message && (
        <Box marginTop={1} borderStyle="single" paddingX={1}>
          {actions.isProcessing && (
            <Text color="green">
              <Spinner type="dots" />{" "}
            </Text>
          )}
          <Text>{actions.message}</Text>
        </Box>
      )}

      {/* フッター */}
      <Box marginTop={1}>
        <Text dimColor>
          [↑↓] 選択 [Enter] 決定 [BS/ESC] 戻る [1-9] クイック選択
        </Text>
      </Box>
    </Box>
  );
}
