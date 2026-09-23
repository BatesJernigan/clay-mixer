import Link from "next/link";
import { presetCollections } from "@/lib/presetMixes";

export default function RecipesPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-neutral-900">Recipes</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Pre-configured mix collections, solved live against your clay
          library. Pick a collection to see the recipe for each color.
        </p>
      </div>

      <ul className="flex flex-col gap-4">
        {presetCollections.map((collection) => (
          <li key={collection.slug}>
            <Link
              href={`/recipes/${collection.slug}`}
              className="flex items-center gap-4 rounded-lg border border-neutral-200 bg-white p-5 hover:border-neutral-400"
            >
              <div className="flex shrink-0 -space-x-2">
                {collection.mixes.slice(0, 5).map((mix, i) => (
                  <div
                    key={mix.name}
                    className="h-9 w-9 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: mix.targetHex, zIndex: 5 - i }}
                  />
                ))}
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-neutral-900">
                  {collection.title}
                </h2>
                <p className="mt-0.5 text-sm text-neutral-600">
                  {collection.mixes.length} color
                  {collection.mixes.length === 1 ? "" : "s"}
                </p>
              </div>
              <span className="text-neutral-400">&rarr;</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
