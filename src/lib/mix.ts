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

/**
 * Converts continuous mix weights into a small-integer part ratio (e.g. "1 : 5 : 10"),
 * trying coarser denominators first and only refining precision when the rounding
 * would otherwise visibly worsen the color match.
 */
function weightsToParts(
  weights: number[],
  comboRgb: RGB[],
  targetLab: Lab,
  baseDeltaE: number
): number[] {
  if (weights.length === 1) return [1];

  const minWeight = Math.min(...weights);
  const denominators = [1, 2, 4, 10];
  const tolerance = Math.max(baseDeltaE + 2, 6);

  for (const denom of denominators) {
    const raw = weights.map((w) => Math.max(1, Math.round((w / minWeight) * denom)));
    const divisor = gcdOfAll(raw);
    const parts = raw.map((x) => x / divisor);

    const partsSum = parts.reduce((a, b) => a + b, 0);
    const approxWeights = parts.map((p) => p / partsSum);
    const predicted = mixRgb(comboRgb, approxWeights);
    const error = deltaE(rgbToLab(predicted), targetLab);

    if (error <= tolerance || denom === denominators[denominators.length - 1]) {
      return parts;
    }
  }

  return weights.map(() => 1);
}

function* combinations<T>(items: T[], size: number): Generator<T[]> {
  if (size === 0) {
    yield [];
    return;
  }
  for (let i = 0; i <= items.length - size; i++) {
    for (const rest of combinations(items.slice(i + 1), size - 1)) {
      yield [items[i], ...rest];
    }
  }
}

export interface RecipeOptions {
  maxColors?: number;
  candidatePoolSize?: number;
}

interface PoolEntry {
  clay: ClayColor;
  rgb: RGB;
}

interface ComboResult {
  indices: number[];
  weights: number[];
  score: number;
}

/** Below this weight a clay is dropped from the recipe entirely. */
const MIN_WEIGHT = 0.005;

/**
 * Combos larger than this only draw from the closest few candidates; the
 * combination count otherwise explodes (C(20, 6) alone is ~39k solves).
 */
const LARGE_COMBO_SIZE = 4;
const LARGE_COMBO_POOL_SIZE = 12;

/**
 * How many of the closest unrounded combos per color count get rounded to
 * whole parts. Many combos solve to an exact match, so the unrounded score
 * alone can't separate them; the rounded recipe is what the user mixes.
 */
const ROUNDING_CANDIDATES = 30;

/** A recipe with more colors must beat the simpler one by at least this ΔE to be worth mixing. */
const MIN_DELTA_E_IMPROVEMENT = 0.5;

/**
 * Narrows the library to the colors closest to the target so combinatorics
 * stay fast on large libraries.
 */
function candidatePool(
  library: ClayColor[],
  target: RGB,
  candidatePoolSize: number
): PoolEntry[] {
  const withRgb = library.map((clay) => ({ clay, rgb: hexToRgb(clay.hex) }));
  const distance = ({ rgb }: PoolEntry) =>
    (rgb.r - target.r) ** 2 + (rgb.g - target.g) ** 2 + (rgb.b - target.b) ** 2;
  return [...withRgb]
    .sort((a, b) => distance(a) - distance(b))
    .slice(0, candidatePoolSize);
}

/**
 * Calls `visit` with the solved weights for every combination of up to
 * `maxColors` pool colors. Expects `pool` sorted closest-first.
 */
function forEachCombo(
  pool: PoolEntry[],
  target: RGB,
  targetLab: Lab,
  maxColors: number,
  visit: (combo: ComboResult, size: number) => void
) {
  const cap = Math.min(maxColors, pool.length);
  for (let size = 1; size <= cap; size++) {
    const poolSize =
      size > LARGE_COMBO_SIZE ? LARGE_COMBO_POOL_SIZE : pool.length;
    for (const combo of combinations(
      pool.slice(0, poolSize).map((_, i) => i),
      size
    )) {
      const comboRgb = combo.map((i) => pool[i].rgb);
      const weights = solveWeights(comboRgb, target);
      const predicted = mixRgb(comboRgb, weights);
      const error = deltaE(rgbToLab(predicted), targetLab);
      visit({ indices: combo, weights, score: error + (size - 1) * 0.05 }, size);
    }
  }
}

function buildRecipe(
  pool: PoolEntry[],
  best: ComboResult,
  targetLab: Lab
): Recipe {
  const chosen = best.indices
    .map((poolIdx, i) => ({ clay: pool[poolIdx].clay, weight: best.weights[i] }))
    .filter((c) => c.weight > MIN_WEIGHT)
    .sort((a, b) => b.weight - a.weight);

  const weightSum = chosen.reduce((a, c) => a + c.weight, 0);
  const normalizedWeights = chosen.map((c) =>
    weightSum > 0 ? c.weight / weightSum : 0
  );
  const chosenRgb = chosen.map((c) => hexToRgb(c.clay.hex));
  const parts = weightsToParts(
    normalizedWeights,
    chosenRgb,
    targetLab,
    best.score
  );
  const partsSum = parts.reduce((a, b) => a + b, 0);

  const ingredients: RecipeIngredient[] = chosen.map((c, i) => ({
    clay: c.clay,
    parts: parts[i],
    percent: (parts[i] / partsSum) * 100,
  }));

  const finalRgb = mixRgb(
    chosenRgb,
    parts.map((p) => p / partsSum)
  );
  const predictedHex = rgbToHex(finalRgb);
  const finalDeltaE = deltaE(rgbToLab(finalRgb), targetLab);
  const ratioLabel = parts.join(" : ");

  return { ingredients, ratioLabel, predictedHex, deltaE: finalDeltaE };
}

export function computeRecipe(
  library: ClayColor[],
  targetHex: string,
  options: RecipeOptions = {}
): Recipe | null {
  const { maxColors = 3, candidatePoolSize = 20 } = options;
  if (library.length === 0) return null;

  const target = hexToRgb(targetHex);
  const targetLab = rgbToLab(target);
  const pool = candidatePool(library, target, candidatePoolSize);

  let best: ComboResult | null = null;
  forEachCombo(pool, target, targetLab, maxColors, (combo) => {
    if (!best || combo.score < best.score) best = combo;
  });

  return best ? buildRecipe(pool, best, targetLab) : null;
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
  const { maxColors = 6, candidatePoolSize = 20 } = options;
  if (library.length === 0) return [];

  const target = hexToRgb(targetHex);
  const targetLab = rgbToLab(target);
  const pool = candidatePool(library, target, candidatePoolSize);

  // Combos where the solver zeroed out a color are skipped: the smaller combo
  // without it is enumerated on its own.
  const candidatesByCount = new Map<number, ComboResult[]>();
  forEachCombo(pool, target, targetLab, maxColors, (combo, size) => {
    const used = combo.weights.filter((w) => w > MIN_WEIGHT).length;
    if (used !== size) return;
    const candidates = candidatesByCount.get(size) ?? [];
    candidates.push(combo);
    if (candidates.length > ROUNDING_CANDIDATES * 4) {
      candidates.sort((a, b) => a.score - b.score);
      candidates.length = ROUNDING_CANDIDATES;
    }
    candidatesByCount.set(size, candidates);
  });

  const recipes: Recipe[] = [];
  const counts = [...candidatesByCount.keys()].sort((a, b) => a - b);
  for (const count of counts) {
    const recipe = candidatesByCount
      .get(count)!
      .sort((a, b) => a.score - b.score)
      .slice(0, ROUNDING_CANDIDATES)
      .map((combo) => buildRecipe(pool, combo, targetLab))
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
