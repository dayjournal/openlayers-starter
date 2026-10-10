# Tile fixtures

`tiles/{z}/{x}/{y}.png` contains map tiles for the default Tokyo view at zoom 11.
The tests serve these files locally so screenshots do not depend on the network.
Requests without a saved tile use `fallback.png`.

Every request is validated before the fixture response: `{z}/{x}/{y}` must be
non-negative safe integers, with `x < 2 ** z` and `y < 2 ** z` for Web Mercator.
Both smoke and visual tests observe the actual `Image` objects created by the
app, including images outside the DOM. Every requested tile image must finish
loading with nonzero width and be passed to the map canvas's `drawImage` at full
opacity. Image errors are also checked at teardown.

Playwright installs these observers before the app starts, forwarding calls to
the native `Image` constructor and `drawImage` method. The observers and their
types live entirely in `e2e/_helpers.ts`; the app needs no test-specific code.
This check targets the current fixed view and Canvas 2D tile renderer. Revisit
it when adding preloading, view changes, or a different renderer. The visual
test compares the resulting pixels with the existing baseline.

## Update map tiles

When the map center, zoom, or viewport changes:

1. Temporarily add `console.log(url)` after the tile URL is read in
   `stabilizeTileRequests` in `e2e/_helpers.ts`.
2. Run `pnpm run test:visual:update` to list the requested tile URLs.
3. Download each tile to the matching path and remove the temporary log. For
   example:

```sh
mkdir -p e2e/fixtures/tiles/11/1816
curl -fL 'https://tile.mierune.co.jp/mierune_mono/11/1816/805.png' \
  -o e2e/fixtures/tiles/11/1816/805.png
```

Run the visual tests again and check the screenshots after updating the tiles.

## Create the fallback tile

`fallback.png` is a 256×256 PNG with a `#eeeeee` background, 1 px `#e0e0e0`
grid lines every 64 px, and a 1 px `#c8c8c8` border along the top and left edges.
To recreate it with ImageMagick, run this from the repository root:

```sh
magick -size 256x256 xc:'#eeeeee' -fill '#e0e0e0' \
  -draw 'line 64,0 64,255 line 128,0 128,255 line 192,0 192,255 line 0,64 255,64 line 0,128 255,128 line 0,192 255,192' \
  -fill '#c8c8c8' -draw 'line 0,0 255,0 line 0,0 0,255' \
  e2e/fixtures/fallback.png
```
