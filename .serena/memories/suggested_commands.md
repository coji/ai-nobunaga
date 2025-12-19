# Suggested Commands

## Development

```bash
# Run in development mode (hot reload via tsx)
pnpm dev

# Build TypeScript to dist/
pnpm build

# Run production build
pnpm start
```

## Code Quality

```bash
# Run linter (Biome)
pnpm lint

# Check formatting (Prettier)
pnpm format

# Fix formatting issues
pnpm format:fix

# Type checking only
pnpm typecheck

# Run all validations (format, lint, typecheck)
pnpm validate
```

## Environment Setup

1. Copy `.env.example` to `.env`
2. Set `GEMINI_API_KEY` in `.env`

## Package Management

```bash
# Install dependencies
pnpm install

# Add a dependency
pnpm add <package>

# Add a dev dependency
pnpm add -D <package>
```
