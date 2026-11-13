import { PREMO_BRAND } from "./premoColors";
import { ClayColor } from "./types";

/** Brands to mix from; null means every brand in the library. */
export type BrandSelection = string[] | null;

// Brand names that have since been renamed, so saved libraries and old share
// links keep matching the catalog.
export const LEGACY_PREMO_BRAND = "Premo Sculpey";

export function renameBrand(brand: string): string {
  return brand === LEGACY_PREMO_BRAND ? PREMO_BRAND : brand;
}

export function brandsOf(colors: Pick<ClayColor, "brand">[]): string[] {
  return Array.from(new Set(colors.map((c) => c.brand))).sort();
}

/**
 * Fits a selection to the brands the library has: renamed brands are updated,
 * unknown ones dropped, and a selection that ends up empty or covering every
 * brand becomes null. Left alone while the library hasn't loaded, so a share
 * link's brands aren't thrown away before there's anything to check them on.
 */
export function resolveBrands(
  selection: BrandSelection,
  allBrands: string[]
): BrandSelection {
  if (!selection || allBrands.length === 0) return selection;
  const known = [...new Set(selection.map(renameBrand))]
    .filter((b) => allBrands.includes(b))
    .sort();
  return known.length === 0 || known.length === allBrands.length ? null : known;
}

/**
 * Flips one brand on or off. Turning off the last selected brand does
 * nothing: an empty selection has nothing to mix from.
 */
export function toggleBrand(
  selection: BrandSelection,
  brand: string,
  allBrands: string[]
): BrandSelection {
  const current = selection ?? allBrands;
  const next = current.includes(brand)
    ? current.filter((b) => b !== brand)
    : [...current, brand];
  if (next.length === 0) return selection;
  return resolveBrands(next, allBrands);
}

export function filterByBrands<T extends Pick<ClayColor, "brand">>(
  colors: T[],
  selection: BrandSelection
): T[] {
  return selection ? colors.filter((c) => selection.includes(c.brand)) : colors;
}

/** Reads a `brands=A,B` query value (already URL-decoded); null when absent or empty. */
export function parseBrandsParam(value: string | null): BrandSelection {
  const brands = (value ?? "")
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean);
  return brands.length ? brands : null;
}

/** The `brands=` query value, with commas left readable; null for every brand. */
export function formatBrandsParam(selection: BrandSelection): string | null {
  return selection?.length ? selection.map(encodeURIComponent).join(",") : null;
}
