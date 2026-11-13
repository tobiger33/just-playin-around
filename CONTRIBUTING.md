# Contributing

## Development setup

- Use Node.js 20 or newer.
- Run `npm ci` to install the pinned development dependencies.
- Install the browser once with `npx playwright install chromium`.

## Checks

Before opening a pull request, run:

```sh
npm test
npm run verify
npm run secret-scan
```

When Chromium is unavailable, `SKIP_BROWSER=1 npm test` and
`SKIP_BROWSER=1 npm run verify` skip browser-dependent checks; run the full
browser checks before merging.

Keep changes focused, preserve existing project conventions, and update
documentation and tests for behavior changes. Do not commit credentials,
generated `frames/` output, or copyrighted assets without permission.
