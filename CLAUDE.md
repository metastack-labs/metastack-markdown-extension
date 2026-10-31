# MetaStack Markdown — agent notes

Browser extension (WXT 0.21, React 19, TypeScript 6, Tailwind 4, Biome, Bun) for viewing and editing local Markdown in Chrome/Edge (MV3) and Firefox (MV2). See README.md for features and architecture.

## Commands

- `bun run check` — typecheck + lint + unit tests + both builds. Run it before declaring work done.
- `bun run test` — `node --test` over `src/**/*.test.ts` (Node 24 type stripping, no test framework).
- `bun run dev` / `bun run dev:firefox` — hot-reload dev builds.

## Invariants

- **Sanitize before inserting.** Rendered Markdown goes through `sanitizeHtml()` (DOMPurify) before it reaches the DOM. Local files can contain arbitrary HTML.
- **Pure modules stay pure.** `src/lib/markdown/*` (except `sanitize.ts`, `enhance.ts`), `src/lib/fs/{paths,gitignore,file-types}.ts`, `src/lib/settings.ts` and `src/lib/handoff.ts` must not touch `window`, `browser` or the DOM, and must import siblings with explicit `.ts` extensions so `node --test` can load them.
- **File System Access is optional.** Firefox has none of it. Guard with `supportsFileSystemAccess()`; the typings in `src/types/fs-access.d.ts` are deliberately optional members.
- **Never write to a file you didn't confirm.** `locateInFolder()` only returns a handle whose contents match what was loaded; `writeHandle()` refuses to overwrite a file modified since it was read unless the user chooses Overwrite.
- **Permission prompts need a user gesture.** `requestAccess()` and the pickers must run from a click or key press; don't move them behind long async chains.
- **The `file://` hand-off is a contract.** Message shape and validation live in `src/lib/handoff.ts`; the background only accepts it from our content script on a `file://` page.
- Supply chain: `bunfig.toml` blocks package versions younger than 7 days. Don't bypass it.
