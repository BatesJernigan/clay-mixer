import { describe, expect, it } from "vitest";
import { beadByName, ponyBeadColors } from "./ponyBeadColors";

describe("ponyBeadColors", () => {
  it("has unique names and valid lowercase hexes", () => {
    expect(new Set(ponyBeadColors.map((b) => b.name)).size).toBe(
      ponyBeadColors.length
    );
    for (const bead of ponyBeadColors) expect(bead.hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("includes the beads the black/white presets need", () => {
    for (const name of ["Black", "White", "Gray"]) {
      expect(beadByName(name).name).toBe(name);
    }
  });

  it("throws for an unknown bead", () => {
    expect(() => beadByName("Chartreuse")).toThrow();
  });
});
