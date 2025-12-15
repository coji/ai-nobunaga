// Gemini AI クライアント

import { GoogleGenAI } from "@google/genai";

export const ai = new GoogleGenAI({
  apiKey: process.env["GEMINI_API_KEY"] ?? "",
});

export const MODEL = "gemini-flash-latest";
export const MODEL_LITE = "gemini-2.0-flash-lite"; // AI大名ターン用の軽量モデル
