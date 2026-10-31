# Publishing

How MetaStack Markdown gets from this repository to GitHub Releases, the Chrome Web Store, Firefox Add-ons (AMO) and Edge Add-ons.

```
bump version ─► tag vX.Y.Z ─► Release workflow ─► draft GitHub release ─► publish it
                                 checks, zips,         3 zips attached
                                 rebuilds Firefox
                                 from sources
                                                       Submit workflow ─► store review
                                                       (manual, per tag)
```

## One-time setup

1. **Repository**
   - Make it public (Settings → General → Danger zone). The store listings link to `PRIVACY.md` on GitHub, which must be readable.
   - Turn on private vulnerability reporting (Settings → Security → Private vulnerability reporting), which [SECURITY.md](../SECURITY.md) relies on.
   - Add a description and topics:
     ```bash
     gh repo edit metastack-labs/metastack-markdown-extension \
       --description "Read, edit and organise local Markdown files in Chrome, Edge and Firefox." \
       --add-topic markdown,browser-extension,chrome-extension,firefox-addon,markdown-editor,wxt
     ```
   - Protect `main` so the CI check must pass before merging.
2. **Store accounts**
   - Chrome Web Store: register a developer account at https://chrome.google.com/webstore/devconsole (a one-time fee, and 2-step verification on the Google account).
   - Firefox: sign in at https://addons.mozilla.org/developers/.
   - Edge (optional): register at https://partner.microsoft.com/dashboard/microsoftedge/.
3. **Screenshots.** Capture them as described in [store-listing.md](store-listing.md#screenshots).

## First release (by hand)

The stores need their listings created by hand once. After that, the Submit workflow can upload updates.

1. Release `0.1.0` as described under [Every release](#every-release), and download its three zips from the GitHub release.
2. **Chrome Web Store:** in the developer console, choose **New item**, upload `metastack-markdown-extension-0.1.0-chrome.zip`, and fill in the listing and privacy tabs from [store-listing.md](store-listing.md). Submit for review. Note the item ID it gets.
3. **Firefox Add-ons:** choose **Submit a New Add-on**, **On this site**, upload `…-firefox.zip`, answer **Yes** to the source code question and upload `…-sources.zip`. Fill in the listing from [store-listing.md](store-listing.md). The add-on ID is fixed by the manifest: `markdown@metastacklabs.com`.
4. **Edge Add-ons (optional):** upload the Chrome zip and reuse the Chrome listing.
5. Once the listings are live, add the store links to the README's install section.

## Every release

1. Pick the version (Semantic Versioning) and set it in `package.json`. The manifest version comes from there.
2. In [CHANGELOG.md](../CHANGELOG.md), rename **Unreleased** to `[X.Y.Z] - YYYY-MM-DD` and start a new empty **Unreleased** section.
3. If permissions or data handling changed, update [PRIVACY.md](../PRIVACY.md) (and its date) and [store-listing.md](store-listing.md). The store dashboards need the same answers.
4. Check locally:
   ```bash
   bun run check
   bun run zip
   bun run verify:sources
   ```
5. Commit, then tag and push:
   ```bash
   git tag vX.Y.Z
   git push origin main vX.Y.Z
   ```
6. The **Release** workflow checks the tag matches `package.json`, runs every check, rebuilds the Firefox add-on from its sources zip, and creates a **draft** GitHub release with the Chrome, Firefox and sources zips and the changelog section as notes. Review it and publish it.
7. Submit to the stores: run the **Submit to stores** workflow (Actions → Submit to stores → Run workflow) with the tag, first with **Dry run** ticked to check the credentials, then without. Or upload the zips by hand as in the first release.

The builds are reproducible, so the Submit workflow rebuilds from the tag and produces the same zips as the GitHub release.

## Store credentials for the Submit workflow

Create a GitHub environment named `stores` (Settings → Environments) and add these secrets to it. Adding required reviewers to the environment makes every submission wait for approval.

| Secret | Where it comes from |
| --- | --- |
| `CHROME_EXTENSION_ID` | The item ID in the Chrome Web Store developer console |
| `CHROME_PUBLISHER_ID` | Your publisher ID, shown in the Chrome Web Store developer console |
| `CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL` | A Google Cloud service account allowed to use the Chrome Web Store API |
| `CHROME_SERVICE_ACCOUNT_PRIVATE_KEY` | That service account's private key |
| `FIREFOX_JWT_ISSUER` | AMO → Tools → Manage API keys (JWT issuer) |
| `FIREFOX_JWT_SECRET` | AMO → Tools → Manage API keys (JWT secret) |

The workflow uses version 2 of the Chrome Web Store API, which authenticates with a service account. The [publish-browser-extension docs](https://github.com/aklinker1/publish-browser-extension) explain how to create one. To try credentials locally, run `bunx wxt submit init`, which writes them to `.env.submit` (ignored by git), then `bunx wxt submit --dry-run …`.

## Things reviewers ask about

- **`file:///*` access.** A content script runs only on local files, to open Markdown in the workspace. Chrome and Edge also require the user to turn on **Allow access to file URLs**.
- **Linter warnings (Firefox).** `web-ext lint` reports 0 errors and warnings about `innerHTML`/`eval` in bundled libraries, plus one about Firefox for Android 140, which the add-on doesn't target. [SOURCE_CODE_REVIEW.md](../SOURCE_CODE_REVIEW.md) explains both.
- **Remote code.** None: Mermaid, KaTeX and their fonts are bundled. `scripts/verify-build.ts` fails the build if an extension page loads a remote script or stylesheet.
