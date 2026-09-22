export interface ClayColor {
  id: string;
  brand: string;
  name: string;
  hex: string;
  createdAt: number;
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
