// UI共通ユーティリティ

import type { DiplomacyType } from "../types.js";

/** 外交関係タイプを日本語に変換 */
export function getDiplomacyLabel(type: DiplomacyType | undefined): string {
  switch (type) {
    case "alliance":
      return "同盟";
    case "truce":
      return "停戦";
    case "hostile":
      return "敵対";
    case "neutral":
      return "中立";
    default:
      return "中立";
  }
}

/** 民忠・忠誠度に応じた色を取得 */
export function getLoyaltyColor(loyalty: number): string {
  if (loyalty < 30) return "red";
  if (loyalty < 50) return "yellow";
  return "green";
}
