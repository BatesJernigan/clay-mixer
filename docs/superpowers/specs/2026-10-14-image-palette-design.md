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
- Load an image from a URL, from an image pasted anywhere on the page, or from
  a file chosen with an **Upload image** button or dropped on the page (added
  after v1 review; read in the browser, never uploaded to a server).
- Automatic scan for predominant colors, controlled by a minimum-share slider.
- Lettered markers on the image, plus a marker list with collapsible recipes.
- Click anywhere on the image to add a marker; remove any marker.
- Magnifier loupe on hover (press-and-hold on touch).
- Shareable URL for URL-loaded images.

Out of v1 (but the code must not preclude it):

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

// Run once per image (~60 ms on the reference image): every step below
// except the threshold, none of which depends on the slider.
function analyzeImage(pixels: PixelGrid): ImageAnalysis;

// Cheap, re-run on every slider change: threshold + cap.
function extractPalette(analysis: ImageAnalysis, opts: { minShare: number }): PaletteColor[];
```

`ImageAnalysis` is `{ colors: PaletteColor[] }`: every color the image breaks
down into, largest share first, already located.

### `src/lib/imageSource.ts` — image loading

```ts
function loadImagePixels(source: string | Blob): Promise<PixelGrid>;

class ImageLoadError extends Error {
  kind: "invalid-url" | "load-failed" | "blocked";
}
```

- `string` → `<img crossOrigin="anonymous">`; `Blob` → `URL.createObjectURL`.
- Both decode through the same canvas path into a `PixelGrid`. The page
  draws the image from that grid, so no object URL outlives the load.
- A CORS-less host makes a `crossOrigin` image fail to load outright, so on
  failure the loader retries without `crossOrigin`: if that loads, the image
  exists but is unreadable (`blocked`); otherwise `load-failed`. A
  `SecurityError` from `getImageData` also maps to `blocked`.
- Images are decoded at up to 4096 px on the long side (`MAX_DECODE_SIDE`);
  "image pixel coordinates" everywhere mean coordinates in that decoded grid.
  Hand-placed markers sample it exactly.

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

- Top: image URL field + **Scan** and **Upload image** buttons, with the hint
  "…or paste or drop an image anywhere on this page".
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
| `MAJORITY_PASSES` | 2 | Passes of the 3×3 majority filter that absorbs in-between pixels |
| `MAX_SCANNED_COLORS` | 10 | Cap on scanned markers |

> **Revised during planning (2026-10-14).** The original step 4 dropped a
> cluster when it sat near the Lab line between two bigger clusters *and* was
> scattered. Prototyping on the reference image showed both tests fail on real
> JPEGs: compression noise makes even the solid yellow lettering read as
> scattered (solidity 0.14), and stipple/edge colors sit 9–13 ΔE off any
> blend line in both Lab and sRGB. A 3×3 majority filter on the cluster
> labels does the same job with no geometry: on the reference image it yields
> exactly coral `#ee3a4b`, maroon `#60050a`, yellow-green `#e1e22f` at 3%,
> adding a dark coral and white at 1%.

1. **Prepare.** Downsample to `ANALYSIS_MAX_SIDE`. Skip pixels with alpha < 128.
   Convert to Lab (`rgbToLab` from `color.ts`).
2. **Initial clustering.** k-means in Lab with `INITIAL_CLUSTERS`, seeded
   deterministically (median-cut initialization, fixed iteration cap of 12) so
   identical input always yields identical output.
3. **Merge near-duplicates.** Repeatedly merge the closest pair of clusters
   whose centroids are within `MERGE_DELTA_E` (`deltaE` from `color.ts`),
   recomputing the merged centroid weighted by pixel count.
4. **Absorb in-between pixels.** Run `MAJORITY_PASSES` passes of a 3×3
   majority filter over the cluster labels: each pixel takes the most common
   label in its neighborhood, keeping its own on a tie. Scattered pixels
   (stipple mid-tones, anti-aliased edges, JPEG noise) join the color around
   them; solid regions, including a real in-between color such as an orange
   band between red and yellow, are untouched. Recount cluster sizes after.
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
- Isolated pixels of an in-between color scattered over two solid regions
  yield 2 colors, not 3.
- A solid band of an in-between color is kept.
- Colors below `minShare` are excluded.
- Dot coordinates fall inside the largest patch of their color, scaled to
  original-image coordinates.
- Identical input produces identical output (determinism).

`imageSource.ts`, the canvas, and the loupe are verified manually in the
browser using the reference image URL, a CORS-blocked image URL, and a pasted
image.
