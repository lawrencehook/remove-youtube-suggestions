# Improving the YouTube ad experience

Status: investigation, September 6, 2026. No blocking approach selected yet.

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
   automatically.
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
