export interface ClayColor {
  id: string;
  brand: string;
  name: string;
  hex: string;
  createdAt: number;
}

export interface RecipeIngredient {
  clay: ClayColor;
  weight: number;
  percent: number;
  amount: number;
}

export interface Recipe {
  ingredients: RecipeIngredient[];
  predictedHex: string;
  deltaE: number;
}
