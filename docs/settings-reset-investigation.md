# Settings reset: consolidated findings and fix plan

Date: 2026-08-01
Status: **Phase 1 implemented** (PR #223) — the four call-site changes below,
plus regression coverage in
`tests/content-script/settings-persistence.test.js`. This doc remains as the
diagnosis, audit, and decision record; the "Deferred follow-up" sections
(background license renewal, tier states, slot selection) are still pending
and spec'd here for future releases.

Diagnosis was confirmed by two independent investigations (Claude and Codex);
this doc consolidates both and supersedes the docs on branches
`claude/investigate-settings-reset-bug` and
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

## Server and execution-context validation

The complete server and manifest audit confirms that Phase 1 is extension-only:

- `server/src/services/jwt.js` issues 30-day session tokens and regular 3-day
  license tokens (730 days for grandfathered users), matching the client-side
  expiry sequence above.
- `server/src/routes/license.js` returns a new signed license after an
  authenticated entitlement check, `401` comes from session verification, and
  transient failures return non-success responses. The server never receives
  or modifies extension preferences.
- `src/background/events.js` only manages install behavior and the toolbar
  icon. It does not refresh licenses or write settings.
- The Chrome and Firefox manifests load the same settings code paths and run
  the content script in all matching frames. No build step rewrites those
  sources.

Therefore Phase 1 requires no server, manifest, background, Stripe, or database
change.

## Local reproduction (no server needed)

1. Craft an expired JWT payload with `premium: true`; keep any truthy
   `session_token`.
2. Enable six premium settings in a settings object.
3. `License.getTierSync()` → `free_signed_in`;
   `enforceSlotBudget(settings, 2)` → 4 settings returned as `false`
   write-backs. The 2 survivors are chosen by static list order.

## Narrow fix plan

The bug-fix release contains Phase 1 (commit A) only: the mechanical data-loss
fix below. It is sufficient to fix the reported reset, is reviewable and
revertible on its own, and does not add background lifecycle or permission
surface. Background license renewal remains a separately reviewed follow-up;
it improves continuity but is not required to preserve preferences. Keeping
renewal out also keeps the manifests untouched: a manifest/permission change
(even the warning-free `alarms`) can draw extra store-review scrutiny, and the
urgent fix's release should not be coupled to that.

Background renewal is not a substitute for Phase 1: renewal cannot reliably
win the race against the first page load after wake-from-sleep (the content
script runs before any network round-trip completes), the license server's
availability is independent of YouTube's (outages, DNS, or a user's
adblock/privacy list can block `server.lawrencehook.com` while YouTube works —
such a user would otherwise wipe every 3 days), the options page runs offline,
and the sign-out/401 wipe paths have nothing to do with connectivity.

Considered and rejected: gating the destructive writes on an authoritative
server "not premium" response. The apply-time clamp must exist regardless
(free tier and fresh installs have no server confirmation), which makes the
persisted write redundant in every scenario; it would destroy the
preserve-across-re-upgrade property exactly for churned subscribers; and it
keeps the dangerous mechanism alive behind a condition every future caller
must get right. Tier changes affect effective behavior only — stored
preferences are never written by tier logic, unconditionally.

The remaining follow-up sections are explicitly deferred and should not be
bundled into this release.

### Phase 1 (commit A) — stop destroying stored preferences

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
new tier states, server changes, or a generalized desired-vs-effective settings
layer in the Phase 1 patch.

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

Second accepted limitation: when a signed-in free user has more than two
premium preferences stored as `true`, initialization still chooses the first
two by `PREMIUM_FEATURE_IDS` order. Selecting a different feature whose stored
value is already `true` may not emit `storage.onChanged`, so another open
context can remain stale until reload. The two-slot budget remains enforced and
no preference is lost, but stable user-controlled slot selection requires
separate state and is deferred rather than added to this patch.

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

### Deferred follow-up — background license renewal

Refresh the license token through a background-owned scheduled path when the
token is near expiry (`LICENSE_REFRESH_THRESHOLD_MS` is already 24h), so
renewal doesn't depend on the user opening the options page. Avoid direct
content-script refreshes: content scripts run in all frames (both manifests
set `all_frames: true`), which would duplicate requests — and the server's
CORS policy rejects page origins anyway (it allows only extension origins and
localhost, `server/src/index.js:25-41`).

Verified permission posture — no user-visible prompt:

- The `alarms` permission carries no warning string; Chrome and Firefox grant
  it silently on update.
- No `host_permissions` addition is needed: background fetches carry the
  extension origin, which the server's CORS config already allows (the same
  reason the options page can fetch today).

Implementation requirements:

- Add `alarms` to both manifests. Load shared config, auth, and license scripts
  before `background/events.js` in Firefox; import the same dependencies in
  the Chrome service worker in dependency order.
- Register alarm and runtime listeners synchronously. Whenever the background
  context starts, check for the named periodic alarm and create it only when
  absent; do not unconditionally recreate it and postpone its next firing.
  This accounts for alarm persistence not being guaranteed across browser
  restarts, extension updates, and browser implementations.
- On `runtime.onStartup` and the periodic alarm (every few hours), call the
  existing `License.checkLicense()` without forcing refresh. It already skips
  the network when no session exists or the license is valid outside the 24h
  refresh threshold, and stores a successfully refreshed token.
- Deduplicate concurrent background startup/alarm refreshes with one in-flight
  promise. Existing options-page checks execute in a separate context and are
  not covered by that promise. Routing every manual check through background
  messaging would be a larger refactor and is not required for this follow-up;
  occasional overlap with a manual check is acceptable.
- Treat failure outcomes precisely: transient network and non-`401` server
  failures leave existing auth tokens untouched; `401` intentionally invokes
  `Auth.signOut()` and removes auth tokens. Neither outcome may write any
  preference key.
- A bounded last-confirmed-entitlement/grace policy for transiently failed
  renewal stays deferred — with commit A in place, a failed renewal costs
  effective behavior only, never data.

Follow-up acceptance: paid users with a renewable session normally see no
effective settings change at the 3-day license boundary; overlapping
background triggers do not generate multiple renewal requests; and an actual
background renewal succeeds in unpacked Chrome and Firefox without an
additional host permission or CORS failure. Include wake-from-sleep coverage:
an alarm may run late, but the resulting refresh must remain non-destructive.

Optional server-side lever (zero extension change, no release needed):
raising `LICENSE_TOKEN_LIFETIME_DAYS` (currently 3) shrinks boundary
frequency for all users of existing versions immediately. Tradeoff: the
lifetime is also how long a canceled subscription keeps premium working.

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

- Instrument the browser-storage mock to record writes and compare preference
  keys separately from auth, migration, banner, and initialization keys.
- Expired premium license + valid session: content and options initialization
  clamp the effective view to two without changing any stored premium
  preference. A later successful renewal still finds all preferences intact.
- Offline renewal after expiry: effective behavior may be restricted, but the
  stored preference snapshot is unchanged.
- Session `401`: auth keys are removed as expected, while preference keys are
  unchanged and the options cache/UI is disabled in memory.
- Explicit sign-out: use the same preference-snapshot assertion.
- Confirmed signed-in free: direct toggles, chained effects, and import never
  produce more than two effective premium features; importing an over-budget
  configuration preserves the imported raw values.
- Exercise both `pruneToSlotBudget()` and `disableAllPremiumFeatures()` and
  assert that their UI/cache updates produce no preference-key writes.

Do not assert that Phase 1 provides immediate cross-context propagation or a
stable user-selected pair when more than two preferences are stored; those are
the two accepted limitations above. No server test change is required.

Background-renewal follow-up tests (not part of the bug-fix release):

- Background refresh is single-flight when startup and alarm triggers overlap,
  and skips the network entirely when no session token exists or the token
  isn't near expiry. Manual options-page checks are independent.
- A transient network or non-`401` server failure leaves auth tokens and the
  preference snapshot unchanged.
- A `401` removes the three auth keys as expected while leaving the preference
  snapshot unchanged.
- A named alarm is created when absent, retained without rescheduling when
  present, and handled only when its name matches.
- Smoke-test a real background renewal in unpacked Chrome and Firefox,
  including a delayed alarm after wake-from-sleep.

Other deferred-work tests, not part of this release:

- Auth-token-only changes re-derive settings in every already-open
  context without a reload.

## Appendix: storage-write inventory (audit)

Every `browser.storage.local` write/remove in the extension is classified
below. As of Phase 1, the background service worker does not write storage (the
deferred renewal follow-up would add one auth-key write: a refreshed
`license_token` via the existing `License.checkLicense()`, never a preference);
the other extension pages outside this inventory are read-only with respect to
settings.

Destructive — removed by Phase 1:

- `content-script/main.js:133` — slot-budget write-back on page load.
- `options/main.js:33` — slot-budget write-back on options init.
- `options/main.js:403` via `updateSetting(write: true)` from
  `pruneToSlotBudget()` and `disableAllPremiumFeatures()` — switched to
  `{ write: false }`.

System/maintenance writes — unchanged:

- `content-script/main.js:122`, `options/main.js:22` — reveal-setting
  migration; fills missing keys only.
- `content-script/main.js:145` — init defaults; missing keys only.
- `content-script/main.js:736` — content-script `updateSetting`; callers only
  touch free keys (reveal dismiss, `global_enable`, and timed state).
- `options/main.js:671/676` — logging opt-in prompt keys.
- `shared/banners.js:56` — per-banner dismissal key.
- `shared/auth.js:55/109`, `shared/license.js:71` — auth/license token keys
  only; sign-out removes `session_token`, `license_token`, `user_email` and
  never touches settings.
- `shared/https.js:27-28` — legacy donor-auth `user`/`login_token` keys;
  unrelated to current auth or settings.

User-directed writes — unchanged:

- `options/main.js:403` — direct toggles and option effects. An effect that
  requests an over-budget premium `true` can be clamped to `false` and persist
  that value; this requires an explicit user action and is outside the
  intermittent auth/reset bug.
- `settings-menu.js:301` — import; intentionally stores the pasted values
  before applying an in-memory tier clamp.

(Mixpanel's bundled queue uses `window.localStorage`, not extension storage.)
