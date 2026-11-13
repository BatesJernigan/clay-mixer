"use client";

import { useMemo, useState } from "react";
import { useLibrary } from "@/context/LibraryContext";
import {
  BrandSelection,
  brandsOf,
  filterByBrands,
  resolveBrands,
  toggleBrand,
} from "@/lib/brandFilter";
import { ClayColor } from "@/lib/types";

export interface BrandFilterState {
  allBrands: string[];
  /** The selection fitted to the library's brands; null means every brand. */
  selected: BrandSelection;
  /** Replaces the selection, e.g. from a share link. */
  setSelected: (selection: BrandSelection) => void;
  toggle: (brand: string) => void;
  /** In-stock clays of the selected brands: what recipes mix from. */
  availableColors: ClayColor[];
}

/** The page's brand choice, applied on top of the library's in-stock clays. */
export function useBrandFilter(): BrandFilterState {
  const { colors, inStockColors } = useLibrary();
  const [raw, setSelected] = useState<BrandSelection>(null);
  const allBrands = useMemo(() => brandsOf(colors), [colors]);
  const selected = useMemo(() => resolveBrands(raw, allBrands), [raw, allBrands]);
  const availableColors = useMemo(
    () => filterByBrands(inStockColors, selected),
    [inStockColors, selected]
  );
  return {
    allBrands,
    selected,
    setSelected,
    toggle: (brand) => setSelected(toggleBrand(selected, brand, allBrands)),
    availableColors,
  };
}

/** Brand pills; hidden when the library has only one brand. */
export function BrandFilter({ filter }: { filter: BrandFilterState }) {
  const { allBrands, selected, setSelected, toggle } = filter;
  if (allBrands.length < 2) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-neutral-700">Brands</span>
        {selected && (
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="text-xs text-neutral-500 underline hover:text-neutral-800"
          >
            Use all
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {allBrands.map((brand) => {
          const active = !selected || selected.includes(brand);
          return (
            <button
              key={brand}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(brand)}
              className={`rounded-full border px-3 py-1 text-sm ${
                active
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 bg-white text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {brand}
            </button>
          );
        })}
      </div>
    </div>
  );
}
