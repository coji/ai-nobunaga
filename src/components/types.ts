// UI共通型定義

export type Screen =
  | "main"
  | "status"
  | "status_list"
  | "status_map"
  | "diplomacy"
  | "diplomacy_target"
  | "military"
  | "military_castle"
  | "military_attack"
  | "domestic"
  | "domestic_castle"
  | "letters"
  | "ai_turn"
  | "confirm_exit"
  | "game_over";

export type DomesticType = "develop_agriculture" | "develop_commerce";
export type MilitaryType = "recruit_soldiers" | "fortify" | "attack";
