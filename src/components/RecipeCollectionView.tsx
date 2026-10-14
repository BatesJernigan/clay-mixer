"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLibrary } from "@/context/LibraryContext";
import { RecipeResult } from "@/components/RecipeResult";
import { computeRecipe } from "@/lib/mix";
import { complementaryHex } from "@/lib/color";
import { PresetCollection } from "@/lib/presetMixes";

export function RecipeCollectionView({
  collection,
}: {
  collection: PresetCollection;
}) {
  const { colors, inStockColors, loaded } = useLibrary();

  const recipes = useMemo(() => {
    if (inStockColors.length === 0) return [];
    return collection.mixes.map((mix) => {
      const complementHex = complementaryHex(mix.targetHex);
      return {
        mix,
        recipe: computeRecipe(inStockColors, mix.targetHex, { maxColors: 3 }),
        complementHex,
        complementRecipe: computeRecipe(inStockColors, complementHex, {
          maxColors: 3,
        }),
      };
    });
  }, [inStockColors, collection]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <Link
          href="/recipes"
          className="text-sm font-medium text-neutral-500 hover:text-neutral-800"
        >
          &larr; All collections
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-900">
          {collection.title}
        </h1>
        <p className="mt-1 text-sm text-neutral-600">{collection.intro}</p>
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
        <div className="flex flex-col gap-8">
          {recipes.map(({ mix, recipe, complementHex, complementRecipe }) => (
            <div key={mix.name}>
              <div className="mb-2">
                <h2 className="text-lg font-semibold text-neutral-900">
                  {mix.name}
                </h2>
                <p className="text-sm text-neutral-600">{mix.description}</p>
              </div>
              {recipe ? (
                <RecipeResult recipe={recipe} targetHex={mix.targetHex} />
              ) : (
                <p className="text-sm text-neutral-500">
                  No recipe could be solved from your current library.
                </p>
              )}

              <div className="mt-3 pl-4">
                <p className="mb-2 text-xs font-medium tracking-wide text-neutral-500 uppercase">
                  Complementary accent
                </p>
                {complementRecipe ? (
                  <RecipeResult recipe={complementRecipe} targetHex={complementHex} />
                ) : (
                  <p className="text-sm text-neutral-500">
                    No recipe could be solved from your current library.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
