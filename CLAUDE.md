# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**npx 信長** is a CLI-based Sengoku (Warring States) simulation game where AI-controlled daimyo (feudal lords) make strategic decisions. The game uses Google Gemini AI for generating dialogue, council discussions, and NPC decision-making.

## Commands

```bash
# Development (with hot reload via tsx)
npm run dev

# Build TypeScript to dist/
npm run build

# Run production build
npm start
```

## Required Environment

Copy `.env.example` to `.env` and set `GEMINI_API_KEY`.

## Architecture

### Core Layers

```
src/
├── index.tsx           # Entry point - renders GameUI with React/Ink
├── types.ts            # All game data types (Busho, Clan, Castle, Actions, etc.)
├── engine/             # Pure game logic (no AI)
│   ├── actions.ts      # Execute actions with critical success/failure system
│   ├── validation.ts   # Validate actions are legal
│   ├── turn.ts         # Turn-end processing (income, upkeep)
│   └── victory.ts      # Win/lose condition checks
├── ai/                 # Gemini AI integration
│   ├── client.ts       # GoogleGenAI client setup
│   ├── advisor.ts      # Council discussions, retainer comments, letter generation
│   ├── executor.ts     # Map tool names to game actions (includes alias handling)
│   ├── turn.ts         # AI daimyo turn execution
│   └── prompts.ts      # Game context prompt generation
├── components/         # Ink (terminal UI) components
│   ├── GameUI.tsx      # Main game container with navigation
│   ├── screens/        # Individual screen components
│   └── hooks/          # Navigation and action hooks
└── data/               # Initial game data (busho, castles, clans, diplomacy)
```

### Key Design Patterns

**AI-Engine Separation**: AI proposes actions via structured JSON; the engine validates and executes them. AI "wants" but engine decides "what happened."

**Tool Name Aliasing**: `executor.ts` normalizes LLM-generated tool names (e.g., `improve_commerce` → `develop_commerce`) to handle common AI mistakes.

**Critical Success/Failure**: Actions have a 15% chance of critical outcomes (`rollForGrade`), affecting results and triggering different narrative responses.

**Council System**: Multi-round discussions where busho (retainers) debate topics based on personality tags, then propose concrete actions filtered by topic category.

**Defection Mechanic**: Bribe action can cause busho to switch clans if loyalty drops to 30 or below (leaders cannot defect).

### Type System Highlights

- `PersonalityTag`: Fixed traits like "権威主義", "実利優先", "猜疑心"
- `Emotions`: Mutable values (loyalty, fear, respect, discontent)
- `ResultGrade`: "critical_failure" | "failure" | "success" | "critical_success"
- `GameAction`: Union of DomesticAction, DiplomacyAction, MilitaryAction, IntrigueAction

### AI Models

- `MODEL` (gemini-flash-latest): Used for council discussions, narrative generation
- `MODEL_LITE` (gemini-2.0-flash-lite): Used for AI daimyo turn decisions (faster/cheaper)

## Language

All game content, UI text, and comments are in Japanese. Code identifiers use English.
