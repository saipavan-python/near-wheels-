## What this changes

<!-- One or two sentences. Link the issue with Closes #123. -->

## Type

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor (no behaviour change)
- [ ] Performance
- [ ] Security
- [ ] Docs
- [ ] Tests only

## Checklist

- [ ] `npm test` passes (79 tests)
- [ ] `npm run typecheck` is clean
- [ ] `npm run build` succeeds **with no `RAZORPAY_*` or `GEMINI_API_KEY` set**
- [ ] New or changed logic in `src/lib/services/` has a test in the mirrored `__tests__` directory
- [ ] Business logic stayed out of the route handler — handlers parse, authorize, delegate
- [ ] No `next/*` imports added to `src/lib/services/`
- [ ] Any `prisma/schema.prisma` change includes the migration/`db push` note below

## Database changes

<!-- If you touched the schema, describe the change and whether it is backwards compatible. Delete this section otherwise. -->

- [ ] No schema change

## Manual verification

<!-- How did you confirm this works? What did you click? -->

## Screenshots

<!-- For UI changes only. -->

## Notes for the reviewer

<!-- Anything non-obvious, a trade-off you made, or a decision you want checked. -->
