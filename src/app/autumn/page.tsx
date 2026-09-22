"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLibrary } from "@/context/LibraryContext";
import { RecipeResult } from "@/components/RecipeResult";
import { computeRecipe } from "@/lib/mix";
import { autumnCollection } from "@/lib/presetMixes";

export default function AutumnMixesPage() {
  const { colors, loaded } = useLibrary();

  const recipes = useMemo(() => {
    if (colors.length === 0) return [];
    return autumnCollection.mixes.map((mix) => ({
      mix,
      recipe: computeRecipe(colors, mix.targetHex, { maxColors: 3 }),
    }));
  }, [colors]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-neutral-900">
          {autumnCollection.title}
        </h1>
        <p className="mt-1 text-sm text-neutral-600">{autumnCollection.intro}</p>
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
          {recipes.map(({ mix, recipe }) => (
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
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
