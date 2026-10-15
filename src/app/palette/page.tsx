"use client";

import { useDeferredValue, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLibrary } from "@/context/LibraryContext";
import { ImageMarkerCanvas } from "@/components/ImageMarkerCanvas";
import { PaletteMarkerList } from "@/components/PaletteMarkerList";
import {
  ImageLoadError,
  ImageLoadErrorKind,
  loadImagePixels,
  parseImageUrl,
} from "@/lib/imageSource";
import { buildMarkers, Marker } from "@/lib/markers";
import { analyzeImage, extractPalette, PixelGrid } from "@/lib/palette";
import { computeRecipe } from "@/lib/mix";
import { Recipe } from "@/lib/types";
import {
  DEFAULT_MIN_PERCENT,
  MAX_PERCENT,
  MIN_PERCENT,
  Point,
} from "@/lib/paletteUrl";

interface LoadedImage {
  pixels: PixelGrid;
  /** The image's URL, or null for a pasted image, which can't go in a share link. */
  sourceUrl: string | null;
}

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; error: ImageLoadErrorKind; pasted: boolean };

const MAX_RECIPE_COLORS = 6;

function errorMessage(error: ImageLoadErrorKind, pasted: boolean): string {
  if (error === "blocked") {
    return "This site doesn't allow its images to be read. Right-click the image → Copy Image, then paste it here.";
  }
  return pasted ? "Couldn't read the pasted image." : "Couldn't load an image from that link.";
}

export default function PalettePage() {
  const { colors: library, inStockColors, loaded } = useLibrary();
  const [urlInput, setUrlInput] = useState("");
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [minPercent, setMinPercent] = useState(DEFAULT_MIN_PERCENT);
  const [picked, setPicked] = useState<Point[]>([]);
  // Scanned colors the user removed, as hex without "#".
  const [hidden, setHidden] = useState<string[]>([]);
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
  const loadId = useRef(0);

  const load = async (source: string | Blob) => {
    const id = ++loadId.current;
    const pasted = typeof source !== "string";
    setStatus({ kind: "loading" });
    try {
      const pixels = await loadImagePixels(source);
      // A newer scan started while this one loaded; let it win.
      if (id !== loadId.current) return;
      setImage({
        pixels,
        sourceUrl: typeof source === "string" ? parseImageUrl(source) : null,
      });
      setPicked([]);
      setHidden([]);
      setHighlightedKey(null);
      setStatus({ kind: "idle" });
    } catch (err) {
      if (id !== loadId.current) return;
      setStatus({
        kind: "error",
        error: err instanceof ImageLoadError ? err.kind : "load-failed",
        pasted,
      });
    }
  };

  // Analysis runs once per image; the slider only re-filters its result.
  const analysis = useMemo(() => (image ? analyzeImage(image.pixels) : null), [image]);
  const scanned = useMemo(
    () => (analysis ? extractPalette(analysis, { minShare: minPercent / 100 }) : []),
    [analysis, minPercent]
  );
  const markers = useMemo(
    () => (image ? buildMarkers(scanned, picked, hidden, image.pixels) : []),
    [image, scanned, picked, hidden]
  );

  // Recipes take tens of ms each, so they trail marker changes instead of
  // making the slider stutter.
  const recipeHexes = useDeferredValue(markers.map((m) => m.hex).join(","));
  const recipes = useMemo(() => {
    const byHex = new Map<string, Recipe | null>();
    for (const hex of recipeHexes ? recipeHexes.split(",") : []) {
      if (!byHex.has(hex)) {
        byHex.set(hex, computeRecipe(inStockColors, hex, { maxColors: MAX_RECIPE_COLORS }));
      }
    }
    return byHex;
  }, [recipeHexes, inStockColors]);

  const addMarker = (x: number, y: number) =>
    setPicked((prev) =>
      prev.some((p) => p.x === x && p.y === y) ? prev : [...prev, { x, y }]
    );

  const removeMarker = (marker: Marker) => {
    if (marker.source === "pick") {
      setPicked((prev) => prev.filter((p) => p.x !== marker.x || p.y !== marker.y));
    } else {
      setHidden((prev) => [...prev, marker.hex.slice(1)]);
    }
    setHighlightedKey(null);
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-neutral-900">Image Palette</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Pull the main colors out of an image and get a clay recipe for each.
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load(urlInput);
          }}
          className="flex flex-wrap gap-2"
        >
          <input
            type="text"
            inputMode="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com/image.jpg"
            aria-label="Image URL"
            className="min-w-0 flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400"
          />
          <button
            type="submit"
            disabled={status.kind === "loading" || !urlInput.trim()}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {status.kind === "loading" ? "Scanning…" : "Scan"}
          </button>
        </form>
        {status.kind === "error" && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage(status.error, status.pasted)}
          </p>
        )}
      </div>

      {loaded && library.length === 0 && (
        <div className="mb-6 rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-center">
          <p className="text-sm text-neutral-700">
            Your library is empty, so there are no recipes yet. Add some clay colors first.
          </p>
          <Link
            href="/library"
            className="mt-3 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
          >
            Go to Library
          </Link>
        </div>
      )}

      {image && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="md:sticky md:top-6 md:self-start">
            <ImageMarkerCanvas
              pixels={image.pixels}
              markers={markers}
              highlightedKey={highlightedKey}
              onHover={setHighlightedKey}
              onPick={addMarker}
            />
            <p className="mt-2 text-xs text-neutral-500">
              Click the image to add a marker. On a phone, press and hold.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
              Minimum share: {minPercent}%
              <input
                type="range"
                min={MIN_PERCENT}
                max={MAX_PERCENT}
                step={1}
                value={minPercent}
                onChange={(e) => setMinPercent(Number(e.target.value))}
                className="accent-neutral-900"
              />
            </label>

            {scanned.length === 0 && (
              <p className="rounded-lg border border-dashed border-neutral-300 bg-white p-4 text-sm text-neutral-600">
                No single color covers {minPercent}% of this image — try lowering the slider.
              </p>
            )}

            <PaletteMarkerList
              markers={markers}
              recipes={loaded && library.length > 0 ? recipes : null}
              highlightedKey={highlightedKey}
              onHover={setHighlightedKey}
              onRemove={removeMarker}
            />
          </div>
        </div>
      )}
    </main>
  );
}
