export interface ClayColor {
  id: string;
  brand: string;
  name: string;
  hex: string;
  /** Product page the color was crawled from, where it can be bought. */
  url?: string;
  createdAt: number;
}

/**
 * Identifies a clay by brand + name rather than id: seeded ids are
 * regenerated whenever the starter library is reloaded.
 */
export function clayKey(clay: Pick<ClayColor, "brand" | "name">): string {
  return `${clay.brand.toLowerCase()}::${clay.name.toLowerCase()}`;
}

export interface RecipeIngredient {
  clay: ClayColor;
  parts: number;
  percent: number;
}

export interface Recipe {
  ingredients: RecipeIngredient[];
  ratioLabel: string;
  predictedHex: string;
  deltaE: number;
}
