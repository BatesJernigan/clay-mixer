import { ClayColor } from "./types";

let counter = 0;
function id(): string {
  counter += 1;
  return `seed-${counter}-${Date.now()}`;
}

export function seedLibrary(): ClayColor[] {
  const now = Date.now();
  const entries: Omit<ClayColor, "id" | "createdAt">[] = [
    { brand: "Premo Sculpey", name: "White", hex: "#f5f1e6" },
    { brand: "Premo Sculpey", name: "Black", hex: "#2b2725" },
    { brand: "Premo Sculpey", name: "Cadmium Red", hex: "#b3241c" },
    { brand: "Premo Sculpey", name: "Cadmium Yellow", hex: "#f2c012" },
    { brand: "Premo Sculpey", name: "Ultramarine Blue", hex: "#26428b" },
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
