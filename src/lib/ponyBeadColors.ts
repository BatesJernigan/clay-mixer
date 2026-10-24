/**
 * Creatology Opaque Pony Beads (6mm × 9mm), Michaels' own bead line and the
 * easiest pony beads to buy in a store. The color list comes from the
 * Michaels product page. Hex values are hand-picked approximations of the
 * beads, not manufacturer-published values.
 * Source: https://www.michaels.com/product/opaque-pony-beads-by-creatology-6mm-x-9mm-10054284
 */
export const PONY_BEAD_BRAND = "Creatology";

export interface BeadColor {
  name: string;
  hex: string;
  /** Where the bead can be bought. */
  url?: string;
}

const PRODUCT_URL =
  "https://www.michaels.com/product/opaque-pony-beads-by-creatology-6mm-x-9mm-10054284";

/** Links straight to one color's product page at Michaels. */
function product(id: number): string {
  return `https://www.michaels.com/product/opaque-pony-beads-by-creatology-6mm-x-9mm-${id}`;
}

export const ponyBeadColors: BeadColor[] = [
  { name: "Black", hex: "#1a1a1a", url: product(10054267) },
  { name: "White", hex: "#f5f5f2", url: PRODUCT_URL },
  { name: "Gray", hex: "#8c8c8c", url: product(10647296) },
  { name: "Red", hex: "#d0202e", url: PRODUCT_URL },
  { name: "Pink", hex: "#f28bb5", url: PRODUCT_URL },
  { name: "Purple", hex: "#6a2c91", url: PRODUCT_URL },
  { name: "Lavender", hex: "#b49ad6", url: PRODUCT_URL },
  { name: "Orange", hex: "#f07a1a", url: PRODUCT_URL },
  { name: "Yellow", hex: "#f7d417", url: PRODUCT_URL },
  { name: "Kelly Green", hex: "#1e9a3c", url: PRODUCT_URL },
  { name: "Royal Blue", hex: "#2346b0", url: PRODUCT_URL },
];

/** The catalog bead with this name. Throws if there is none. */
export function beadByName(name: string): BeadColor {
  const bead = ponyBeadColors.find((b) => b.name === name);
  if (!bead) throw new Error(`Unknown pony bead: ${name}`);
  return bead;
}
