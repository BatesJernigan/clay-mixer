"use client";

import { useEffect, useMemo, useState } from "react";
import { useLibrary } from "@/context/LibraryContext";
import { HexColorField } from "@/components/HexColorField";
import { RecipeResult } from "@/components/RecipeResult";
import { ColorsUsedBar } from "@/components/ColorsUsedBar";
import { computeRecipesByColorCount } from "@/lib/mix";
import { isValidHex, normalizeHex } from "@/lib/color";
import Link from "next/link";

const DEFAULT_HEX = "#c97b5f";
const MAX_RECIPE_COLORS = 6;

interface MixUrlState {
  targetHex: string;
  brands: string[] | null;
}

/** Reads `/mix/<hex>?brands=A,B` from the current location. */
function readMixUrl(): MixUrlState | null {
  const segment = window.location.pathname
    .replace(/^\/mix\/?/, "")
    .replace(/\/$/, "");
  const hex = decodeURIComponent(segment);
  if (!hex || !isValidHex(hex)) return null;

  const params = new URLSearchParams(window.location.search);
  const brands = params.get("brands");

  return {
    targetHex: normalizeHex(hex),
    brands: brands ? brands.split(",").filter(Boolean) : null,
  };
}

function buildMixPath({ targetHex, brands }: MixUrlState): string {
  const path = `/mix/${targetHex.replace("#", "")}`;
  // Built by hand so the brand list stays readable (commas unescaped).
  return brands
    ? `${path}?brands=${brands.map(encodeURIComponent).join(",")}`
    : path;
}

export default function MixerPage() {
  const { colors, inStockColors, loaded } = useLibrary();
  const [targetHex, setTargetHex] = useState(DEFAULT_HEX);
  // null = every brand in the library; otherwise only these brands are used.
  const [selectedBrands, setSelectedBrands] = useState<string[] | null>(null);
  const [targetChosen, setTargetChosen] = useState(false);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied">("idle");

  useEffect(() => {
    // The target lives in the path, which is only readable client-side: every
    // /mix/<hex> URL is served the same prerendered /mix page.
    const fromUrl = readMixUrl();
    if (!fromUrl) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTargetHex(fromUrl.targetHex);
    setSelectedBrands(fromUrl.brands);
    setTargetChosen(true);
  }, []);

  const sharePath = targetChosen
    ? buildMixPath({ targetHex, brands: selectedBrands })
    : null;

  useEffect(() => {
    if (!sharePath) return;
    // Debounced: the native color picker fires continuously while dragging,
    // and browsers throttle rapid history updates.
    const timeout = setTimeout(() => {
      window.history.replaceState(null, "", sharePath);
    }, 300);
    return () => clearTimeout(timeout);
  }, [sharePath]);

  const allBrands = useMemo(
    () => Array.from(new Set(colors.map((c) => c.brand))).sort(),
    [colors]
  );

  const availableColors = useMemo(
    () =>
      selectedBrands
        ? inStockColors.filter((c) => selectedBrands.includes(c.brand))
        : inStockColors,
    [inStockColors, selectedBrands]
  );

  const recipes = useMemo(
    () =>
      // Closest match first; on a tie, the recipe with fewer colors wins.
      computeRecipesByColorCount(availableColors, targetHex, {
        maxColors: MAX_RECIPE_COLORS,
      }).sort(
        (a, b) =>
          a.deltaE - b.deltaE || a.ingredients.length - b.ingredients.length
      ),
    [availableColors, targetHex]
  );
  const closestDeltaE = Math.min(...recipes.map((r) => r.deltaE));

  const toggleBrand = (brand: string) => {
    const current = selectedBrands ?? allBrands;
    const next = current.includes(brand)
      ? current.filter((b) => b !== brand)
      : [...current, brand];
    setSelectedBrands(
      allBrands.every((b) => next.includes(b)) ? null : next.sort()
    );
  };

  const share = async () => {
    if (!sharePath) return;
    const url = new URL(sharePath, window.location.origin).toString();
    if (navigator.share) {
      try {
        await navigator.share({ title: `Clay mix for ${targetHex}`, url });
      } catch {
        // User dismissed the share sheet.
      }
      return;
    }
    await navigator.clipboard.writeText(url);
    setShareStatus("copied");
    setTimeout(() => setShareStatus("idle"), 2000);
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-neutral-900">
          Color Mixer
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Pick a target color and get a recipe made from your clay library.
        </p>
      </div>

      {loaded && colors.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center">
          <p className="text-neutral-700">
            Your library is empty. Add some clay colors first.
          </p>
          <Link
            href="/library"
            className="mt-3 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
          >
            Go to Library
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-5 rounded-lg border border-neutral-200 bg-white p-5">
            <div className="flex flex-wrap items-end gap-6">
              <HexColorField
                value={targetHex}
                onChange={(hex) => {
                  setTargetHex(hex);
                  setTargetChosen(true);
                }}
                label="Target color"
              />

              {sharePath && (
                <button
                  type="button"
                  onClick={share}
                  className="ml-auto rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
                >
                  {shareStatus === "copied" ? "Link copied" : "Share"}
                </button>
              )}
            </div>

            {allBrands.length > 1 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-neutral-700">
                    Brands
                  </span>
                  {selectedBrands && (
                    <button
                      type="button"
                      onClick={() => setSelectedBrands(null)}
                      className="text-xs text-neutral-500 underline hover:text-neutral-800"
                    >
                      Use all
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {allBrands.map((brand) => {
                    const active =
                      !selectedBrands || selectedBrands.includes(brand);
                    return (
                      <button
                        key={brand}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleBrand(brand)}
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
            )}
          </div>

          <ColorsUsedBar recipes={recipes} />

          {recipes.length > 0 ? (
            recipes.map((recipe) => (
              <section key={recipe.ingredients.length}>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-700">
                  {recipe.ingredients.length}{" "}
                  {recipe.ingredients.length === 1 ? "color" : "colors"}
                  {recipes.length > 1 && recipe.deltaE === closestDeltaE && (
                    <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-xs text-white">
                      Closest
                    </span>
                  )}
                </h2>
                <RecipeResult recipe={recipe} targetHex={targetHex} />
              </section>
            ))
          ) : (
            loaded && (
              <p className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-600">
                No colors to mix from. Select a brand or restore an
                out-of-stock color.
              </p>
            )
          )}
        </div>
      )}
    </main>
  );
}
