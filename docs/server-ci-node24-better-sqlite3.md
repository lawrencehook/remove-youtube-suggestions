# Server CI failure on Node 24

## Status

Resolved by upgrading `better-sqlite3` from 11.10.0 to 13.0.3. This is
unrelated to the YouTube-logo feature.

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

## Resolution

`better-sqlite3` 13.0.3 supports the Node 24 CI runtime and requires Node 22
or later. The server's declared Node engine was updated accordingly; CI remains
on Node 24.

## Validation for a fix

1. Run `npm install` and `npm test` in `server/`.
2. Confirm the GitHub Actions `server-tests` job passes on Node 24 without a
native assertion or process abort.
