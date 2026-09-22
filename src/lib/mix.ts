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

export function computeRecipe(
  library: ClayColor[],
  targetHex: string,
  options: RecipeOptions = {}
): Recipe | null {
  const { maxColors = 3, candidatePoolSize = 20 } = options;
  if (library.length === 0) return null;

  const target = hexToRgb(targetHex);
  const targetLab = rgbToLab(target);

  // Narrow to the closest candidates first so combinatorics stay fast on large libraries.
  const withRgb = library.map((clay) => ({ clay, rgb: hexToRgb(clay.hex) }));
  const pool =
    withRgb.length > candidatePoolSize
      ? [...withRgb]
          .sort((a, b) => {
            const da =
              (a.rgb.r - target.r) ** 2 +
              (a.rgb.g - target.g) ** 2 +
              (a.rgb.b - target.b) ** 2;
            const db =
              (b.rgb.r - target.r) ** 2 +
              (b.rgb.g - target.g) ** 2 +
              (b.rgb.b - target.b) ** 2;
            return da - db;
          })
          .slice(0, candidatePoolSize)
      : withRgb;

  const cap = Math.min(maxColors, pool.length);
  let best: { indices: number[]; weights: number[]; score: number } | null =
    null;

  for (let size = 1; size <= cap; size++) {
    for (const combo of combinations(
      pool.map((_, i) => i),
      size
    )) {
      const comboRgb = combo.map((i) => pool[i].rgb);
      const weights = solveWeights(comboRgb, target);
      const predicted = mixRgb(comboRgb, weights);
      const error = deltaE(rgbToLab(predicted), targetLab);
      const score = error + (size - 1) * 0.05;

      if (!best || score < best.score) {
        best = { indices: combo, weights, score };
      }
    }
  }

  if (!best) return null;

  const chosen = best.indices
    .map((poolIdx, i) => ({ clay: pool[poolIdx].clay, weight: best!.weights[i] }))
    .filter((c) => c.weight > 0.005)
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
