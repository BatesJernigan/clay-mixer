import { ClayColor, Recipe, RecipeIngredient } from "./types";
import {
  Lab,
  RGB,
  deltaE,
  hexToRgb,
  mixRgb,
  rgbToHex,
  rgbToLab,
} from "./color";

/** Solves A x = b for small square matrices via Gaussian elimination with partial pivoting. */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[pivot][col])) pivot = row;
    }
    if (Math.abs(M[pivot][col]) < 1e-10) return null;
    [M[col], M[pivot]] = [M[pivot], M[col]];

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = M[row][col] / M[col][col];
      for (let c = col; c <= n; c++) {
        M[row][c] -= factor * M[col][c];
      }
    }
  }

  return M.map((row, i) => row[n] / row[i]);
}

/**
 * Finds non-negative weights (summing to 1) over `colors` that best approximate
 * `target` in linear RGB space, using equality-constrained least squares with
 * active-set pruning of negative weights (a small-scale NNLS variant).
 */
function solveWeights(colors: RGB[], target: RGB): number[] {
  const n = colors.length;
  if (n === 1) return [1];

  let active = colors.map((_, i) => i);

  while (active.length > 1) {
    const A = active.map((i) => [colors[i].r, colors[i].g, colors[i].b]);
    const k = active.length;

    // KKT system for: minimize ||A^T w - target||^2 subject to sum(w) = 1
    // [2 A A^T   1] [w]   [2 A target]
    // [1^T       0] [l] = [1]
    const AAt: number[][] = Array.from({ length: k }, () =>
      new Array(k).fill(0)
    );
    for (let i = 0; i < k; i++) {
      for (let j = 0; j < k; j++) {
        AAt[i][j] =
          2 * (A[i][0] * A[j][0] + A[i][1] * A[j][1] + A[i][2] * A[j][2]);
      }
    }
    const rhs = A.map(
      (row) => 2 * (row[0] * target.r + row[1] * target.g + row[2] * target.b)
    );

    const M = AAt.map((row) => [...row, 1]);
    M.push([...new Array(k).fill(1), 0]);
    const rhsFull = [...rhs, 1];

    const solution = solveLinearSystem(M, rhsFull);

    if (!solution) {
      // Degenerate (e.g. duplicate colors) — drop the last color and retry.
      active = active.slice(0, -1);
      continue;
    }

    const weights = solution.slice(0, k);
    const minWeight = Math.min(...weights);

    if (minWeight >= -1e-9) {
      const clamped = weights.map((w) => Math.max(0, w));
      const sum = clamped.reduce((a, w) => a + w, 0);
      const full = new Array(n).fill(0);
      active.forEach((idx, i) => {
        full[idx] = sum > 0 ? clamped[i] / sum : 0;
      });
      return full;
    }

    const worstLocalIdx = weights.indexOf(minWeight);
    active = active.filter((_, i) => i !== worstLocalIdx);
  }

  const full = new Array(n).fill(0);
  if (active.length === 1) full[active[0]] = 1;
  return full;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function gcdOfAll(nums: number[]): number {
  return nums.reduce((a, b) => gcd(a, b));
}


export interface RecipeOptions {
  maxColors?: number;
}

interface Swatch {
  clay: ClayColor;
  rgb: RGB;
}

/** A set of library colors (indices into the swatch list) and its best unrounded mix. */
interface Combo {
  indices: number[];
  weights: number[];
  error: number;
}

/** Below this weight a clay is dropped from the recipe entirely. */
const MIN_WEIGHT = 0.005;

/** How many of the closest combos of each size are grown into the next size. */
const BEAM_WIDTH = 20;

/** How many of the closest combos of each size get swap-refined. */
const SWAP_CANDIDATES = 6;

/**
 * How many of the closest unrounded combos per color count get rounded to
 * whole parts. Many combos solve to an exact match, so the unrounded error
 * alone can't separate them; the rounded recipe is what the user mixes.
 */
const ROUNDING_CANDIDATES = 24;

/** Recipes never call for more total parts than this. */
const MAX_TOTAL_PARTS = 40;

/** A ratio with more total parts has to be at least this much closer (ΔE) to be worth it. */
const PARTS_TOLERANCE = 0.3;

/** A recipe with more colors must beat the simpler one by at least this ΔE to be worth mixing. */
const MIN_DELTA_E_IMPROVEMENT = 0.5;

function mixError(rgbs: RGB[], weights: number[], targetLab: Lab): number {
  return deltaE(rgbToLab(mixRgb(rgbs, weights)), targetLab);
}

/**
 * Finds the closest-fitting combos of each size from 1 to `maxColors`, drawing
 * on the whole library: a good mix often needs a color nowhere near the target
 * (a white to lighten, a yellow to warm). Sizes 1 and 2 are checked
 * exhaustively. Each larger size grows the best combos of the size below by
 * every other color, then tries swapping members out, which finds mixes whose
 * best smaller subset isn't itself a close match.
 *
 * Only combos that use every color are kept: one where the solver zeroed out a
 * color is the smaller combo, already found at its own size.
 */
function searchCombos(
  swatches: Swatch[],
  target: RGB,
  targetLab: Lab,
  maxColors: number
): Map<number, Combo[]> {
  const n = swatches.length;
  const seen = new Set<string>();
  const bySize = new Map<number, Combo[]>();

  const fit = (indices: number[]): Combo | null => {
    const sorted = [...indices].sort((a, b) => a - b);
    const key = sorted.join(",");
    if (seen.has(key)) return null;
    seen.add(key);
    const rgbs = sorted.map((i) => swatches[i].rgb);
    const weights = solveWeights(rgbs, target);
    if (weights.some((w) => w <= MIN_WEIGHT)) return null;
    return { indices: sorted, weights, error: mixError(rgbs, weights, targetLab) };
  };

  const byError = (a: Combo, b: Combo) => a.error - b.error;
  const keep = (combos: (Combo | null)[]) =>
    combos.filter((c): c is Combo => c !== null).sort(byError);

  const singles = keep(swatches.map((_, i) => fit([i])));
  bySize.set(1, singles);
  if (maxColors < 2) return bySize;

  const pairs: (Combo | null)[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) pairs.push(fit([i, j]));
  }
  bySize.set(2, keep(pairs));

  for (let size = 3; size <= Math.min(maxColors, n); size++) {
    const grown: (Combo | null)[] = [];
    for (const seed of bySize.get(size - 1)!.slice(0, BEAM_WIDTH)) {
      for (let j = 0; j < n; j++) {
        if (!seed.indices.includes(j)) grown.push(fit([...seed.indices, j]));
      }
    }
    const combos = keep(grown);

    // Hill-climb the closest few: swap one member for any other color while
    // that gets closer.
    for (let start of combos.slice(0, SWAP_CANDIDATES)) {
      for (;;) {
        let better: Combo | null = null;
        for (let pos = 0; pos < size; pos++) {
          for (let j = 0; j < n; j++) {
            if (start.indices.includes(j)) continue;
            const swapped = [...start.indices];
            swapped[pos] = j;
            const combo = fit(swapped);
            if (!combo) continue;
            combos.push(combo);
            if (combo.error < (better ?? start).error) better = combo;
          }
        }
        if (!better) break;
        start = better;
      }
    }

    if (combos.length === 0) break;
    bySize.set(size, combos.sort(byError));
  }
  return bySize;
}

/**
 * Nudges a combo's weights toward the closest match in ΔE. The solver fits in
 * RGB, which can land well off the perceptual optimum when the target is out
 * of reach. Shifts weight between pairs of colors, halving the step whenever
 * no shift helps.
 */
function refineInLab(combo: Combo, swatches: Swatch[], targetLab: Lab): Combo {
  const rgbs = combo.indices.map((i) => swatches[i].rgb);
  let weights = combo.weights;
  let error = combo.error;
  for (let step = 0.05; step > 1e-3; ) {
    let improved = false;
    for (let from = 0; from < weights.length; from++) {
      for (let to = 0; to < weights.length; to++) {
        const shift = Math.min(step, weights[from] - MIN_WEIGHT);
        if (to === from || shift <= 0) continue;
        const next = [...weights];
        next[from] -= shift;
        next[to] += shift;
        const nextError = mixError(rgbs, next, targetLab);
        if (nextError < error - 1e-9) {
          weights = next;
          error = nextError;
          improved = true;
        }
      }
    }
    if (!improved) step /= 2;
  }
  return { indices: combo.indices, weights, error };
}

/** Splits `total` parts in proportion to `weights`, giving every color at least one. */
function apportion(weights: number[], total: number): number[] {
  const ideal = weights.map((w) => w * total);
  const parts = ideal.map((x) => Math.max(1, Math.floor(x)));
  let sum = parts.reduce((a, p) => a + p, 0);
  while (sum < total) {
    const i = argMax(ideal.map((x, i) => x - parts[i]));
    parts[i]++;
    sum++;
  }
  while (sum > total) {
    const i = argMax(ideal.map((x, i) => (parts[i] > 1 ? parts[i] - x : -Infinity)));
    parts[i]--;
    sum--;
  }
  return parts;
}

function argMax(values: number[]): number {
  return values.indexOf(Math.max(...values));
}

/**
 * Moves single parts between colors while that brings the mix closer. The
 * unrounded weights are fit in RGB, so the nearest whole-part ratio isn't
 * always the closest one in ΔE.
 */
function polishParts(parts: number[], rgbs: RGB[], targetLab: Lab) {
  const total = parts.reduce((a, p) => a + p, 0);
  const errorOf = (p: number[]) => mixError(rgbs, p.map((x) => x / total), targetLab);
  let best = { parts, error: errorOf(parts) };
  for (;;) {
    let improved = false;
    for (let from = 0; from < parts.length; from++) {
      for (let to = 0; to < parts.length; to++) {
        // Re-checked each move: an accepted move may have just taken from it.
        if (to === from || best.parts[from] === 1) continue;
        const next = [...best.parts];
        next[from]--;
        next[to]++;
        const error = errorOf(next);
        if (error < best.error - 1e-9) {
          best = { parts: next, error };
          improved = true;
        }
      }
    }
    if (!improved) return best;
  }
}

/**
 * Converts continuous mix weights into a whole-part ratio (e.g. "3 : 2 : 1"):
 * the fewest total parts that come within `PARTS_TOLERANCE` of the unrounded
 * mix, or failing that the closest ratio up to `MAX_TOTAL_PARTS`.
 */
function weightsToParts(
  weights: number[],
  rgbs: RGB[],
  targetLab: Lab,
  unroundedError: number
): number[] {
  if (weights.length === 1) return [1];

  const options = [];
  for (let total = weights.length; total <= MAX_TOTAL_PARTS; total++) {
    const option = polishParts(apportion(weights, total), rgbs, targetLab);
    options.push(option);
    // Already as close as the unrounded mix: more parts won't help.
    if (option.error <= unroundedError + 0.05) break;
  }
  const closest = Math.min(...options.map((o) => o.error));
  const { parts } = options.find((o) => o.error <= closest + PARTS_TOLERANCE)!;
  const divisor = gcdOfAll(parts);
  return parts.map((p) => p / divisor);
}

function buildRecipe(swatches: Swatch[], combo: Combo, targetLab: Lab): Recipe {
  const chosen = combo.indices
    .map((idx, i) => ({ swatch: swatches[idx], weight: combo.weights[i] }))
    .sort((a, b) => b.weight - a.weight);
  const rgbs = chosen.map((c) => c.swatch.rgb);
  const parts = weightsToParts(
    chosen.map((c) => c.weight),
    rgbs,
    targetLab,
    combo.error
  );
  const partsSum = parts.reduce((a, b) => a + b, 0);

  const ingredients: RecipeIngredient[] = chosen.map((c, i) => ({
    clay: c.swatch.clay,
    parts: parts[i],
    percent: (parts[i] / partsSum) * 100,
  }));

  const finalRgb = mixRgb(
    rgbs,
    parts.map((p) => p / partsSum)
  );
  return {
    ingredients,
    ratioLabel: parts.join(" : "),
    predictedHex: rgbToHex(finalRgb),
    deltaE: deltaE(rgbToLab(finalRgb), targetLab),
  };
}

/** The single closest recipe using up to `maxColors` colors (default 3). */
export function computeRecipe(
  library: ClayColor[],
  targetHex: string,
  options: RecipeOptions = {}
): Recipe | null {
  const recipes = computeRecipesByColorCount(library, targetHex, {
    maxColors: options.maxColors ?? 3,
  });
  // Each larger recipe is kept only if it's closer, so the last is the closest.
  return recipes[recipes.length - 1] ?? null;
}

/**
 * Finds the best recipe for each ingredient count from 1 to `maxColors`, so
 * simpler mixes can be weighed against closer but fussier ones. A count is
 * left out when no combo of that size uses every color, or when its rounded
 * recipe isn't a noticeable improvement on the simpler ones.
 */
export function computeRecipesByColorCount(
  library: ClayColor[],
  targetHex: string,
  options: RecipeOptions = {}
): Recipe[] {
  const { maxColors = 6 } = options;
  if (library.length === 0) return [];

  const target = hexToRgb(targetHex);
  const targetLab = rgbToLab(target);
  const swatches = library.map((clay) => ({ clay, rgb: hexToRgb(clay.hex) }));
  const bySize = searchCombos(swatches, target, targetLab, maxColors);

  const recipes: Recipe[] = [];
  for (const size of [...bySize.keys()].sort((a, b) => a - b)) {
    const recipe = bySize
      .get(size)!
      .slice(0, ROUNDING_CANDIDATES)
      .map((combo) => refineInLab(combo, swatches, targetLab))
      .map((combo) => buildRecipe(swatches, combo, targetLab))
      .reduce((best, r) => (isBetterRecipe(r, best) ? r : best));
    const previous = recipes[recipes.length - 1];
    if (
      !previous ||
      previous.deltaE - recipe.deltaE >= MIN_DELTA_E_IMPROVEMENT
    ) {
      recipes.push(recipe);
    }
  }
  return recipes;
}

function totalParts(recipe: Recipe): number {
  return recipe.ingredients.reduce((sum, ing) => sum + ing.parts, 0);
}

/** Closer match wins; near-ties (imperceptible ΔE gap) go to the simpler ratio. */
function isBetterRecipe(candidate: Recipe, current: Recipe): boolean {
  if (Math.abs(candidate.deltaE - current.deltaE) < 0.1) {
    const partsDiff = totalParts(candidate) - totalParts(current);
    if (partsDiff !== 0) return partsDiff < 0;
  }
  return candidate.deltaE < current.deltaE;
}
