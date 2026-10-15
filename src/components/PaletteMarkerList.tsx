"use client";

import { Marker } from "@/lib/markers";
import { Recipe } from "@/lib/types";
import { ColorSwatch } from "./ColorSwatch";
import { markerBadgeStyle } from "./ImageMarkerCanvas";
import { RecipeResult } from "./RecipeResult";

interface PaletteMarkerListProps {
  markers: Marker[];
  /**
   * Best recipe per marker hex. A missing hex is still being computed; null
   * means there are no in-stock clays. A null map (empty library) hides
   * recipes entirely.
   */
  recipes: Map<string, Recipe | null> | null;
  highlightedKey: string | null;
  onHover: (key: string | null) => void;
  onRemove: (marker: Marker) => void;
}

export function PaletteMarkerList({
  markers,
  recipes,
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

          {recipes && (
            <MarkerRecipe recipe={recipes.get(marker.hex)} targetHex={marker.hex} />
          )}
        </li>
      ))}
    </ul>
  );
}

function MarkerRecipe({
  recipe,
  targetHex,
}: {
  recipe: Recipe | null | undefined;
  targetHex: string;
}) {
  if (recipe === undefined) {
    return <p className="mt-3 text-sm text-neutral-500">Mixing…</p>;
  }
  if (recipe === null) {
    return <p className="mt-3 text-sm text-neutral-500">No in-stock clays to mix from.</p>;
  }
  return (
    <details className="group mt-3">
      <summary className="flex cursor-pointer list-none items-center gap-3 text-sm text-neutral-700">
        <span className="text-neutral-400 transition-transform group-open:rotate-90">▸</span>
        <ColorSwatch hex={recipe.predictedHex} size={20} />
        <span className="min-w-0 flex-1 truncate">
          {recipe.ingredients.map((i) => `${i.parts} ${i.clay.name}`).join(" + ")}
        </span>
        <span className="shrink-0 text-xs text-neutral-500">
          ΔE {recipe.deltaE.toFixed(1)}
        </span>
      </summary>
      <div className="mt-3">
        <RecipeResult recipe={recipe} targetHex={targetHex} />
      </div>
    </details>
  );
}
