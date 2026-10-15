"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useLibrary } from "@/context/LibraryContext";
import { ImageMarkerCanvas } from "@/components/ImageMarkerCanvas";
import { PaletteMarkerList } from "@/components/PaletteMarkerList";
import {
  ImageLoadError,
  ImageLoadErrorKind,
  imageFromClipboard,
  imageFromFiles,
  loadImagePixels,
  parseImageUrl,
} from "@/lib/imageSource";
import { buildMarkers, Marker } from "@/lib/markers";
import { analyzeImage, extractPalette, PixelGrid } from "@/lib/palette";
import { computeRecipe } from "@/lib/mix";
import { Recipe } from "@/lib/types";
import {
  buildPaletteSearch,
  DEFAULT_MIN_PERCENT,
  MAX_PERCENT,
  MIN_PERCENT,
  parsePaletteSearch,
  Point,
} from "@/lib/paletteUrl";

interface LoadedImage {
  pixels: PixelGrid;
  /** The image's URL, or null for a pasted or uploaded file, which can't go in a share link. */
  sourceUrl: string | null;
}

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; error: ImageLoadErrorKind; fromFile: boolean };

/** Marker state restored from a share link. */
interface SavedMarkers {
  minPercent: number;
  picked: Point[];
  hidden: string[];
}

const MAX_RECIPE_COLORS = 6;

function errorMessage(error: ImageLoadErrorKind, fromFile: boolean): string {
  if (error === "blocked") {
    return "This site doesn't allow its images to be read. Right-click the image → Copy Image, then paste it here.";
  }
  return fromFile ? "Couldn't read that image." : "Couldn't load an image from that link.";
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
  const [shareStatus, setShareStatus] = useState<"idle" | "copied">("idle");
  const loadId = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (source: string | Blob, saved?: SavedMarkers) => {
    const id = ++loadId.current;
    const fromFile = typeof source !== "string";
    setStatus({ kind: "loading" });
    try {
      const pixels = await loadImagePixels(source);
      // A newer scan, paste or upload started while this one loaded; let it win.
      if (id !== loadId.current) return;
      setImage({
        pixels,
        sourceUrl: typeof source === "string" ? parseImageUrl(source) : null,
      });
      if (saved) setMinPercent(saved.minPercent);
      setPicked(saved?.picked ?? []);
      setHidden(saved?.hidden ?? []);
      setHighlightedKey(null);
      setStatus({ kind: "idle" });
    } catch (err) {
      if (id !== loadId.current) return;
      setStatus({
        kind: "error",
        error: err instanceof ImageLoadError ? err.kind : "load-failed",
        fromFile,
      });
    }
  }, []);

  useEffect(() => {
    // Share links carry the image and markers in the query string, which is
    // only readable client-side in a static export.
    const saved = parsePaletteSearch(window.location.search);
    if (!saved) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrlInput(saved.img);
    load(saved.img, {
      minPercent: saved.minPercent,
      picked: saved.added,
      hidden: saved.hidden,
    });
  }, [load]);

  /** Loads a pasted, dropped or uploaded file; null means the user gave no image. */
  const loadFile = useCallback(
    (file: File | null) => {
      if (!file) {
        loadId.current++; // cancel any load in flight, as a new one would
        setStatus({ kind: "error", error: "load-failed", fromFile: true });
        return;
      }
      setUrlInput("");
      load(file);
    },
    [load]
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = imageFromClipboard(e.clipboardData);
      if (!file) return; // text pastes, like into the URL field, behave normally
      e.preventDefault();
      loadFile(file);
    };
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes("Files") ?? false;
    // Without this, dropping a file anywhere makes the browser open it in
    // place of the page. Text drags, like into the URL field, are untouched.
    const onDragOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      loadFile(imageFromFiles(e.dataTransfer!.files));
    };
    window.addEventListener("paste", onPaste);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [loadFile]);

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

  const sharePath = image?.sourceUrl
    ? `/palette/${buildPaletteSearch({
        img: image.sourceUrl,
        minPercent,
        added: picked,
        hidden,
      })}`
    : null;
  const hasImage = image !== null;

  useEffect(() => {
    // Until an image loads, leave the URL alone: it may be a share link
    // whose image is still loading (or failed to).
    if (!hasImage) return;
    // Debounced: the slider fires continuously while dragging, and browsers
    // throttle rapid history updates.
    const timeout = setTimeout(() => {
      window.history.replaceState(null, "", sharePath ?? "/palette/");
    }, 300);
    return () => clearTimeout(timeout);
  }, [hasImage, sharePath]);

  const copyLink = async () => {
    if (!sharePath) return;
    const url = new URL(sharePath, window.location.origin).toString();
    await navigator.clipboard.writeText(url);
    setShareStatus("copied");
    setTimeout(() => setShareStatus("idle"), 2000);
  };

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
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-100"
          >
            Upload image
          </button>
          {/* Read in the browser: the file never leaves the device. */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const files = e.target.files;
              if (!files?.length) return; // picker dismissed
              loadFile(imageFromFiles(files));
              e.target.value = ""; // so choosing the same file again still loads it
            }}
          />
        </form>
        <p
          className={`text-xs ${
            status.kind === "error" && status.error === "blocked"
              ? "font-medium text-neutral-900"
              : "text-neutral-500"
          }`}
        >
          …or paste or drop an image anywhere on this page.
        </p>
        {status.kind === "error" && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage(status.error, status.fromFile)}
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
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
            <div className="flex items-end gap-4">
              <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-neutral-700">
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
              {sharePath && (
                <button
                  type="button"
                  onClick={copyLink}
                  className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
                >
                  {shareStatus === "copied" ? "Copied" : "Copy"}
                </button>
              )}
            </div>

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
