import { ClayColor } from "./types";
import { premoColors } from "./premoColors";

let counter = 0;
function id(): string {
  counter += 1;
  return `seed-${counter}-${Date.now()}`;
}

export function seedLibrary(): ClayColor[] {
  const now = Date.now();
  const entries: Omit<ClayColor, "id" | "createdAt">[] = [
    ...premoColors,
    { brand: "Fimo Professional", name: "White", hex: "#f7f3ea" },
    { brand: "Fimo Professional", name: "Black", hex: "#1f1c1a" },
    { brand: "Fimo Professional", name: "True Red", hex: "#c1272d" },
    { brand: "Fimo Professional", name: "Lemon Yellow", hex: "#f6e13c" },
    { brand: "Fimo Professional", name: "Navy Blue", hex: "#1e3a5f" },
    { brand: "Cernit", name: "White", hex: "#f4efe4" },
    { brand: "Cernit", name: "Black", hex: "#211d1b" },
    { brand: "Cernit", name: "Carmine", hex: "#9c1f34" },
  ];

  return entries.map((entry) => ({
    ...entry,
    id: id(),
    createdAt: now,
  }));
}
