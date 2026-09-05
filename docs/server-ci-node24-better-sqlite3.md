# Server CI failure on Node 24

## Status

Deferred investigation. This is unrelated to the YouTube-logo feature and
affects `main` as well as feature branches based on it.

## Failure

The `server-tests` GitHub Actions job fails after most server tests complete.
The failure occurs while Node cleans up SQLite objects after
`tests/storage.test.js`:

```text
Assertion failed: (env) != nullptr
Database::~Database()
better_sqlite3.node
```

Run: `33993716157`, job: `101380350322`.

The job reports 62 passing tests and one failed test file. The application test
assertions preceding the crash pass; the native process abort makes the test
run fail.

## Cause

Workflow change #224 moved both CI jobs from Node 20 to Node 24. The server
still uses `better-sqlite3` 11.10.0. That native dependency is the crashing
component in the Node 24 process-cleanup stack.

## Suggested follow-up

Prefer upgrading `better-sqlite3` to a Node-24-compatible release, regenerate
`server/package-lock.json`, and run the server suite on Node 24 in CI.

If an upgrade needs more time, temporarily pin only the `server-tests` job to
Node 22. Keep extension tests on Node 24. Treat that as a short-lived
workaround rather than the final resolution.

## Validation for a fix

1. Run `npm install` and `npm test` in `server/` using Node 24.
2. Confirm the storage tests finish without a native assertion or process
abort.
3. Confirm the GitHub Actions `server-tests` job passes.
