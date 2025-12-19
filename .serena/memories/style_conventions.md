# Code Style and Conventions

## Formatting

- **Formatter**: Prettier with `prettier-plugin-organize-imports`
- Auto-format on save is expected

## Linting

- **Linter**: Biome (recommended rules)
- `noArrayIndexKey` is disabled (React array index as key allowed)

## TypeScript Configuration

- **Module**: ESM (type: "module" in package.json)
- **Strict mode**: enabled
- **noUncheckedIndexedAccess**: enabled (array access may return undefined)
- **exactOptionalPropertyTypes**: enabled
- **jsx**: react-jsx

## Naming Conventions

- Code identifiers: English
- Game content, UI text, comments: Japanese
- File naming: camelCase for files, PascalCase for React components

## Import Style

- Use `.js` extension for local imports (ESM requirement)
- Example: `import { foo } from './bar.js'`

## Type System Highlights

- `PersonalityTag`: Fixed traits like "権威主義", "実利優先", "猜疑心"
- `Emotions`: Mutable values (loyalty, fear, respect, discontent)
- `ResultGrade`: "critical_failure" | "failure" | "success" | "critical_success"
- `GameAction`: Union of DomesticAction, DiplomacyAction, MilitaryAction, IntrigueAction

## AI Model Usage

- `MODEL` (gemini-3-flash-preview): Main model
- `THINKING` constants define thinking levels per use case:
  - AI_TURN: MINIMAL (fast decisions)
  - PLAYER_COMMAND: LOW
  - COUNCIL: MEDIUM (thorough reasoning)
  - LETTER: LOW
