# Contributing

Thanks for helping improve MetaStack Markdown. Bug reports, ideas and pull requests are all welcome.

## Set up

You need [Bun](https://bun.sh) 1.3 and [Node.js](https://nodejs.org) 24.

```bash
bun install
bun run dev            # Chrome with hot reload
bun run dev:firefox    # Firefox with hot reload
```

`bunfig.toml` refuses package versions published less than 7 days ago, as a supply-chain guard. Please don't work around it.

## Before you open a pull request

```bash
bun run check
```

This runs the typecheck, Biome, the unit tests, both production builds, and `scripts/verify-build.ts`, which checks the built manifests against what the stores and our privacy policy promise. CI runs the same checks, then rebuilds the Firefox add-on from its sources zip to prove reviewers can reproduce it (`bun run zip && bun run verify:sources`).

Add a line under **Unreleased** in [CHANGELOG.md](CHANGELOG.md) for anything a user would notice.

## Ground rules

- **Sanitise before inserting.** Rendered Markdown goes through `sanitizeHtml()` (DOMPurify) before it reaches the page; local files can contain any HTML.
- **Never write to a file the user didn't confirm.** Saving only targets a handle whose contents match what was loaded, and refuses to overwrite a file that changed on disk unless the user chooses to.
- **Keep the pure modules pure.** `src/lib/markdown/*` (except `sanitize.ts` and `enhance.ts`), `src/lib/fs/{paths,gitignore,file-types,eol}.ts`, `src/lib/settings.ts` and `src/lib/handoff.ts` don't touch `window`, `browser` or the DOM, and import siblings with explicit `.ts` extensions so `node --test` can load them.
- **File System Access is optional.** Firefox doesn't have it. Guard with `supportsFileSystemAccess()`.
- **Permissions are a promise.** A new permission, host match or data flow needs [PRIVACY.md](PRIVACY.md), [docs/store-listing.md](docs/store-listing.md) and the allowlist in `scripts/verify-build.ts` updated in the same pull request.
- **No remote code.** Both stores reject extensions that load code from the internet. Bundle dependencies instead.
- **The logo is a brand file.** `src/assets/metastack-mark.svg` is a copy of the MetaStack mark; don't edit it. Icons and store images are rendered from it with `bun run brand` (see [assets/brand](assets/brand/README.md)).

## Reporting security issues

Please don't open a public issue. See [SECURITY.md](SECURITY.md).

## Licence

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
