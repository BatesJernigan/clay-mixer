import { ClayColor, clayKey } from "./types";
import { premoColors } from "./premoColors";
import { souffleColors } from "./souffleColors";

let counter = 0;
function id(): string {
  counter += 1;
  return `seed-${counter}-${Date.now()}`;
}

const catalog: Omit<ClayColor, "id" | "createdAt">[] = [
  ...premoColors,
  ...souffleColors,
  { brand: "Fimo Professional", name: "White", hex: "#f7f3ea" },
  { brand: "Fimo Professional", name: "Black", hex: "#1f1c1a" },
  { brand: "Fimo Professional", name: "True Red", hex: "#c1272d" },
  { brand: "Fimo Professional", name: "Lemon Yellow", hex: "#f6e13c" },
  { brand: "Fimo Professional", name: "Navy Blue", hex: "#1e3a5f" },
  {
    brand: "Cernit",
    name: "White",
    hex: "#f4efe4",
    url: "https://polymerclaysuperstore.com/products/cernit-number-one-opaque-white-2-oz",
  },
  { brand: "Cernit", name: "Black", hex: "#211d1b" },
  {
    brand: "Cernit",
    name: "Carmine",
    hex: "#9c1f34",
    url: "https://polymerclaysuperstore.com/products/cernit-number-one-carmine-red-2-oz",
  },
];

const catalogUrls = new Map(
  catalog.filter((c) => c.url).map((c) => [clayKey(c), c.url])
);

/** The known product link for a catalog clay, if it has one. */
export function catalogUrl(clay: Pick<ClayColor, "brand" | "name">) {
  return catalogUrls.get(clayKey(clay));
}

export function seedLibrary(): ClayColor[] {
  const now = Date.now();
  return catalog.map((entry) => ({
    ...entry,
    id: id(),
    createdAt: now,
  }));
}
