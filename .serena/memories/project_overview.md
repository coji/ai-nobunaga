# ai-nobunaga Project Overview

## Purpose

**npx 信長** is a CLI-based Sengoku (Warring States) simulation game where AI-controlled daimyo (feudal lords) make strategic decisions. The game uses Google Gemini AI for generating dialogue, council discussions, and NPC decision-making.

## Tech Stack

- **Runtime**: Node.js (ES2022)
- **Language**: TypeScript (strict mode)
- **UI Framework**: Ink (React for CLI/terminal)
- **AI**: Google Gemini (@google/genai)
- **Package Manager**: pnpm
- **Build**: tsx (development), tsc (production)

## Architecture

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
│   ├── client.ts       # GoogleGenAI client setup with ThinkingLevel
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

## Key Design Patterns

- **AI-Engine Separation**: AI proposes actions via structured JSON; the engine validates and executes them
- **Tool Name Aliasing**: executor.ts normalizes LLM-generated tool names
- **Critical Success/Failure**: Actions have 15% chance of critical outcomes
- **Council System**: Multi-round discussions where busho debate topics based on personality tags
- **Defection Mechanic**: Bribe action can cause busho to switch clans if loyalty drops to 30 or below

## Language Policy

- All game content, UI text, and comments are in Japanese
- Code identifiers use English
