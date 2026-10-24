"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { BeadChartView } from "@/components/BeadChartView";
import { BeadCountList } from "@/components/BeadCountList";
import {
  BEAD_SOURCE_MAX_SIDE,
  BeadChartOptions,
  buildBeadChart,
  ColorMode,
  MATCH_MAX_COLORS,
  shrinkImage,
} from "@/lib/beadChart";
import {
  ChartSize,
  linkedSize,
  MAX_SIDE,
  MIN_SIDE,
  presetFor,
  SIZE_PRESETS,
  SizePreset,
  sizeForLongSide,
} from "@/lib/beadSize";
import {
  imageFromClipboard,
  imageFromFiles,
  loadImagePixels,
  MAX_UPLOAD_BYTES,
} from "@/lib/imageSource";
import { PixelGrid } from "@/lib/palette";

type ColorChoice = ColorMode["mode"];

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string };

const DEFAULT_MATCH_COUNT = 6;
const MIN_MATCH_COUNT = 2;

const PRESET_LABELS: Record<SizePreset, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
};

const COLOR_LABELS: Record<ColorChoice, string> = {
  bw: "Black / white",
  bgw: "Black / grey / white",
  match: "Match image",
};

function choiceClass(selected: boolean): string {
  return `rounded-md border px-3 py-1.5 text-sm font-medium ${
    selected
      ? "border-neutral-900 bg-neutral-900 text-white"
      : "border-neutral-300 text-neutral-800 hover:bg-neutral-100"
  }`;
}

/** Draws the image itself, small, so the user can see what was loaded. */
function Thumbnail({ pixels }: { pixels: PixelGrid }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = pixels.width;
    canvas.height = pixels.height;
    const data = new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height);
    canvas.getContext("2d")!.putImageData(data, 0, 0);
  }, [pixels]);
  return (
    <canvas
      ref={ref}
      aria-label="Uploaded image"
      className="h-32 w-full rounded-md border border-neutral-200 object-contain"
    />
  );
}

/**
 * A width or height field. Typing goes into a draft, so "1" on the way to
 * "15" isn't clamped to 5 mid-keystroke; in-range values apply live and the
 * rest apply (clamped) on blur or Enter.
 */
function SideField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null) onCommit(Number(draft));
    setDraft(null);
  };
  return (
    <label className="flex items-center gap-1 text-sm text-neutral-700">
      <span className="sr-only">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={MIN_SIDE}
        max={MAX_SIDE}
        value={draft ?? value}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = Number(e.target.value);
          if (Number.isInteger(n) && n >= MIN_SIDE && n <= MAX_SIDE) onCommit(n);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
        className="w-16 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
      />
    </label>
  );
}

export default function BeadsPage() {
  const [image, setImage] = useState<PixelGrid | null>(null);
  // Bumped per loaded image, so the size fields drop any half-typed draft.
  const [imageVersion, setImageVersion] = useState(0);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [size, setSize] = useState<ChartSize>({ width: 25, height: 25 });
  const [colorChoice, setColorChoice] = useState<ColorChoice>("match");
  const [matchCount, setMatchCount] = useState(DEFAULT_MATCH_COUNT);
  const [removeBackground, setRemoveBackground] = useState(true);
  const [outline, setOutline] = useState(true);
  const loadId = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Loads a pasted, dropped or uploaded file; null means the user gave no image. */
  const loadFile = useCallback(async (file: File | null) => {
    const id = ++loadId.current;
    if (!file) {
      setStatus({ kind: "error", message: "Couldn't read that image." });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setStatus({ kind: "error", message: "That image is over 5 MB. Try a smaller one." });
      return;
    }
    setStatus({ kind: "loading" });
    try {
      const pixels = shrinkImage(await loadImagePixels(file), BEAD_SOURCE_MAX_SIDE);
      // A newer paste or upload started while this one loaded; let it win.
      if (id !== loadId.current) return;
      setImage(pixels);
      setImageVersion((v) => v + 1);
      setSize(sizeForLongSide(pixels.width, pixels.height, SIZE_PRESETS.medium));
      setStatus({ kind: "idle" });
    } catch {
      if (id !== loadId.current) return;
      setStatus({ kind: "error", message: "Couldn't read that image." });
    }
  }, []);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = imageFromClipboard(e.clipboardData);
      if (!file) return; // text pastes, like into the size fields, behave normally
      e.preventDefault();
      loadFile(file);
    };
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes("Files") ?? false;
    // Without this, dropping a file anywhere makes the browser open it in
    // place of the page.
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

  const options: BeadChartOptions = useMemo(
    () => ({
      width: size.width,
      height: size.height,
      colors:
        colorChoice === "match" ? { mode: "match", count: matchCount } : { mode: colorChoice },
      removeBackground,
      outline,
    }),
    [size, colorChoice, matchCount, removeBackground, outline]
  );
  // Typing in the size fields stays responsive while a big chart rebuilds.
  const deferredOptions = useDeferredValue(options);
  const chart = useMemo(
    () => (image ? buildBeadChart(image, deferredOptions) : null),
    [image, deferredOptions]
  );
  const noSubject = chart !== null && chart.counts.length === 0;
  const preset = image ? presetFor(image.width, image.height, size) : null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 print:max-w-none print:p-0">
      <div className="mb-8 print:hidden">
        <h1 className="text-2xl font-semibold text-neutral-900">Bead Chart</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Turn an image into a pony bead pattern, with how many beads of each color you need.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] print:block">
        <div className="flex flex-col gap-6 print:hidden">
          <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-5">
            <div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
              >
                {status.kind === "loading" ? "Loading…" : "Upload image"}
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
            </div>
            <p className="text-xs text-neutral-500">
              Up to 5 MB. You can also paste or drop an image anywhere on this page.
            </p>
            {status.kind === "error" && (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {status.message}
              </p>
            )}
            {image && <Thumbnail pixels={image} />}
          </section>

          {image && (
            <section className="flex flex-col gap-5 rounded-lg border border-neutral-200 bg-white p-5">
              <div className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold text-neutral-900">Size</h2>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(SIZE_PRESETS) as SizePreset[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() =>
                        setSize(sizeForLongSide(image.width, image.height, SIZE_PRESETS[p]))
                      }
                      className={choiceClass(preset === p)}
                    >
                      {PRESET_LABELS[p]}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <SideField
                    key={`width-${imageVersion}`}
                    label="Beads across"
                    value={size.width}
                    onCommit={(v) => setSize(linkedSize(image.width, image.height, "width", v))}
                  />
                  ×
                  <SideField
                    key={`height-${imageVersion}`}
                    label="Beads down"
                    value={size.height}
                    onCommit={(v) => setSize(linkedSize(image.width, image.height, "height", v))}
                  />
                  beads
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold text-neutral-900">Colors</h2>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(COLOR_LABELS) as ColorChoice[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColorChoice(c)}
                      className={choiceClass(colorChoice === c)}
                    >
                      {COLOR_LABELS[c]}
                    </button>
                  ))}
                </div>
                {colorChoice === "match" && (
                  <label className="flex items-center gap-3 text-sm text-neutral-700">
                    Up to
                    <input
                      type="range"
                      min={MIN_MATCH_COUNT}
                      max={MATCH_MAX_COLORS}
                      value={matchCount}
                      onChange={(e) => setMatchCount(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="w-16 tabular-nums">{matchCount} colors</span>
                  </label>
                )}
              </div>

              <div className="flex flex-col gap-2 text-sm text-neutral-800">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={removeBackground}
                    onChange={(e) => setRemoveBackground(e.target.checked)}
                  />
                  Remove background
                </label>
                <label
                  className={`flex items-center gap-2 ${removeBackground ? "" : "text-neutral-400"}`}
                >
                  <input
                    type="checkbox"
                    checked={outline}
                    disabled={!removeBackground}
                    onChange={(e) => setOutline(e.target.checked)}
                  />
                  Outline
                </label>
              </div>
            </section>
          )}
        </div>

        {chart && (
          <div className="flex min-w-0 flex-col gap-6">
            {noSubject ? (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                Couldn&apos;t find a subject in this image. Try turning off Remove background.
              </p>
            ) : (
              <>
                {/* Capped in print so the chart and the count list share one page. */}
                <div className="rounded-lg border border-neutral-200 bg-white p-3 print:mx-auto print:w-full print:max-w-[6.5in] print:border-0 print:p-0">
                  <BeadChartView chart={chart} />
                </div>
                <BeadCountList chart={chart} />
                <div className="print:hidden">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-100"
                  >
                    Print chart
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
