"use client";

import { CSSProperties, PointerEvent, useEffect, useRef, useState } from "react";
import { hexToLab } from "@/lib/color";
import { Marker } from "@/lib/markers";
import { PixelGrid, pixelHex, SPOT_DIAMETER, spotHex } from "@/lib/palette";

/** Pixels across the loupe (the spot a pick averages), and how large each is drawn. */
const LOUPE_PIXELS = SPOT_DIAMETER;
const LOUPE_ZOOM = 12;
const LOUPE_SIZE = LOUPE_PIXELS * LOUPE_ZOOM;
/** Gap between the pointer and the loupe. */
const LOUPE_OFFSET = 24;
/** How long a finger must rest before the loupe appears… */
const HOLD_MS = 300;
/** …and how far it may drift first before the touch counts as a scroll. */
const HOLD_SLOP_PX = 10;

/**
 * Inline rather than Tailwind: dark mode flips the white/black tokens, but a
 * marker needs a white ring and dark shadow on any image in either theme.
 */
export function markerBadgeStyle(hex: string): CSSProperties {
  return {
    backgroundColor: hex,
    color: hexToLab(hex).l > 60 ? "#000000" : "#ffffff",
    border: "2px solid #ffffff",
    boxShadow: "0 0 0 1px rgba(0,0,0,0.6), 0 1px 4px rgba(0,0,0,0.4)",
  };
}

interface Loupe {
  /** Image pixel under the pointer. */
  x: number;
  y: number;
  /** Pointer position within the image box, in CSS pixels. */
  left: number;
  top: number;
  boxWidth: number;
  touch: boolean;
}

interface ImageMarkerCanvasProps {
  pixels: PixelGrid;
  markers: Marker[];
  highlightedKey: string | null;
  onHover: (key: string | null) => void;
  /** Called with image pixel coordinates when the user places a marker. */
  onPick: (x: number, y: number) => void;
}

export function ImageMarkerCanvas({
  pixels,
  markers,
  highlightedKey,
  onHover,
  onPick,
}: ImageMarkerCanvasProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loupeRef = useRef<HTMLCanvasElement>(null);
  const [loupe, setLoupe] = useState<Loupe | null>(null);
  const hold = useRef<{ timer: number; startX: number; startY: number } | null>(null);
  // Mirrors "a touch loupe is showing" for the native touchmove listener.
  const touchLoupe = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = pixels.width;
    canvas.height = pixels.height;
    canvas
      .getContext("2d")!
      .putImageData(
        new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height),
        0,
        0
      );
  }, [pixels]);

  useEffect(() => {
    const canvas = loupeRef.current;
    if (!canvas || !loupe) return;
    const ctx = canvas.getContext("2d")!;
    const half = Math.floor(LOUPE_PIXELS / 2);
    const r2 = (LOUPE_PIXELS / 2) ** 2;
    ctx.clearRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const x = loupe.x + dx;
        const y = loupe.y + dy;
        if (x < 0 || y < 0 || x >= pixels.width || y >= pixels.height) continue;
        if (dx * dx + dy * dy > r2) continue; // outside the averaged spot
        ctx.fillStyle = pixelHex(pixels, x, y);
        ctx.fillRect((dx + half) * LOUPE_ZOOM, (dy + half) * LOUPE_ZOOM, LOUPE_ZOOM, LOUPE_ZOOM);
      }
    }
    // The whole circle is averaged, so mark only where the marker will sit:
    // a small crosshair, legible on light and dark.
    const c = LOUPE_SIZE / 2;
    const arm = LOUPE_ZOOM / 2;
    for (const [width, color] of [[3, "#000000"], [1, "#ffffff"]] as const) {
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(c - arm, c);
      ctx.lineTo(c + arm, c);
      ctx.moveTo(c, c - arm);
      ctx.lineTo(c, c + arm);
      ctx.stroke();
    }
  }, [loupe, pixels]);

  useEffect(() => {
    // Once the touch loupe is up, finger movement steers it instead of
    // scrolling the page. React's touch listeners are passive, so this one
    // is attached natively.
    const box = boxRef.current;
    if (!box) return;
    const block = (e: TouchEvent) => {
      if (touchLoupe.current) e.preventDefault();
    };
    box.addEventListener("touchmove", block, { passive: false });
    return () => box.removeEventListener("touchmove", block);
  }, []);

  useEffect(
    () => () => {
      if (hold.current) clearTimeout(hold.current.timer);
    },
    []
  );

  const locate = (clientX: number, clientY: number, touch: boolean): Loupe => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const left = clientX - rect.left;
    const top = clientY - rect.top;
    return {
      x: Math.min(pixels.width - 1, Math.max(0, Math.floor((left / rect.width) * pixels.width))),
      y: Math.min(pixels.height - 1, Math.max(0, Math.floor((top / rect.height) * pixels.height))),
      left,
      top,
      boxWidth: rect.width,
      touch,
    };
  };

  const cancelHold = () => {
    if (hold.current) clearTimeout(hold.current.timer);
    hold.current = null;
  };

  const endTouchLoupe = () => {
    cancelHold();
    touchLoupe.current = false;
    setLoupe(null);
  };

  const handlePointerDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse") return; // mouse picks on click
    const { clientX, clientY } = e;
    cancelHold();
    hold.current = {
      startX: clientX,
      startY: clientY,
      timer: window.setTimeout(() => {
        touchLoupe.current = true;
        setLoupe(locate(clientX, clientY, true));
      }, HOLD_MS),
    };
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (e.pointerType === "mouse") {
      setLoupe(locate(e.clientX, e.clientY, false));
    } else if (touchLoupe.current) {
      setLoupe(locate(e.clientX, e.clientY, true));
    } else if (
      hold.current &&
      Math.hypot(e.clientX - hold.current.startX, e.clientY - hold.current.startY) > HOLD_SLOP_PX
    ) {
      cancelHold(); // the finger is scrolling, not holding
    }
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (e.pointerType === "mouse") {
      if (e.button !== 0) return;
      const { x, y } = locate(e.clientX, e.clientY, false);
      onPick(x, y);
      return;
    }
    const wasShowing = touchLoupe.current;
    endTouchLoupe();
    if (wasShowing) {
      const { x, y } = locate(e.clientX, e.clientY, true);
      onPick(x, y);
    }
  };

  const loupeLeft = loupe
    ? loupe.touch
      ? Math.min(Math.max(0, loupe.left - LOUPE_SIZE / 2), loupe.boxWidth - LOUPE_SIZE)
      : loupe.left + LOUPE_OFFSET + LOUPE_SIZE <= loupe.boxWidth
        ? loupe.left + LOUPE_OFFSET
        : loupe.left - LOUPE_OFFSET - LOUPE_SIZE
    : 0;
  const loupeTop = loupe
    ? loupe.touch
      ? loupe.top - LOUPE_SIZE - 2 * LOUPE_OFFSET // clear of the finger
      : loupe.top + LOUPE_OFFSET
    : 0;

  return (
    <div
      ref={boxRef}
      className="relative cursor-crosshair select-none"
      style={{ WebkitTouchCallout: "none" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={endTouchLoupe}
      onPointerCancel={endTouchLoupe}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas ref={canvasRef} className="block h-auto w-full rounded-lg" />

      {markers.map((marker) => (
        <button
          key={marker.key}
          type="button"
          aria-label={`Marker ${marker.label}, ${marker.hex}`}
          onPointerEnter={() => onHover(marker.key)}
          onPointerLeave={() => onHover(null)}
          // Clicking a dot shouldn't drop a new marker underneath it.
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          className="absolute flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-transform"
          style={{
            ...markerBadgeStyle(marker.hex),
            left: `${((marker.x + 0.5) / pixels.width) * 100}%`,
            top: `${((marker.y + 0.5) / pixels.height) * 100}%`,
            transform: `translate(-50%, -50%) scale(${marker.key === highlightedKey ? 1.35 : 1})`,
          }}
        >
          {marker.label}
        </button>
      ))}

      {loupe && (
        <div
          className="pointer-events-none absolute z-10 flex flex-col items-center gap-1"
          style={{ left: loupeLeft, top: loupeTop }}
        >
          <canvas
            ref={loupeRef}
            width={LOUPE_SIZE}
            height={LOUPE_SIZE}
            className="rounded-full"
            style={{
              boxShadow:
                "0 0 0 2px #ffffff, 0 0 0 3px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.35)",
            }}
          />
          <span
            className="rounded px-1.5 py-0.5 font-mono text-xs"
            style={{ color: "#ffffff", background: "rgba(0,0,0,0.75)" }}
          >
            {spotHex(pixels, loupe.x, loupe.y) ?? "transparent"}
          </span>
        </div>
      )}
    </div>
  );
}
