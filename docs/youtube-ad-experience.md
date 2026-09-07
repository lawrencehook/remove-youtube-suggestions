# Improving the YouTube ad experience

Status: investigation, reviewed September 7, 2026. No blocking approach selected yet.

## Goal and context

Reduce ad interruptions, ideally eliminate them, without breaking playback.
[Issue #207](https://github.com/lawrencehook/remove-youtube-suggestions/issues/207)
reports that fast-forwarding ads to completion triggers YouTube's ad-blocker
warning, while manually clicking Skip before completion does not. This is the
reporter's observation; we have not independently reproduced the warning.

RYS 4.3.83 already clicks visible Skip buttons. Until a button appears, it
mutes detected ads and plays them at 10× speed. Muting and waiting for Skip is
a possible improvement, but would still leave users waiting through ads.

This branch's existing commit (`1a219fc`) instead seeks to the video's duration
when `#movie_player.ad-showing` is present, with a 10× fallback and faster
polling. Treat this as an unvalidated candidate, not a fix for #207. In
particular, its assumption that `ad-showing` guarantees an ad-only timeline
needs verification before seeking to the end is considered safe.

The automated dismissal of related [issue #114](https://github.com/lawrencehook/remove-youtube-suggestions/issues/114)
claimed RYS only changes UI. That is inconsistent with this setting's playback
manipulation; the dismissal is not evidence that RYS cannot cause the warning.

## Research findings

- [uBlock's YouTube filters](https://github.com/uBlockOrigin/uAssets/blob/master/filters/filters.txt)
  remove or rewrite player ad metadata such as `adPlacements`, `adSlots`, and
  `playerAds`. Its [scriptlets](https://github.com/gorhill/uBlock/blob/master/src/js/resources/json-prune.js)
  intercept JSON parsing and responses; this goes beyond hiding or skipping ads.
- [Quick-fix rules](https://github.com/uBlockOrigin/uAssets/blob/master/filters/quick-fixes.txt)
  also address detection and playback failures, and sometimes seek based on
  internal player state. Copying the seek alone does not reproduce that system.
- [uBO Lite](https://github.com/uBlockOrigin/uBOL-home) demonstrates an MV3
  blocking architecture. Chrome's [network API](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)
  supports blocking, redirects, and header changes, not arbitrary response-body
  rewriting. A RYS prototype would likely need early page-context interception.
- [Zen's May 2025 write-up](https://github.com/irbis-sh/zen-desktop/discussions/341)
  describes filtering initial player data and subsequent API responses through
  a local proxy. Its architecture is not directly portable to RYS, and its
  detection-free claim has not been verified here.
- [AdGuard's analysis](https://adguard.com/en/blog/youtube-server-side-ad-insertion.html)
  explains why ads inserted into the video stream need different handling from
  separate ad requests. Do not assume every ad can be blocked or safely sought.

These are source/documentation findings, not measured effectiveness in RYS.
Upstream rules change; record the revisions used when prototyping.

## Next steps

1. Bring this branch up to date with `main` before implementation; it predates
   recent releases. Reassess the existing seek changes rather than shipping them
   automatically. Set a bounded prototype scope and maintenance expectations
   up front; a prototype does not commit us to shipping or supporting blocking.
2. Establish baselines: RYS disabled, current RYS skipping, mute-and-Skip, and a
   maintained blocker alone. Record browser/version, login state, ad exposure,
   startup delay, warnings, and playback failures. Test coexistence separately.
3. Prototype YouTube-only player-data filtering behind an experimental toggle,
   covering both direct page loads and YouTube's navigation between videos.
   Keep the change isolated and verify browser permissions and injection timing.
4. Compare against mute-and-Skip across Chrome/Firefox, signed-in/out sessions,
   pre-rolls, mid-rolls, playlists, live videos, and any observed stitched ads.
   Check that mute, speed, and playback position remain correct afterward.
5. Save deterministic regression cases in `rys-test`; use live sessions to
   measure actual ad removal and detection. An absence of ads in one session
   is not sufficient evidence that blocking worked.
6. Select an approach based on reduced ad time and playback reliability, then
   assess maintenance effort. Review upstream licensing before reusing code.

Recommendation: investigate actual blocking, with mute-and-Skip as a comparison
and possible fallback. No guarantee of universal or permanent ad removal; no
decision yet to ship this branch or close the reported issues.

## Review notes (September 7, 2026)

- The #207 report, taken at face value, argues *against* commit `1a219fc`.
  The reporter says the warning fires when an ad plays to completion and not
  when Skip is clicked first. Seeking to the end could reproduce the problem,
  but the actual events, completion requests, and detection trigger are not
  established. Do not ship the seek path without testing this specific claim.
- Mute-and-Skip is a strict subset of what 4.3.83 already ships: the existing
  Skip-button click and mute, with the 10× branch deleted. It cannot be less
  safe than current behavior, and it removes the one action the #207 reporter
  identifies as the trigger. Whether it is undetectable is unknowable, but that
  is also true of the shipped code. Recommended as step 0, shippable on its
  own, with blocking as a separate track. Ad detection and mute restoration
  are unchanged and keep their existing weaknesses (see reassessment items).
  Unskippable ads would play at normal length, muted.
- Blocking introduces ongoing filter maintenance and playback-regression risk.
  Evaluate that throughout the experiment, then decide on support and accurate
  store messaging before shipping. The incorrect #114 closure should not
  constrain the investigation; current store wording has not been verified.
  If the answer to "will we maintain YouTube filters indefinitely" is already
  no, skip step 3 and stop at mute-and-Skip; the prototype has no other payoff.
- For page-context interception on the already-granted `www.youtube.com` and
  `m.youtube.com` hosts, Chrome can use a separate `document_start` script with
  `world: "MAIN"`. [Firefox 128 also added manifest-level MAIN-world support](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/128);
  MV2 alone does not require a different path. Neither manifest currently
  declares a minimum browser version, so using `world: "MAIN"` means adding
  `strict_min_version: "128.0"` under `browser_specific_settings.gecko` and a
  matching Chrome floor (`minimum_chrome_version`, MAIN world since Chrome 111).
  Keep extension storage/auth code isolated: [MAIN-world scripts lack extension APIs and are visible to page code](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_scripts).
- Network filtering needs a DNR API permission, but not necessarily a new user
  warning: [Chrome documents `declarativeNetRequestWithHostAccess`](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#permissions)
  for existing host grants without additional warnings. Rules targeting other
  hosts may need broader access. Verify the exact rules and upgrade behavior.
- Concrete reassessment items for the existing commit, from code review:
  - `ad-showing` is not verified to be absent during stitched ads. If it is
    present on a shared timeline, seeking to duration can skip the main content.
    A duration cap before seeking (say, under a few minutes, else fall through)
    bounds the damage to short videos but is not a guarantee: short videos fit
    under it, and the 10× fallback can accelerate content when detection is
    wrong. A cheap stronger signal: on client-side ads `video.duration` changes
    when the ad ends, on stitched ads it does not. Only the first ad of a
    session is blind to this.
  - Test whether ad-class and video-source transitions can expose stale state.
    The proposed race has not been reproduced; faster polling does not prove
    that the selected video is an ad. Avoid seeking when identity is uncertain.
  - `adActive` is not updated on the Skip-button branch, so the 50ms poll rate
    is driven by stale state.
  - Pre-existing: `handleNewPage` clears `hyper` without restoring playback, so
    navigating mid-ad can leave playback modified if YouTube reuses the element
    without resetting it. Also test disabling the setting or global power
    mid-ad: restoration currently lives inside the enabled skipping path.
  - Restore captured pre-ad state on the correct video element, rather than
    relying solely on YouTube's internal session-storage format. Cover source
    replacement, user mute/speed changes, and missing storage data. The unit
    harness has no DOM, so these are `rys-test` Playwright cases, not `node
    --test` cases.
- Baselines (step 2) will be noisy. Ad exposure depends on account, history,
  region, and time of day. Use a fresh signed-out profile for comparability,
  run each arm across many videos, and report ranges rather than single counts.
  Keep signed-in results separate and alternate test order to reduce bias;
  a fresh profile is a baseline, not control over YouTube's ad experiments.
