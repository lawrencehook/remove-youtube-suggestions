# Settings reset: consolidated findings and fix plan

Date: 2026-08-01
Status: diagnosis confirmed by two independent investigations (Claude and
Codex); this doc consolidates both and proposes a phased fix. No behavior
change included.

Supersedes the docs on branches `claude/investigate-settings-reset-bug` and
`codex/investigation/settings-reset-findings`.

## Symptom

Users report that locally stored preferences intermittently "reset" to
defaults, forcing them to re-import or re-select settings. Reported by at
least one premium user; also plausible for signed-in free users. Reports
began after PR #213 (`31b56a5`, "Free premium slots").

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
   `settings-menu.js:509-528`). Also hits signed-in free users — their slot
   features get turned off — matching reports that the bug isn't
   premium-only but seems limited to logged-in users.
3. **Explicit sign-out.** The sign-out button handler calls the same
   destructive helper (`settings-menu.js:711-726`).

All of this conflicts with the design already documented on
`clearAllPremium()` (`src/shared/main.js:863`): entitlement enforcement is
meant to be in-memory so stored premium preferences return when access
returns. The slot-budget write-back introduced in #213 violates that
principle, which is why reports are recent.

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

## Fix plan

Phased: Phase 1 is a small, shippable data-loss fix; later phases are
incremental hardening. (Codex's fuller desired-vs-effective architecture is
the end state; we get the safety win first without the refactor.)

### Phase 1 — stop destroying stored preferences (minimal, ship first)

Never persist tier-based demotions. Enforce tier in memory at
apply/render time, exactly as `clearAllPremium` already does:

- Drop the `enforceSlotBudget` write-backs in
  `src/content-script/main.js` and `src/options/main.js` (enforce on the
  in-memory copy only).
- Make `pruneToSlotBudget()` and the `signedOut`/sign-out paths stop
  routing through `updateSetting(..., false)` storage writes; update UI
  state and the in-memory cache instead. (`disableAllPremiumFeatures()`
  in its current form should have no remaining callers.)
- Never demote on `error`/`offline` license results — only on an
  authoritative "not premium" server response, and even then only in
  effective behavior, not stored values.

Acceptance criteria:

- No auth, refresh, sign-out, or tier-transition path deletes or overwrites
  stored preferences.
- Paid users see no settings change at the 3-day license boundary.
- Transient network failures cause no persistent changes.
- Free-tier slot limits remain enforced in effective behavior and UI
  (direct toggles, chained effects, and import).
- Re-auth or re-upgrade restores previous premium choices without import.

### Phase 2 — proactive license renewal

Refresh the license token in the background (alarm in the background
script, or content-script-triggered renewal when the token is near expiry
— `LICENSE_REFRESH_THRESHOLD_MS` is already 24h), so renewal doesn't depend
on the user opening the options page. While renewal is pending, use the
last-known entitlement rather than demoting.

### Phase 3 — explicit tier states and slot selection (optional hardening)

- Introduce an explicit indeterminate license state (pending / expired-but-
  renewable / offline / transient error) distinct from a confirmed free
  account, so callers can't accidentally collapse them.
- Consider a user-controlled list of selected free-slot feature IDs instead
  of first-two-by-list-order, keeping the premium preference set untouched.
- If warranted, complete the desired-vs-effective settings separation:
  `stored preferences + confirmed entitlement -> effective settings`.

## Tests to add

The suite (currently 168 passing) has no coverage of the combined
token-expiry × settings-persistence lifecycle. Add:

- Expired premium license + valid session ⇒ no `false` writes while renewal
  pending; successful renewal preserves all stored preferences.
- Offline renewal after expiry ⇒ preferences preserved.
- 401 ⇒ auth state removed, preferences preserved.
- Explicit sign-out ⇒ preferences preserved.
- Confirmed free account ⇒ effective two-slot behavior with stored premium
  configuration unchanged.
- Signed-in free user cannot activate a third slot via toggle, chained
  effect, or import.
- Re-upgrade restores the full desired configuration.
