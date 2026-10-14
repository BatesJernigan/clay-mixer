import { Recipe } from "@/lib/types";
import { ColorSwatch } from "./ColorSwatch";
import { ShopLinks } from "./ShopLinks";

interface RecipeResultProps {
  recipe: Recipe;
  targetHex: string;
}

function matchQuality(deltaE: number): { label: string; className: string } {
  if (deltaE < 2) return { label: "Excellent match", className: "text-green-700 bg-green-50" };
  if (deltaE < 5) return { label: "Good match", className: "text-lime-700 bg-lime-50" };
  if (deltaE < 10) return { label: "Fair match", className: "text-amber-700 bg-amber-50" };
  return { label: "Rough match", className: "text-red-700 bg-red-50" };
}

export function RecipeResult({ recipe, targetHex }: RecipeResultProps) {
  const quality = matchQuality(recipe.deltaE);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-100 pb-4">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-xs text-neutral-500">Target</p>
            <ColorSwatch hex={targetHex} size={48} />
          </div>
          <span className="text-neutral-300">→</span>
          <div>
            <p className="text-xs text-neutral-500">Predicted mix</p>
            <ColorSwatch hex={recipe.predictedHex} size={48} />
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${quality.className}`}>
          {quality.label} · ΔE {recipe.deltaE.toFixed(1)}
        </span>
      </div>

      {recipe.ingredients.length > 1 && (
        <p className="mt-4 text-sm text-neutral-500">
          Ratio <span className="font-mono text-neutral-800">{recipe.ratioLabel}</span>
        </p>
      )}

      <ul className="mt-3 flex flex-col gap-3">
        {recipe.ingredients.map((ing) => (
          <li key={ing.clay.id} className="flex items-center gap-3">
            <ColorSwatch hex={ing.clay.hex} size={36} />
            <div className="flex-1">
              <p className="text-sm font-medium text-neutral-900">
                {ing.clay.name}
              </p>
              <p className="text-xs text-neutral-500">{ing.clay.brand}</p>
              <ShopLinks clay={ing.clay} />
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-neutral-900">
                {ing.parts} {ing.parts === 1 ? "part" : "parts"}
              </p>
              <p className="text-xs text-neutral-500">{ing.percent.toFixed(1)}%</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
