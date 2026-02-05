# TODO

## Code Quality

- [ ] Auto-generate `idToShortId` map from `SECTIONS` instead of manual maintenance
- [ ] Add storage validation/migration for schema changes between versions
- [ ] Improve error handling beyond `console.log(error)`

## i18n / Localization

Hardcoded English strings that break for non-English YouTube:
- `content-script/main.js` — `'for you'` comparison
- `content-script/main.js` — `'Streamed'` check
- `content-script/main.js` — `'All'`, `'Related'` chip names

## Incomplete Features

- `utils.js:14` — TODO: validate start time < end time for schedules
- `utils.js:32` — TODO: force endTime to come after startTime

## Fragility

YouTube frequently changes their DOM structure. Monitor these selectors:
- `ytd-rich-grid-row`
- `#metadata-line span`
- `ytd-thumbnail-overlay-time-status-renderer`
- `yt-chip-cloud-chip-renderer`
