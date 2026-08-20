# Test Action

1. Read current-feature.md to understand what was implemented
2. Identify route handlers, server actions, and utility functions added/modified for this feature
3. Check if tests already exist for these functions
4. For functions without tests that have testable logic, write unit tests:
   - No test runner is configured in this repo yet. If tests are wanted, set up
     Vitest first (add the dep and a `test` script to package.json) and say so.
   - Create unit tests using Vitest
   - Focus on server actions and utilities (not components)
   - Test happy path and error cases
   - Do not write tests just to write them. Use your best judgement
5. Run `pnpm test` to verify all tests pass
6. Report test coverage for the new feature code