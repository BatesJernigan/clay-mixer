import { ClayColor } from "./types";
import { PREMO_BRAND } from "./premoColors";
import { SOUFFLE_BRAND } from "./souffleColors";

/**
 * Where each clay's color data came from and where to buy it. Links are
 * resolved at render time from brand + name rather than stored on ClayColor,
 * because libraries live in localStorage and stored copies would never pick
 * up new or corrected links.
 */

export interface ShopLink {
  label: string;
  url: string;
  kind: "source" | "shop";
}

// Set at build time to turn Amazon links into affiliate links, e.g.
// NEXT_PUBLIC_AMAZON_TAG=yourtag-20 npm run deploy
const AMAZON_TAG = process.env.NEXT_PUBLIC_AMAZON_TAG;

const brandSources: Record<string, string> = {
  [PREMO_BRAND]:
    "https://www.sculpey.com/products/sculpey-premo%E2%84%A2-oven-bake-clay",
  [SOUFFLE_BRAND]:
    "https://polymerclaysuperstore.com/collections/sculpey-souffle-1-7-oz-bars",
};

function query(clay: Pick<ClayColor, "brand" | "name">): string {
  return encodeURIComponent(`${clay.brand} ${clay.name}`);
}

export function shopLinksFor(
  clay: Pick<ClayColor, "brand" | "name">
): ShopLink[] {
  const links: ShopLink[] = [];

  const source = brandSources[clay.brand];
  if (source) links.push({ label: "Color source", url: source, kind: "source" });

  links.push({
    label: "Polymer Clay Superstore",
    url: `https://polymerclaysuperstore.com/search?q=${query(clay)}`,
    kind: "shop",
  });

  const amazon = new URL("https://www.amazon.com/s");
  amazon.searchParams.set("k", `${clay.brand} ${clay.name} polymer clay`);
  if (AMAZON_TAG) amazon.searchParams.set("tag", AMAZON_TAG);
  links.push({ label: "Amazon", url: amazon.toString(), kind: "shop" });

  return links;
}
