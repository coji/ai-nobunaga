import "dotenv/config";
import React from "react";
import { render } from "ink";
import { GameUI } from "./components/GameUI.js";
import { createInitialGameState } from "./data/scenario.js";

// プレイヤーは織田家でスタート
const initialState = createInitialGameState("oda");

console.clear();
console.log("AI信長の野望 を起動中...\n");

render(<GameUI initialState={initialState} />);
