import { ClayColor } from "./types";

/**
 * The full Sculpey Souffle Premium Oven-Bake Clay color line, scraped from
 * the collection listing at polymerclaysuperstore.com. Hex values are
 * sampled from the product's official swatch photos, so they approximate
 * the baked clay's appearance rather than a manufacturer-published hex spec.
 * Source: https://polymerclaysuperstore.com/collections/sculpey-souffle-1-7-oz-bars
 */
export const SOUFFLE_BRAND = "Sculpey Souffle";

export const souffleColors: Omit<ClayColor, "id" | "createdAt">[] = [
  { brand: SOUFFLE_BRAND, name: "Igloo", hex: "#ece9e8" },
  { brand: SOUFFLE_BRAND, name: "Ivory", hex: "#e2ddd0" },
  { brand: SOUFFLE_BRAND, name: "Latte", hex: "#c7a67f" },
  { brand: SOUFFLE_BRAND, name: "Almond Rose", hex: "#e6cec9" },
  { brand: SOUFFLE_BRAND, name: "French Pink", hex: "#d2b4b8" },
  { brand: SOUFFLE_BRAND, name: "Toasty", hex: "#cba284" },
  { brand: SOUFFLE_BRAND, name: "Honey Mustard", hex: "#cfb462" },
  { brand: SOUFFLE_BRAND, name: "Cadmium Yellow", hex: "#fed81a" },
  { brand: SOUFFLE_BRAND, name: "Citron", hex: "#c1b64a" },
  { brand: SOUFFLE_BRAND, name: "Yellow Ochre", hex: "#eec362" },
  { brand: SOUFFLE_BRAND, name: "Pumpkin", hex: "#df895d" },
  { brand: SOUFFLE_BRAND, name: "Mandarin", hex: "#e0686e" },
  { brand: SOUFFLE_BRAND, name: "Chili Pepper", hex: "#ad353d" },
  { brand: SOUFFLE_BRAND, name: "Cherry Pie", hex: "#aa1e3d" },
  { brand: SOUFFLE_BRAND, name: "Magenta", hex: "#fd2d93" },
  { brand: SOUFFLE_BRAND, name: "Smokey Mauve", hex: "#8b4f84" },
  { brand: SOUFFLE_BRAND, name: "Cabernet", hex: "#7d4059" },
  { brand: SOUFFLE_BRAND, name: "Thistle", hex: "#a9a5bc" },
  { brand: SOUFFLE_BRAND, name: "Grape", hex: "#672f71" },
  { brand: SOUFFLE_BRAND, name: "Royalty", hex: "#492051" },
  { brand: SOUFFLE_BRAND, name: "Turnip", hex: "#7f2b6e" },
  { brand: SOUFFLE_BRAND, name: "Midnight Mulberry", hex: "#414793" },
  { brand: SOUFFLE_BRAND, name: "Cornflower", hex: "#3c5ca3" },
  { brand: SOUFFLE_BRAND, name: "Cobalt", hex: "#0161d5" },
  { brand: SOUFFLE_BRAND, name: "Bluestone", hex: "#668ea0" },
  { brand: SOUFFLE_BRAND, name: "Robin's Egg", hex: "#3fa2c4" },
  { brand: SOUFFLE_BRAND, name: "Sea Glass", hex: "#008f90" },
  { brand: SOUFFLE_BRAND, name: "Jade", hex: "#238870" },
  { brand: SOUFFLE_BRAND, name: "Racing Green", hex: "#024f3c" },
  { brand: SOUFFLE_BRAND, name: "Pistachio", hex: "#c3d2aa" },
  { brand: SOUFFLE_BRAND, name: "Sedona", hex: "#b47167" },
  { brand: SOUFFLE_BRAND, name: "Cinnamon", hex: "#a65c43" },
  { brand: SOUFFLE_BRAND, name: "Spiced Rum", hex: "#914f51" },
  { brand: SOUFFLE_BRAND, name: "Creme Brulee", hex: "#904e51" },
  { brand: SOUFFLE_BRAND, name: "Cowboy", hex: "#644939" },
  { brand: SOUFFLE_BRAND, name: "Concrete", hex: "#a3a5a5" },
  { brand: SOUFFLE_BRAND, name: "Poppy Seed", hex: "#181514" },
];
