# Settings reset: consolidated findings and fix plan

Date: 2026-08-01
Status: diagnosis confirmed by two independent investigations (Claude and
Codex); this doc consolidates both and proposes a narrow fix plus deferred
follow-ups. No behavior change included.

Supersedes the docs on branches `claude/investigate-settings-reset-bug` and
`codex/investigation/settings-reset-findings`.

## Symptom

Users report that locally stored preferences intermittently "reset" to
defaults, forcing them to re-import or re-select settings. Reported by at
least one premium user; also plausible for signed-in free users. Reports
are consistent with the destructive write-back introduced by PR #213
(`31b56a5`, "Free premium slots").

## Root cause

Tier is inferred synchronously from a locally cached license JWT that expires
every **3 days** (`LICENSE_TOKEN_LIFETIME_DAYS`, `server/src/config.js:13`).
When the cached tier looks like anything less than premium, the client
**persists destructive writes** to `browser.storage.local`, permanently
turning off premium settings. Temporary or indeterminate auth states
(expired-but-renewable license, pending refresh, offline, transient server
error) are treated as a confirmed free tier.

Primary failure sequence for a premium user:

1. More than two premium preferences are enabled; license token is valid for
   3 days. Only the options page ever refreshes it (`refreshLicense`,
   `src/options/settings-menu.js:450`). There is no background refresh, and
   the content script never renews — it only reads.
2. The user browses YouTube for 3+ days without opening the options page.
   The license token expires; the 30-day session token remains valid.
3. On the next YouTube page load, tier is computed as `free_signed_in`
   (session present, license expired) and `enforceSlotBudget(settings, 2)`
   returns a write-back map that **persists `false`** for every enabled
   premium setting beyond the first two (by `PREMIUM_FEATURE_IDS` iteration
   order — arbitrary, not user choice).
4. A later successful license refresh restores premium, but the stored
   preference values are already destroyed. The user must re-import.

Destructive write-back entry points:

- `src/content-script/main.js:125-134` — any matching YouTube page load.
- `src/options/main.js:27-34` — options-page init, synchronously, *before*
  the async `refreshLicense(true)` from `initAccountState`
  (`settings-menu.js:487-507`) can confirm premium. Opening the settings page
  on day 4 wipes settings even though the refresh would succeed moments
  later.

## Additional wipe paths (same underlying flaw)

1. **Expired license + transient renewal failure.** `License.checkLicense()`
   only falls back to the cached entitlement while the cached token is still
   valid; once expired, a network/server failure returns
   `{ isPremium: false, error: true }` (`src/shared/license.js:84-102`).
   `updatePremiumUI()` doesn't distinguish this indeterminate result from a
   confirmed free account — its non-premium branch calls
   `pruneToSlotBudget()`, persisting the pruned values
   (`settings-menu.js:519-547`).
2. **Session expiry (30 days) → 401.** `checkLicense` signs the user out and
   `updatePremiumUI` calls `disableAllPremiumFeatures()`, persisting `false`
   for *every* premium feature (`license.js:58-63`,
   `settings-menu.js:509-528`). This also provides a path affecting signed-in
   free users: their selected slot features get turned off.
3. **Explicit sign-out.** The sign-out button handler calls the same
   destructive helper (`settings-menu.js:711-726`).

All of this conflicts with the design already documented on
`clearAllPremium()` (`src/shared/main.js:863`): entitlement enforcement is
meant to be in-memory so stored premium preferences return when access
returns. The slot-budget write-back introduced in #213 violates that
principle and creates the reported regression.

## Why it appears intermittent

- Tied to the 3-day token boundary, not to any user action.
- Opening the options page before expiry silently renews the token and
  avoids the failure that time.
- Network conditions around renewal change the outcome.
- Users with ≤2 premium features enabled lose nothing to slot pruning.
- Grandfathered tokens last 730 days
  (`GRANDFATHERED_TOKEN_LIFETIME_DAYS`, `server/src/config.js:14`), so
  lifetime accounts rarely hit the boundary — subscribers hit it every
  3 days.
- Most premium options default to `false`, so wiping them reads as a broad
  "reset to defaults" even though free settings are intact.

## Scope limitation

No code path was found that clears *free* settings or all of storage. Init
writes defaults only for missing keys; `Auth.signOut()` removes only the
session token, license token, and email. If reports confirm free settings
(e.g. `remove_homepage`) also reset, treat that as a separate issue and
gather before/after storage diagnostics.

## Local reproduction (no server needed)

1. Craft an expired JWT payload with `premium: true`; keep any truthy
   `session_token`.
2. Enable six premium settings in a settings object.
3. `License.getTierSync()` → `free_signed_in`;
   `enforceSlotBudget(settings, 2)` → 4 settings returned as `false`
   write-backs. The 2 survivors are chosen by static list order.

## Narrow fix plan

The bug-fix release should contain Phase 1 only. It is a small, mechanical
data-loss fix. The later sections are explicitly deferred ideas and should not
be bundled into the same change.

### Phase 1 — stop destroying stored preferences (minimal, ship first)

Never persist tier-based demotions. Keep the existing control flow and enforce
tier in memory at apply/render time, exactly as `clearAllPremium` already
does. The behavioral patch is four concentrated call-site changes:

- In `src/content-script/main.js`, keep `enforceSlotBudget(settings, limit)`
  but remove its `browser.storage.local.set(writeBack)` call.
- In `src/options/main.js`, make the identical change: clamp the local
  `settings` copy without writing the returned map to storage.
- In `pruneToSlotBudget()`, retain the helper and UI updates but call
  `updateSetting(id, false, { write: false })`. Keep `enforceSlotBudget`'s
  return value — this helper still consumes it (the two init sites no longer
  will; drop their unused `writeBack` variable, keeping the call for its
  in-memory mutation).
- In `disableAllPremiumFeatures()`, retain the helper and its callers but call
  `updateSetting(id, false, { write: false })`.
- Update the stale `enforceSlotBudget()` comment that currently instructs
  callers to persist the returned map. No helper rename or redesign is needed.

Verified no-change-needed paths (full-source audit, see appendix):

- **Import** (`settings-menu.js:301`) persists the pasted settings verbatim —
  including premium prefs — then `updateSettings()` applies them through
  `updateSetting(..., { write: false })`, whose tier clamp keeps effective
  behavior within budget. That already matches the stored-vs-effective
  philosophy; leave it alone.
- **Export** (`settings-menu.js:268`) reads `browser.storage.local` directly,
  not the clamped in-memory cache, so post-fix an export taken during an
  entitlement lapse still contains the user's full preferences.
- `updateSetting`'s premium clamp only coerces `value === true`, so the two
  helpers' `false` writes pass through it unaffected.

Do not add storage keys, background renewal, manifest permissions, messaging,
new tier states, or a generalized desired-vs-effective settings layer in the
Phase 1 patch.

With those four behavioral changes, error/offline, `401`, explicit sign-out,
content initialization, and options initialization all reuse their existing
paths without overwriting preferences. Phase 1 may conservatively restrict
effective behavior while entitlement is indeterminate, but it preserves the
underlying preferences. The deferred renewal work defines continuity through
that window.

Accepted limitation (keeps Phase 1 narrow): the current destructive writes
also happened to notify already-open contexts through
`browser.storage.onChanged`. With the writes removed, an open YouTube tab or
options page reflects a confirmed tier change (sign-out, downgrade, re-upgrade)
on its next page load rather than instantly. This is temporary effective-state
staleness, including entitlement gating after sign-out or downgrade; it is not
data loss, but it is not the ideal final behavior. Accepting it keeps the
urgent patch narrow. Full immediate cross-context re-derivation is deferred.

The intended transition behavior is:

| Transition | Stored preferences | Effective behavior |
| --- | --- | --- |
| Refresh pending or transient error | Unchanged | Keep the current view when available; otherwise use a non-destructive fallback |
| Confirmed premium | Unchanged | Reapply all stored preferences |
| Confirmed signed-in free | Unchanged | Apply the allowed slot budget |
| Sign-out or session `401` | Unchanged | Disable premium behavior in memory |

In Phase 1, "effective behavior" changes apply at the next initialization of
each context (page load, popup open); immediate propagation is deferred.

Acceptance criteria:

- No auth, refresh, sign-out, or tier-transition path deletes or overwrites
  stored preferences.
- Transient network failures cause no persistent changes.
- Free-tier slot limits remain enforced in effective behavior and UI
  (direct toggles, chained effects, and import).
- Re-auth or re-upgrade restores previous premium choices without import
  (a page reload is acceptable in Phase 1).

### Deferred follow-up — proactive license renewal

Refresh the license token through a single background-owned refresh path when
the token is near expiry (`LICENSE_REFRESH_THRESHOLD_MS` is already 24h), so
renewal doesn't depend on the user opening the options page. Avoid direct
content-script refreshes: content scripts run in all frames, which could cause
duplicate requests and cross-origin/permission problems. They should consume
the resulting storage/message update instead.

Implementation requirements include:

- Add the required background alarm and premium-server host permissions to
  both manifests.
- Load or expose the auth/license dependencies in the Chrome service worker
  and Firefox background context.
- Deduplicate concurrent startup, alarm, and user-triggered refreshes with one
  in-flight promise.
- Define a bounded last-confirmed-entitlement/grace policy for pending or
  transiently failed renewal rather than silently trusting an expired token
  forever.

Deferred renewal acceptance: paid users with a renewable session see no
effective settings change at the 3-day license boundary, and multiple matching
frames do not generate multiple renewal requests.

### Deferred follow-up — tier states and slot selection

- Introduce an explicit indeterminate license state (pending / expired-but-
  renewable / offline / transient error) distinct from a confirmed free
  account, so callers can't accidentally collapse them.
- Immediate cross-context tier propagation: factor a shared, pure
  `deriveEffectiveSettings(storedSettings, tier)` (returns a copy, never
  mutates its input) and re-run it in every open context when
  `license_token`/`session_token` change, instead of relying on next page
  load. This lifts Phase 1's accepted staleness limitation.
- Consider a user-controlled list of selected free-slot feature IDs instead
  of first-two-by-list-order, keeping the premium preference set untouched.
- If warranted, complete the desired-vs-effective settings separation:
  `stored preferences + confirmed entitlement -> effective settings`.

## Tests

The suite (currently 168 passing) has no coverage of the combined
token-expiry × settings-persistence lifecycle. Phase 1 should add focused
regression coverage for its four behavioral changes:

- Expired premium license + valid session ⇒ no `false` writes while renewal
  pending; successful renewal preserves all stored preferences.
- Offline renewal after expiry ⇒ preferences preserved.
- 401 ⇒ auth state removed, preferences preserved.
- Explicit sign-out ⇒ preferences preserved.
- Confirmed free account ⇒ effective two-slot behavior with stored premium
  configuration unchanged.
- Signed-in free user cannot activate a third slot via toggle, chained
  effect, or import.
- Each transition asserts a before/after snapshot of `browser.storage.local`
  proving preference keys did not change.

Deferred-work tests, not part of the Phase 1 patch:

- Background refresh is single-flight when startup/alarm/manual
  triggers or multiple content frames overlap.
- Auth-token-only changes re-derive settings in every already-open
  context without a reload.

## Appendix: storage-write inventory (audit)

Every `browser.storage.local` write/remove in the extension is classified
below. The background service worker does not write storage; the other
extension pages outside this inventory are read-only with respect to settings.

Destructive — removed by Phase 1:

- `content-script/main.js:133` — slot-budget write-back on page load.
- `options/main.js:33` — slot-budget write-back on options init.
- `options/main.js:403` via `updateSetting(write: true)` from
  `pruneToSlotBudget()` and `disableAllPremiumFeatures()` — switched to
  `{ write: false }`.

Benign — unchanged:

- `content-script/main.js:122`, `options/main.js:22` — reveal-setting
  migration; fills missing keys only.
- `content-script/main.js:145` — init defaults; missing keys only.
- `content-script/main.js:736` — content-script `updateSetting`; callers only
  touch free keys (reveal dismiss, `global_enable`, timed/schedule keys).
- `options/main.js:403` — user-initiated toggles (deliberate writes).
- `options/main.js:671/676` — logging opt-in prompt keys.
- `settings-menu.js:301` — import; writes what the user pasted.
- `shared/banners.js:56` — per-banner dismissal key.
- `shared/auth.js:55/109`, `shared/license.js:71` — auth/license token keys
  only; sign-out removes `session_token`, `license_token`, `user_email` and
  never touches settings.
- `shared/https.js:27-28` — legacy donor-auth `user`/`login_token` keys;
  unrelated to current auth or settings.

(Mixpanel's bundled queue uses `window.localStorage`, not extension storage.)
