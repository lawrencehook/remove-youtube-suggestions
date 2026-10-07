# Releasing RYS

1. Start from clean, up-to-date `main`; choose a version unused on GitHub and both stores.
2. Set the same version in `src/chrome_manifest.json` and `src/firefox_manifest.json`.
3. Commit and push the bump; confirm CI passes and smoke-test affected features in both browsers.
4. Tag the verified commit with release notes and push (replace the example version and notes):

   ```bash
   git tag -a v4.3.83 -m "Release 4.3.83" -m "Added per-channel grayscale exceptions and a setting to hide the YouTube logo."
   git push origin v4.3.83
   ```

5. The [Release workflow](.github/workflows/release.yml) builds both ZIPs and publishes a GitHub release automatically.
6. Confirm the workflow succeeds; verify both ZIPs contain the expected manifest versions and copy the tag notes into the GitHub release description.
7. Download the assets and manually submit them to Chrome Web Store and Firefox Add-ons; confirm publication separately.

Never overwrite a published tag; corrections need a new version.
Release requires matching tag/manifest versions, passing extension/server tests, and valid ZIPs with matching manifests.
Packaging scripts stop on errors; any failed check prevents publication.
