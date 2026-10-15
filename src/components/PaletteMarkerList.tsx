"use client";

import { Marker } from "@/lib/markers";
import { ColorSwatch } from "./ColorSwatch";
import { markerBadgeStyle } from "./ImageMarkerCanvas";

interface PaletteMarkerListProps {
  markers: Marker[];
  highlightedKey: string | null;
  onHover: (key: string | null) => void;
  onRemove: (marker: Marker) => void;
}

export function PaletteMarkerList({
  markers,
  highlightedKey,
  onHover,
  onRemove,
}: PaletteMarkerListProps) {
  if (markers.length === 0) return null;

  return (
    <ul className="flex flex-col gap-3">
      {markers.map((marker) => (
        <li
          key={marker.key}
          onPointerEnter={() => onHover(marker.key)}
          onPointerLeave={() => onHover(null)}
          className={`rounded-lg border bg-white p-4 ${
            marker.key === highlightedKey ? "border-neutral-900" : "border-neutral-200"
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={markerBadgeStyle(marker.hex)}
            >
              {marker.label}
            </span>
            <ColorSwatch hex={marker.hex} size={32} />
            <span className="font-mono text-sm text-neutral-900">{marker.hex}</span>
            <span className="text-xs text-neutral-500">
              {marker.share === null ? "picked" : `${Math.round(marker.share * 100)}%`}
            </span>
            <button
              type="button"
              onClick={() => onRemove(marker)}
              aria-label={`Remove marker ${marker.label}`}
              className="ml-auto rounded-md px-2 py-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800"
            >
              ×
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
