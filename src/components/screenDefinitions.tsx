// 画面定義 - 各画面のコンポーネントと選択時の振る舞いを定義

import { Box, Text } from "ink";
import type { ReactNode } from "react";
import type { Screen, DomesticType, MilitaryType } from "./types.js";
import type { GameState } from "../types.js";
import type { AITurnResult } from "../ai.js";
import type { ScreenData } from "./hooks/useGameNavigation.js";

import {
  MainMenu,
  DomesticMenu,
  DomesticCastleScreen,
  MilitaryMenu,
  MilitaryCastleScreen,
  MilitaryAttackScreen,
  DiplomacyMenu,
  DiplomacyTargetScreen,
} from "./menus/index.js";
import {
  StatusScreen,
  StatusMenu,
  MapScreen,
  LettersScreen,
  AITurnScreen,
} from "./screens/index.js";

// 勢力情報サブメニューオプション
const STATUS_OPTIONS: Screen[] = ["status_list", "status_map"];

// 画面操作用コンテキスト
export interface ScreenContext {
  // ナビゲーション
  pushScreen: (screen: Screen, data?: ScreenData) => void;
  selectedIndex: number;
  screenData: ScreenData;
  getParentIndex: () => number;
  getParentData: () => ScreenData;
  // 状態
  state: GameState;
  // アクション
  processEndTurn: () => void;
  handleDomesticAction: (index: number, type: DomesticType) => void;
  handleMilitaryCastleAction: (index: number, type: MilitaryType) => void;
  handleMilitaryAttackAction: (index: number) => void;
  handleDiplomacyAction: (index: number) => void;
}

// 画面表示用プロパティ
export interface RenderProps {
  state: GameState;
  playerClanId: string;
  selectedIndex: number;
  screenData: ScreenData;
  parentData: ScreenData;
  parentIndex: number;
  aiResults: { clanName: string; result: AITurnResult }[];
}

// 画面定義の型
interface ScreenDefinition {
  render: (props: RenderProps) => ReactNode;
  onSelect?: (ctx: ScreenContext) => void;
}

// メニューオプション定義
const MAIN_OPTIONS: Screen[] = [
  "status",
  "domestic",
  "military",
  "diplomacy",
  "letters",
];

const DOMESTIC_TYPES: DomesticType[] = [
  "develop_agriculture",
  "develop_commerce",
];

const MILITARY_TYPES: MilitaryType[] = [
  "recruit_soldiers",
  "fortify",
  "attack",
];

// 画面定義
export const screenDefinitions: Record<Screen, ScreenDefinition> = {
  main: {
    render: ({ selectedIndex }) => <MainMenu selectedIndex={selectedIndex} />,
    onSelect: (ctx) => {
      const selected = MAIN_OPTIONS[ctx.selectedIndex];
      if (selected === undefined) {
        // end_turn (index 5)
        ctx.processEndTurn();
      } else {
        ctx.pushScreen(selected);
      }
    },
  },

  status: {
    render: ({ selectedIndex }) => <StatusMenu selectedIndex={selectedIndex} />,
    onSelect: (ctx) => {
      const selected = STATUS_OPTIONS[ctx.selectedIndex];
      if (selected) {
        ctx.pushScreen(selected);
      }
    },
  },

  status_list: {
    render: ({ state, playerClanId }) => (
      <StatusScreen state={state} playerClanId={playerClanId} />
    ),
  },

  status_map: {
    render: ({ state, playerClanId }) => (
      <MapScreen state={state} playerClanId={playerClanId} />
    ),
  },

  domestic: {
    render: ({ selectedIndex }) => (
      <DomesticMenu selectedIndex={selectedIndex} />
    ),
    onSelect: (ctx) => {
      const domesticType =
        DOMESTIC_TYPES[ctx.selectedIndex] || "develop_agriculture";
      ctx.pushScreen("domestic_castle", { domesticType });
    },
  },

  domestic_castle: {
    render: ({ state, playerClanId, selectedIndex, screenData }) => (
      <DomesticCastleScreen
        state={state}
        playerClanId={playerClanId}
        selectedIndex={selectedIndex}
        domesticType={screenData.domesticType || "develop_agriculture"}
      />
    ),
    onSelect: (ctx) => {
      ctx.handleDomesticAction(
        ctx.selectedIndex,
        ctx.screenData.domesticType || "develop_agriculture"
      );
    },
  },

  military: {
    render: ({ selectedIndex }) => (
      <MilitaryMenu selectedIndex={selectedIndex} />
    ),
    onSelect: (ctx) => {
      const militaryType =
        MILITARY_TYPES[ctx.selectedIndex] || "recruit_soldiers";
      if (militaryType === "attack") {
        ctx.pushScreen("military_attack", { militaryType });
      } else {
        ctx.pushScreen("military_castle", { militaryType });
      }
    },
  },

  military_castle: {
    render: ({ state, playerClanId, selectedIndex, screenData }) => (
      <MilitaryCastleScreen
        state={state}
        playerClanId={playerClanId}
        selectedIndex={selectedIndex}
        militaryType={screenData.militaryType || "recruit_soldiers"}
      />
    ),
    onSelect: (ctx) => {
      ctx.handleMilitaryCastleAction(
        ctx.selectedIndex,
        ctx.screenData.militaryType || "recruit_soldiers"
      );
    },
  },

  military_attack: {
    render: ({ state, playerClanId, selectedIndex }) => (
      <MilitaryAttackScreen
        state={state}
        playerClanId={playerClanId}
        selectedIndex={selectedIndex}
      />
    ),
    onSelect: (ctx) => {
      ctx.handleMilitaryAttackAction(ctx.selectedIndex);
    },
  },

  diplomacy: {
    render: ({ selectedIndex }) => (
      <DiplomacyMenu selectedIndex={selectedIndex} />
    ),
    onSelect: (ctx) => {
      ctx.pushScreen("diplomacy_target");
    },
  },

  diplomacy_target: {
    render: ({ state, playerClanId, selectedIndex, parentIndex }) => (
      <DiplomacyTargetScreen
        state={state}
        playerClanId={playerClanId}
        selectedIndex={selectedIndex}
        diplomacyTypeIndex={parentIndex}
      />
    ),
    onSelect: (ctx) => {
      ctx.handleDiplomacyAction(ctx.selectedIndex);
    },
  },

  letters: {
    render: ({ state, screenData }) => (
      <LettersScreen state={state} currentLetter={screenData.letter || null} />
    ),
  },

  ai_turn: {
    render: ({ aiResults }) => <AITurnScreen aiResults={aiResults} />,
  },

  confirm_exit: {
    render: () => (
      <Box flexDirection="column">
        <Text bold color="yellow">
          ゲームを終了しますか？
        </Text>
        <Text>
          [Y] はい {"  "} [N] いいえ
        </Text>
      </Box>
    ),
  },

  game_over: {
    render: ({ screenData }) => (
      <Box flexDirection="column" alignItems="center" paddingY={2}>
        <Text bold color={screenData.isVictory ? "green" : "red"}>
          {screenData.isVictory ? "天下統一！" : "滅亡..."}
        </Text>
        <Box marginY={1}>
          <Text>{screenData.gameOverReason}</Text>
        </Box>
        <Text dimColor>[ESC] 終了</Text>
      </Box>
    ),
  },
};
