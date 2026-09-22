"use client";

import { useMemo, useState } from "react";
import { useLibrary } from "@/context/LibraryContext";
import { HexColorField } from "@/components/HexColorField";
import { RecipeResult } from "@/components/RecipeResult";
import { computeRecipe } from "@/lib/mix";
import Link from "next/link";

export default function MixerPage() {
  const { colors, loaded } = useLibrary();
  const [targetHex, setTargetHex] = useState("#c97b5f");
  const [maxColors, setMaxColors] = useState(3);

  const recipe = useMemo(() => {
    if (colors.length === 0) return null;
    return computeRecipe(colors, targetHex, { maxColors });
  }, [colors, targetHex, maxColors]);

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
          <div className="rounded-lg border border-neutral-200 bg-white p-5">
            <div className="flex flex-wrap items-end gap-6">
              <HexColorField
                value={targetHex}
                onChange={setTargetHex}
                label="Target color"
              />

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-neutral-700">
                  Max colors in recipe
                </label>
                <select
                  value={maxColors}
                  onChange={(e) => setMaxColors(Number(e.target.value))}
                  className="w-28 rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400"
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      Up to {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {recipe && (
            <RecipeResult recipe={recipe} targetHex={targetHex} />
          )}
        </div>
      )}
    </main>
  );
}
