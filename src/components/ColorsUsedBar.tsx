"use client";

import { useMemo } from "react";
import { useLibrary } from "@/context/LibraryContext";
import { ClayColor, Recipe, clayKey } from "@/lib/types";

/**
 * Every clay the shown recipes call for, plus any the person has marked out
 * of stock. Clicking a chip toggles it out of stock, which drops it from the
 * library recipes are solved against — so the recipes re-solve without it.
 */
export function ColorsUsedBar({ recipes }: { recipes: Recipe[] }) {
  const { colors, outOfStock, toggleOutOfStock, clearOutOfStock } = useLibrary();

  const { used, missing } = useMemo(() => {
    // First-appearance order, so the closest recipe's colors lead.
    const usedByKey = new Map<string, ClayColor>();
    for (const recipe of recipes) {
      for (const { clay } of recipe.ingredients) {
        const key = clayKey(clay);
        if (!usedByKey.has(key)) usedByKey.set(key, clay);
      }
    }
    return {
      used: [...usedByKey.values()],
      missing: colors.filter((c) => outOfStock.has(clayKey(c))),
    };
  }, [recipes, colors, outOfStock]);

  if (used.length === 0 && missing.length === 0) return null;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-neutral-700">
          Colors in these recipes
        </h2>
        <p className="text-xs text-neutral-500">
          Tap a color you don&apos;t have to mix without it.
        </p>
      </div>

      <ul className="mt-3 flex flex-wrap gap-2">
        {used.map((clay) => (
          <li key={clayKey(clay)}>
            <ColorChip clay={clay} inStock onToggle={toggleOutOfStock} />
          </li>
        ))}
      </ul>

      {missing.length > 0 && (
        <div className="mt-4 border-t border-neutral-100 pt-3">
          <div className="flex items-center gap-3">
            <h3 className="text-xs font-medium tracking-wide text-neutral-500 uppercase">
              Out of stock · {missing.length}
            </h3>
            <button
              type="button"
              onClick={clearOutOfStock}
              className="text-xs text-neutral-500 underline hover:text-neutral-800"
            >
              Restore all
            </button>
          </div>
          <ul className="mt-2 flex flex-wrap gap-2">
            {missing.map((clay) => (
              <li key={clayKey(clay)}>
                <ColorChip clay={clay} inStock={false} onToggle={toggleOutOfStock} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ColorChip({
  clay,
  inStock,
  onToggle,
}: {
  clay: ClayColor;
  inStock: boolean;
  onToggle: (clay: ClayColor) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(clay)}
      aria-pressed={!inStock}
      title={`${clay.brand} ${clay.name} · ${
        inStock ? "Mark as out of stock" : "Mark as in stock"
      }`}
      className={`flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm ${
        inStock
          ? "border-neutral-300 bg-white text-neutral-800 hover:border-neutral-500"
          : "border-dashed border-neutral-300 bg-neutral-50 text-neutral-400 line-through hover:text-neutral-700"
      }`}
    >
      <span
        className={`h-5 w-5 shrink-0 rounded-full border border-black/10 ${
          inStock ? "" : "opacity-40"
        }`}
        style={{ backgroundColor: clay.hex }}
      />
      {clay.name}
      <span className="text-xs text-neutral-400 no-underline">
        {clay.brand}
      </span>
    </button>
  );
}
