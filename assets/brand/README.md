# Brand assets

The extension uses the MetaStack mark, so it reads as part of the same family as the MetaStack app.

## Source

`src/assets/metastack-mark.svg` is a byte-for-byte copy of the MetaStack mark from the MetaStack app (`metastack-labs/metastack-app` at `4e57401`, `apps/web/public/pre-release/brand/frame/icon.svg`). Don't edit it. If the mark changes upstream, copy the new file over it and run `bun run brand`.

The workspace shows the mark in the current text colour, using the file as a CSS mask (`.brand-mark` in `src/styles/app.css`), the same technique the MetaStack app uses for its logo.

## Rendered assets

`bun run brand` (`scripts/brand-assets.ts`) places the mark's paths, in white, on a tile of the brand ink (`#242824`) and renders:

| File | Size | Used for |
| --- | --- | --- |
| `public/icons/16.png`, `32.png` | 16×16, 32×32 | Toolbar button and tab icon. The tile fills the canvas and every edge of the mark lands on a whole pixel. |
| `public/icons/48.png`, `128.png` | 48×48, 128×128 | Extensions page, install prompt and store icon. Chrome's 16px of transparent padding around 96px of artwork. |
| `store/promo-small.v1.png` | 440×280 | Chrome Web Store small promo tile |
| `store/marquee.v1.png` | 1400×560 | Chrome Web Store marquee (optional) |

The tile keeps the white mark visible on both light and dark browser toolbars. The PNGs are committed, so builds never depend on image tooling and the Firefox source review rebuilds the same files.

`assets.json` records each asset's version and review status. A changed store image gets a new versioned file (`.v2.png`) rather than replacing an approved one.
