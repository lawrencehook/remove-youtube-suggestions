# TODO

## Quick Wins

| Issue | Effort |
|-------|--------|
| Remove debug `console.log` in `options/main.js:174-175` | 1 min |
| Sync manifest versions (4.3.65 vs 4.3.66) | 1 min |
| Delete unused `TEMPLATE_FIELDSET` in `options/main.js:8` | 1 min |
| Delete dead `setCookie`/`getCookie` in `content-script/main.js:657-678` | 1 min |
| Fix `SEC_IN_WEEK` naming in `utils.js:69` (it's actually minutes) | 1 min |
| Move duplicated regexes to `shared/utils.js` | 5 min |
| Delete commented-out code blocks in `content-script/main.js` | 5 min |
| Add Page Visibility API to pause polling when tab is hidden | 10 min |

## Code Quality

- [ ] Auto-generate `idToShortId` map from `SECTIONS` instead of manual maintenance
- [ ] Add storage validation/migration for schema changes between versions
- [ ] Improve error handling beyond `console.log(error)`
- [ ] Clean up event listeners in `options/main.js` to prevent memory leaks

## i18n / Localization

Hardcoded English strings that break for non-English YouTube:
- `content-script/main.js:171` — `'for you'` comparison
- `content-script/main.js:211` — `'Streamed'` check
- `content-script/main.js:467-468` — `'All'`, `'Related'` chip names

## Incomplete Features

- `utils.js:14` — TODO: validate start time < end time for schedules
- `utils.js:32` — TODO: force endTime to come after startTime

## Fragility

YouTube frequently changes their DOM structure. Monitor these selectors:
- `ytd-rich-grid-row`
- `#metadata-line span`
- `ytd-thumbnail-overlay-time-status-renderer`
- `yt-chip-cloud-chip-renderer`
