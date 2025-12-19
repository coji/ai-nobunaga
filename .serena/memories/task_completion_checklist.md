# Task Completion Checklist

When completing a coding task in this project, ensure the following:

## Before Committing

1. **Type Check**: Run `pnpm typecheck` to ensure no TypeScript errors
2. **Lint**: Run `pnpm lint` to check for linting issues
3. **Format**: Run `pnpm format:fix` to auto-format code

## Quick Validation

Run all checks at once:

```bash
pnpm validate
```

## Testing Changes

Since this is a CLI game, test manually:

```bash
pnpm dev
```

## Common Issues

- ESM imports require `.js` extension even for `.ts` files
- Map types need special handling for serialization
- AI responses should always have fallback handling

## Notes

- No automated test suite currently exists
- Manual testing via `pnpm dev` is the primary verification method
