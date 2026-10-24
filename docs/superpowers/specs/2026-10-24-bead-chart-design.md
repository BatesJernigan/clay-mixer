# Bead Chart — Design

**Date:** 2026-10-24
**Status:** Approved in brainstorming, pending spec review

## Goal

Turn any image into a pony bead chart. The user uploads an image, and the app
produces a square grid where each cell is one pony bead with its color, plus a
count of how many beads of each color they need. The user follows the chart
to build the piece.

The chart is a **bold simplification**, not a faithful pixelation. Pony beads
are big, so detail doesn't survive at 15–40 beads across. Think "low-poly":
flat areas of color, no specks, and a clear outline around the subject.

## Goals

- Upload an image (up to 5 MB) and get a bead chart for it.
- Adjustable chart size, with Small / Medium / Large presets.
- Configurable colors: Black / white, Black / grey / white, or "Match image"
  with a chosen number of colors.
- Every color in the chart is a real pony bead color the user can buy.
- The background is left empty; only the subject gets beads.
- A "beads needed" list: each bead color, its count, and the total.
- Printable, and usable on a phone.

## Non-goals (v1)

- Saving charts, a share link, or a chart library.
- Hand-editing individual beads on the chart.
- Other bead types (perler/fuse beads, seed beads) or brick-stitch/offset
  layouts. The grid is a plain square grid.
- Cutting a subject out of a busy, cluttered background (no ML segmentation,
  no tap/trace-to-select). Background removal is for plain or simple
  backgrounds; on busy photos it may leave the background as beads, and the
  user can turn removal off or choose a simpler photo. The user confirmed
  this is fine.
- Loading an image by URL. The user asked for upload; paste and drop come
  free from the existing loader and are fine to include.

## Anti-goals

- A chart that looks like a noisy photo: scattered single beads of odd colors,
  muddy in-between shades. That technically "works" but is useless to bead.
- Colors that don't exist as real pony beads.
- Beads spent filling in a background the user didn't want.

## Decided by the user

- **Chart style:** color only, no letters/symbols on the beads. Each cell
  draws as a circle in the bead's color (mockup option A).
- **Sizes:** adjustable, with Small, Medium and Large presets.
- **Colors:** black/white, black/grey/white, or match the image with a chosen
  number of colors; drawn from real pony beads of the easiest brand to get.
- **Simplify to bold shapes** rather than keeping detail.
- **Leave the background empty.**

## Constraints

- Same as `/palette`: the app is a static export on Cloudflare Workers static
  assets. No server routes. Everything runs in the browser.
- New route `/beads/` uses no path parameters, so no rewrite is needed in
  `next.config.ts` or `public/_redirects`.
- This Next.js version differs from training data; read
  `node_modules/next/dist/docs/` before writing page code (see `AGENTS.md`).

## Calls made by Claude (user can override)

These weren't discussed in detail; they're my calls.

1. **Bead brand: Creatology 6×9 mm opaque pony beads**, Michaels' own line
   (https://www.michaels.com/product/opaque-pony-beads-by-creatology-6mm-x-9mm-10054284),
   also resold on Walmart and Amazon. It replaced Darice on Michaels' shelves,
   so it is the easiest brand to buy in person. No official hex values exist,
   so the catalog (`src/lib/ponyBeadColors.ts`) lists the colors sold on that
   product page with hand-picked approximate hexes, documented like
   `premoColors.ts`, with per-color Michaels links where available. It must
   include black, white and a grey. Transparent, glitter and neon beads are
   left out.
2. **Preset sizes** set the chart's long side: Small 15, Medium 25 (default),
   Large 40 beads. The short side follows the image's aspect ratio.
3. **Custom size:** width × height fields, linked to the image's aspect ratio
   (editing one updates the other). Range 5–100 per side.
4. **"Match image" color count:** slider or stepper, 2–12, default 6.
5. **Background detection is automatic**, with a "Remove background" toggle
   (default on) so the user can turn it off when detection gets it wrong.
   Transparent pixels in PNGs are always background.
6. **Outline:** an "Outline" toggle (default on). When on, subject cells
   touching the background become the darkest color already in the chart's
   palette (black in both presets). The outline never adds a color beyond the
   chosen count. Only the subject's silhouette is outlined, not borders
   between colors inside it.
7. **Row/column numbers** every 5 beads along the chart's edges, so the user
   can keep their place. Faint, and printed too.
8. **Empty cells** draw as a faint dotted circle (or nothing) so the grid
   shape is still visible.
9. No buy links in v1. The catalog's `url` field may be filled where a stable
   product page exists, like the clay catalogs.

## Page layout

New page `src/app/beads/page.tsx`, plus a `{ href: "/beads", label: "Beads" }`
entry in `NavBar`.

Mobile-first, stacked; side-by-side on wide screens:

1. **Upload area:** "Upload image" button, plus drop and paste anywhere on the
   page (reuse `imageFromFiles`, `imageFromClipboard`, `loadImagePixels` from
   `src/lib/imageSource.ts`). Small thumbnail of the uploaded image.
2. **Settings:**
   - Size: Small / Medium / Large buttons, and the custom width × height
     fields showing the current size.
   - Colors: Black / white, Black / grey / white, Match image (with the color
     count control).
   - Toggles: Remove background, Outline.
   - Every change re-renders the chart live; no "generate" button.
3. **Chart:** the bead grid, scaled to fit the screen width; the page must not
   scroll sideways. Zooming into large grids on a phone uses the browser's own
   pinch-zoom; no built-in zoom/pan control (my call).
4. **Beads needed:** swatch, bead name, count per color, sorted by count; then
   the total.
5. **Print** button: prints only the chart and the beads-needed list, sized to
   one page.

## Conversion pipeline

Lives in a pure module, `src/lib/beadChart.ts`, operating on the existing
`PixelGrid` type so it can be unit-tested without a DOM, like `palette.ts`.

```ts
interface BeadColor { name: string; hex: string; url?: string }

interface BeadChartOptions {
  width: number;   // beads across
  height: number;  // beads down
  colors: { mode: "bw" } | { mode: "bgw" } | { mode: "match"; count: number };
  removeBackground: boolean;
  outline: boolean;
}

interface BeadChart {
  width: number;
  height: number;
  /** Row-major, one entry per cell: index into `palette`, or -1 for empty. */
  cells: Int16Array;
  palette: BeadColor[];
  counts: number[]; // parallel to palette
}

function buildBeadChart(pixels: PixelGrid, opts: BeadChartOptions): BeadChart;
```

If some steps are slow, split into a run-once analysis plus a cheap per-change
step, as `palette.ts` does. Settings changes should feel instant on a phone.

Steps, in order. The method inside each step is left to the builder; the
outcome is what matters.

1. **Reduce to the grid.** Average each cell's block of image pixels (area
   averaging, ignoring transparent pixels). Smoothing before or during this
   step is fine and encouraged, since the goal is flat color.
2. **Find the background.** Cells whose color matches the image border and
   connect to it (flood fill from the edges with a color tolerance) are
   background. Fully or mostly transparent cells are background. Skipped when
   "Remove background" is off.
3. **Pick bead colors** for the subject cells only.
   - Black/white and Black/grey/white use those exact catalog beads, mapped by
     lightness so a color photo still reads well.
   - Match image picks up to `count` distinct catalog beads that best
     represent the subject (e.g. cluster the cells' colors, snap each cluster
     to its nearest unused catalog bead in Lab with `deltaE` from `color.ts`).
     It may return fewer if the subject has fewer distinct colors.
4. **Assign** each subject cell its nearest chosen bead.
5. **Clean up specks.** Merge isolated cells and tiny islands into the color
   around them (the 3×3 majority filter in `palette.ts` is a good starting
   point). This is what makes the result bold rather than noisy.
6. **Outline**, if on (call 6 above).
7. **Count** beads per color.

All tunables (smoothing, background tolerance, speck size) are named constants
at the top of the module, as in `palette.ts`.

## Error states

All inline; the page never goes blank.

| Situation | Message / behavior |
|---|---|
| File over 5 MB | "That image is over 5 MB. Try a smaller one." Checked before decoding. |
| Not an image / fails to decode | "Couldn't read that image." |
| Background removal leaves no subject | "Couldn't find a subject in this image. Try turning off Remove background." |

## Testing

Vitest unit tests for `beadChart.ts` with synthetic `PixelGrid`s:

- A solid shape on a plain background: background cells are empty (-1),
  shape cells are beads; with removal off, every cell is a bead.
- Transparent pixels become empty cells.
- Black/white mode uses only black and white catalog beads.
- Match mode never returns more colors than `count`, and every color is in the
  catalog.
- A single stray cell of another color inside a solid region is absorbed.
- Outline on: subject cells touching the background are the darkest color.
- Counts add up to the number of non-empty cells.
- Deterministic: identical input gives identical output.

Page, upload and printing are checked by hand in the browser, including on a
phone-width viewport, with a pet or person photo on a plain background (the
background should come out empty), a busy-background photo (only checking it
still produces a usable chart with removal off), a simple logo, and a
transparent PNG.
