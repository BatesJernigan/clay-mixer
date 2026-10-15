import { ClayColor } from "./types";

/**
 * The full Sculpey Souffle Premium Oven-Bake Clay color line, scraped from
 * the collection listing at polymerclaysuperstore.com. Hex values are
 * sampled from the product's official swatch photos, so they approximate
 * the baked clay's appearance rather than a manufacturer-published hex spec.
 * Source: https://polymerclaysuperstore.com/collections/sculpey-souffle-1-7-oz-bars
 */
export const SOUFFLE_BRAND = "Sculpey Souffle";

/** Each color is its own 1.7 oz product page at Polymer Clay Superstore. */
function product(handle: string): string {
  return `https://polymerclaysuperstore.com/products/${handle}`;
}

export const souffleColors: Omit<ClayColor, "id" | "createdAt">[] = [
  { brand: SOUFFLE_BRAND, name: "Igloo", hex: "#ece9e8", url: product("sculpey-souffle-igloo-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Ivory", hex: "#e2ddd0", url: product("sculpey-souffle-ivory-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Latte", hex: "#c7a67f", url: product("sculpey-souffle-latte-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Almond Rose", hex: "#e6cec9", url: product("sculpey-souffle-almond-rose-17-oz") },
  { brand: SOUFFLE_BRAND, name: "French Pink", hex: "#d2b4b8", url: product("sculpey-souffle-french-pink-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Toasty", hex: "#cba284", url: product("sculpey-souffle-toasty-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Honey Mustard", hex: "#cfb462", url: product("sculpey-souffle-honey-mustard-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Cadmium Yellow", hex: "#fed81a", url: product("sculpey-souffle-cadmium-yellow-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Citron", hex: "#c1b64a", url: product("sculpey-souffle-citron-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Yellow Ochre", hex: "#eec362", url: product("sculpey-souffle-yellow-ochre-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Pumpkin", hex: "#df895d", url: product("sculpey-souffle-pumpkin-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Mandarin", hex: "#e0686e", url: product("sculpey-souffle-mandarin-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Chili Pepper", hex: "#ad353d", url: product("sculpey-souffle-chili-pepper-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Cherry Pie", hex: "#aa1e3d", url: product("sculpey-souffle-cherry-pie-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Magenta", hex: "#fd2d93", url: product("sculpey-souffle-magenta-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Smokey Mauve", hex: "#8b4f84", url: product("sculpey-souffle-smokey-mauve-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Cabernet", hex: "#7d4059", url: product("sculpey-souffle-cabernet-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Thistle", hex: "#a9a5bc", url: product("sculpey-souffle-thistle-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Grape", hex: "#672f71", url: product("sculpey-souffle-grape-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Royalty", hex: "#492051", url: product("sculpey-souffle-royalty-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Turnip", hex: "#7f2b6e", url: product("sculpey-souffle-turnip-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Midnight Mulberry", hex: "#414793", url: product("sculpey-souffle-midnight-mulberry-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Cornflower", hex: "#3c5ca3", url: product("sculpey-souffle-cornflower-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Cobalt", hex: "#0161d5", url: product("sculpey-souffle-cobalt-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Bluestone", hex: "#668ea0", url: product("sculpey-souffle-bluestone-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Robin's Egg", hex: "#3fa2c4", url: product("sculpey-souffle-robins-egg-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Sea Glass", hex: "#008f90", url: product("sculpey-souffle-sea-glass-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Jade", hex: "#238870", url: product("sculpey-souffle-jade-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Racing Green", hex: "#024f3c", url: product("sculpey-souffle-racing-green-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Pistachio", hex: "#c3d2aa", url: product("sculpey-souffle-pistachio-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Sedona", hex: "#b47167", url: product("sculpey-souffle-sedona-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Cinnamon", hex: "#a65c43", url: product("sculpey-souffle-cinnamon-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Spiced Rum", hex: "#914f51", url: product("sculpey-souffle-spiced-rum-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Creme Brulee", hex: "#904e51", url: product("sculpey-souffle-creme-brulee-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Cowboy", hex: "#644939", url: product("sculpey-souffle-cowboy-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Concrete", hex: "#a3a5a5", url: product("sculpey-souffle-concrete-17-oz") },
  { brand: SOUFFLE_BRAND, name: "Poppy Seed", hex: "#181514", url: product("sculpey-souffle-poppy-seed-17-oz") },
];
