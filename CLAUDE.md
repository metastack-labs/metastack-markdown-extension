# MetaStack Markdown — agent notes

Browser extension (WXT 0.21, React 19, TypeScript 6, Tailwind 4, Biome, Bun) for viewing and editing local Markdown in Chrome/Edge (MV3) and Firefox (MV2). See README.md for features and architecture, CONTRIBUTING.md for the ground rules, and docs/publishing.md for releases.

## Commands

- `bun run check` — typecheck + lint + unit tests + both builds + `scripts/verify-build.ts`. Run it before declaring work done.
- `bun run zip && bun run verify:sources` — proves the Firefox sources zip rebuilds the add-on byte for byte (what AMO reviewers do). Run it after touching build config, dependencies, or anything outside `src/` that the build reads.
- `bun run test` — `node --test` over `src/**/*.test.ts` (Node 24 type stripping, no test framework).
- `bun run brand` — re-renders `public/icons/*.png` and `assets/brand/store/*.png` from the mark.
- `bun run dev` / `bun run dev:firefox` — hot-reload dev builds.

## Invariants

- **Sanitize before inserting.** Rendered Markdown goes through `sanitizeHtml()` (DOMPurify) before it reaches the DOM. Local files can contain arbitrary HTML.
- **MDX props are data, never code.** `src/lib/markdown/jsx.ts` reads literals only; expressions stay unevaluated source. Components render to HTML in `components.ts` (ported from MetaStack's `guide-blocks.tsx` and the content pipeline's lab components) and pass through the sanitizer; interactivity goes through `data-action` in `MarkdownView`. MV3's CSP and both stores forbid running document- or user-supplied code on extension pages.
- **Pure modules stay pure.** `src/lib/markdown/*` (except `sanitize.ts`, `enhance.ts`), `src/lib/fs/{paths,gitignore,file-types,eol}.ts`, `src/lib/settings.ts` and `src/lib/handoff.ts` must not touch `window`, `browser` or the DOM, and must import siblings with explicit `.ts` extensions so `node --test` can load them.
- **File System Access is optional.** Firefox has none of it. Guard with `supportsFileSystemAccess()`; the typings in `src/types/fs-access.d.ts` are deliberately optional members.
- **Never write to a file you didn't confirm.** `locateInFolder()` only returns a handle whose contents match what was loaded; `writeHandle()` refuses to overwrite a file modified since it was read unless the user chooses Overwrite.
- **Permission prompts need a user gesture.** `requestAccess()` and the pickers must run from a click or key press; don't move them behind long async chains.
- **The `file://` hand-off is a contract.** Message shape and validation live in `src/lib/handoff.ts`; the background only accepts it from our content script on a `file://` page.
- **Permissions are a published promise.** `scripts/verify-build.ts` allowlists `storage` and `file:///*`. Widening either needs PRIVACY.md and docs/store-listing.md updated in the same change.
- **The build must be reproducible from the sources zip.** Tailwind scans only `src/`, minus `*.test.ts` (WXT leaves tests out of the sources zip); both rules are at the top of `app.css`. Keep build inputs inside what the sources zip keeps, and run `verify:sources` after adding files the build reads.
- **The Firefox add-on ID `markdown@metastacklabs.com` is permanent** once published on AMO. Never change it.
- **The logo is a brand file.** `src/assets/metastack-mark.svg` is a verbatim copy of the MetaStack mark; never edit or redraw it. Icons are committed PNGs (no build-time image tooling).
- Supply chain: `bunfig.toml` blocks package versions younger than 7 days. Don't bypass it. GitHub Actions are pinned to commit SHAs.
