# Image Palette — Design

**Date:** 2026-10-14
**Status:** Approved in brainstorming, pending spec review

## Goal

Let a user pull clay-mixable colors out of an image. They give the app an image
(by URL, or by pasting one), the app finds the image's predominant colors, marks
where each one appears with a lettered dot (A, B, C…), and shows a clay recipe
for each color from the user's library.

Reference image used for tuning:
`https://m.media-amazon.com/images/I/81OBhRM2tjL._SL1500_.jpg` — a book cover
with a coral-red background, a stippled dark-maroon illustration, yellow-green
title text and white author text. The stippling produces many red/maroon
in-between pixels that must **not** surface as palette colors.

## Scope

In v1:

- New `/palette` page with a nav entry.
- Load an image from a URL, or from an image pasted anywhere on the page.
- Automatic scan for predominant colors, controlled by a minimum-share slider.
- Lettered markers on the image, plus a marker list with collapsible recipes.
- Click anywhere on the image to add a marker; remove any marker.
- Magnifier loupe on hover (press-and-hold on touch).
- Shareable URL for URL-loaded images.

Out of v1 (but the code must not preclude it):

- A file-upload control. The image loader takes `string | Blob` from day one,
  so an uploader is a UI-only addition later.
- Dragging markers to re-sample.
- A server-side image proxy for sites that block cross-origin pixel reads.

## Constraints

- The app is a static export served as Cloudflare Workers static assets — no
  server routes. All image loading and analysis runs in the browser.
- Reading pixels from a cross-origin image requires the host to send CORS
  headers. Amazon's image CDN sends `access-control-allow-origin: *`; many
  hosts do not. Those cases fail with a specific "blocked" error and steer the
  user to paste instead.
- `/palette` uses query parameters only, so no rewrite is needed in
  `next.config.ts` or `public/_redirects`.

## Architecture

### `src/lib/palette.ts` — pure color extraction

No DOM access; operates on plain pixel arrays so it is unit-testable.

```ts
interface PixelGrid { width: number; height: number; data: Uint8ClampedArray } // RGBA

interface PaletteColor {
  hex: string;   // a real pixel color from the image
  share: number; // 0–1, fraction of opaque pixels
  x: number;     // dot position, in original-image pixel coordinates
  y: number;
}

// Expensive, run once per image: downsample + Lab conversion + k-means.
function analyzeImage(pixels: PixelGrid): ImageAnalysis;

// Cheap, re-run on every slider change: merge, blend-drop, threshold, locate.
function extractPalette(analysis: ImageAnalysis, opts: { minShare: number }): PaletteColor[];
```

`ImageAnalysis` is opaque to callers; it holds the downsampled Lab pixels, the
initial cluster assignment, and the scale factor back to original coordinates.

### `src/lib/imageSource.ts` — image loading

```ts
function loadImagePixels(source: string | Blob): Promise<LoadedImage>;
// LoadedImage = { pixels: PixelGrid (full resolution), objectUrl: string }

class ImageLoadError extends Error {
  kind: "invalid-url" | "load-failed" | "blocked";
}
```

- `string` → `<img crossOrigin="anonymous">`; `Blob` → `URL.createObjectURL`.
- Both decode through the same canvas path into a `PixelGrid`.
- A `SecurityError` from `getImageData` (tainted canvas) maps to `kind: "blocked"`.
- Full-resolution pixels are kept so hand-placed markers sample exact colors.

### `src/components/ImageMarkerCanvas.tsx`

Renders the image with lettered dots and the magnifier loupe; reports clicks
as original-image pixel coordinates via `onPick(x, y)`. Accepts a
`highlighted` letter and reports `onHover(letter | null)` for row/dot linking.
Knows nothing about recipes or the clay library.

**Loupe:** shows a ~11×11-pixel region magnified, with the center pixel
outlined and its hex shown beneath. On mouse it follows the cursor; on touch,
press-and-hold shows it offset above the finger and releasing drops the marker.

### `src/components/PaletteMarkerList.tsx`

One row per marker: letter, swatch, hex, share % (or "picked" for hand-placed
markers), and a remove (×) button. Collapsed, a row shows the best recipe's
summary (clays used + deltaE). Expanded, it shows the full existing
`RecipeResult`. Recipes come from `computeRecipesByColorCount` over the user's
in-stock colors, `maxColors: 6`, sorted closest-first with fewer colors winning
ties — same as `/mix`.

### `src/app/palette/page.tsx`

Owns state: image source, `ImageAnalysis`, `minShare`, hand-placed markers,
hidden scanned hexes, hover highlight. Reads/writes the share URL. Adds a
`{ href: "/palette", label: "Palette" }` entry to `NavBar`.

## Page layout

- Top: image URL field + **Scan** button, with the hint "or paste an image
  anywhere on this page".
- Desktop: two columns — image (sticky) left, marker list right.
- Mobile: stacked — image, then list.
- "Minimum share: N%" slider above the list. Range 1–10%, step 1, default 3%.
  Moving it re-runs only `extractPalette`, so markers update live.
- Lettering: scanned markers first, ordered by share descending; hand-placed
  markers after, in the order added. Letters are reassigned when the scanned
  set changes.
- Hovering a row highlights its dot and vice versa.

## Share URL

```
/palette/?img=<encoded url>&min=3&add=412,880;95,1200&hide=5a0f12
```

- `img`: image URL. Absent for pasted images — the Share button is hidden then.
- `min`: slider percent.
- `add`: hand-placed marker positions in original-image pixels.
- `hide`: hexes of scanned colors the user removed.
- Opening the link re-runs the scan; the scan is deterministic, so the result
  matches. The URL updates via debounced `history.replaceState`, as on `/mix`.

## Color extraction algorithm

All tunables are named constants at the top of `palette.ts`.

| Constant | Initial value | Purpose |
|---|---|---|
| `ANALYSIS_MAX_SIDE` | 200 px | Downsample target for the long side |
| `INITIAL_CLUSTERS` | 16 | k-means k |
| `MERGE_DELTA_E` | 10 | Clusters closer than this merge |
| `BLEND_LINE_DISTANCE` | 8 (Lab units) | Max distance from the A–B segment to count as a blend |
| `BLEND_MAX_SOLIDITY` | 0.5 | Blends must be at most this solid |
| `MAX_SCANNED_COLORS` | 10 | Cap on scanned markers |

1. **Prepare.** Downsample to `ANALYSIS_MAX_SIDE`. Skip pixels with alpha < 128.
   Convert to Lab (`rgbToLab` from `color.ts`).
2. **Initial clustering.** k-means in Lab with `INITIAL_CLUSTERS`, seeded
   deterministically (median-cut initialization, fixed iteration cap of 12) so
   identical input always yields identical output.
3. **Merge near-duplicates.** Repeatedly merge the closest pair of clusters
   whose centroids are within `MERGE_DELTA_E` (`deltaE` from `color.ts`),
   recomputing the merged centroid weighted by pixel count.
4. **Drop blends.** For each cluster C, consider every pair of larger clusters
   A and B. C is a blend if **both**:
   - its centroid lies within `BLEND_LINE_DISTANCE` of segment AB in Lab, with
     projection parameter t in [0.1, 0.9]; and
   - its *solidity* — the fraction of its pixels whose 4 neighbors all belong
     to C — is at most `BLEND_MAX_SOLIDITY`.

   Solid in-between colors (e.g. a real orange band between red and yellow)
   survive; scattered stipple/anti-alias/shadow-edge pixels do not. Blend
   pixels are reassigned to the nearest surviving centroid. Process clusters
   smallest-first; repeat until no cluster is dropped.
5. **Threshold.** Keep clusters with share ≥ `minShare`, largest first, capped
   at `MAX_SCANNED_COLORS`.
6. **Swatch and dot.** For each kept cluster, find its largest 4-connected
   component.
   - Swatch: the real pixel in that component closest (deltaE) to the
     component's median Lab color.
   - Dot: the component pixel with the greatest distance to the component's
     edge (distance transform maximum), scaled back to original coordinates.
7. **Hand-placed markers** sample the exact full-resolution pixel at the click.

Expected result on the reference image at 3%: coral, maroon, yellow-green;
white appears as a fourth when the slider is lowered.

## Error states

All inline; the page never goes blank.

| Situation | Message / behavior |
|---|---|
| Invalid URL, or URL doesn't load an image | "Couldn't load an image from that link." |
| Host blocks pixel reads (`blocked`) | "This site doesn't allow its images to be read. Right-click the image → Copy Image, then paste it here." |
| No color meets the threshold | "No single color covers N% of this image — try lowering the slider." Clicking to add markers still works. |
| Empty clay library | Same "Go to Library" prompt as `/mix`; palette and markers still work, recipe sections are omitted. |

## Testing

Add Vitest (dev dependency + `test` script) to unit-test `palette.ts` with
synthetic `PixelGrid`s:

- Solid color blocks are recovered with correct hexes and shares.
- A stippled two-color pattern next to solid regions of each color yields
  2 colors, not 3.
- A solid band of an in-between color is kept.
- Colors below `minShare` are excluded.
- Dot coordinates fall inside the largest patch of their color, scaled to
  original-image coordinates.
- Identical input produces identical output (determinism).

`imageSource.ts`, the canvas, and the loupe are verified manually in the
browser using the reference image URL, a CORS-blocked image URL, and a pasted
image.
