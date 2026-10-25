import { describe, expect, it } from "vitest";
import { deltaE, hexToLab, hexToRgb, mixRgb, rgbToHex, rgbToLab } from "./color";
import { computeRecipe, computeRecipesByColorCount } from "./mix";
import { seedLibrary } from "./seedLibrary";
import { ClayColor, Recipe } from "./types";

function clay(name: string, hex: string): ClayColor {
  return { id: name, brand: "Test", name, hex, createdAt: 0 };
}

const WHITE = clay("White", "#ffffff");
const BLACK = clay("Black", "#000000");
const RED = clay("Red", "#ff0000");
const BLUE = clay("Blue", "#0000ff");
const YELLOW = clay("Yellow", "#ffff00");
const BASIC = [WHITE, BLACK, RED, BLUE, YELLOW];

function names(recipe: Recipe): string[] {
  return recipe.ingredients.map((i) => i.clay.name);
}

/** Re-mixes a recipe's ingredients by their parts, independent of the solver. */
function remix(recipe: Recipe) {
  const total = recipe.ingredients.reduce((s, i) => s + i.parts, 0);
  return mixRgb(
    recipe.ingredients.map((i) => hexToRgb(i.clay.hex)),
    recipe.ingredients.map((i) => i.parts / total)
  );
}

describe("computeRecipesByColorCount", () => {
  it("returns nothing for an empty library", () => {
    expect(computeRecipesByColorCount([], "#123456")).toEqual([]);
  });

  it("uses a library color straight when it matches exactly", () => {
    const recipes = computeRecipesByColorCount(BASIC, "#FF0000");
    expect(recipes).toHaveLength(1);
    expect(names(recipes[0])).toEqual(["Red"]);
    expect(recipes[0].ratioLabel).toBe("1");
    expect(recipes[0].ingredients[0].percent).toBe(100);
    expect(recipes[0].predictedHex).toBe("#ff0000");
    expect(recipes[0].deltaE).toBe(0);
  });

  it("finds an even two-color mix", () => {
    // 50/50 white + black in RGB is #808080 (127.5 rounds up).
    const recipes = computeRecipesByColorCount(BASIC, "#808080");
    const best = recipes[recipes.length - 1];
    expect(names(best).sort()).toEqual(["Black", "White"]);
    expect(best.ratioLabel).toBe("1 : 1");
    expect(best.deltaE).toBeLessThan(0.5);
  });

  it("reduces whole-part ratios and lists the largest share first", () => {
    // 3 parts red, 1 part white.
    const target = rgbToHex(mixRgb([hexToRgb(RED.hex), hexToRgb(WHITE.hex)], [0.75, 0.25]));
    const recipes = computeRecipesByColorCount(BASIC, target);
    const best = recipes[recipes.length - 1];
    expect(names(best)).toEqual(["Red", "White"]);
    expect(best.ratioLabel).toBe("3 : 1");
    expect(best.ingredients.map((i) => i.percent)).toEqual([75, 25]);
  });

  it("finds a three-color mix when no pair gets close", () => {
    // 2 red : 1 yellow : 1 white — a warm peach out of reach of any pair.
    const target = rgbToHex(
      mixRgb(
        [hexToRgb(RED.hex), hexToRgb(YELLOW.hex), hexToRgb(WHITE.hex)],
        [0.5, 0.25, 0.25]
      )
    );
    const recipes = computeRecipesByColorCount(BASIC, target);
    const best = recipes[recipes.length - 1];
    expect(names(best).sort()).toEqual(["Red", "White", "Yellow"]);
    expect(best.deltaE).toBeLessThan(0.5);
  });

  it("adds a color only when it noticeably improves the match", () => {
    const recipes = computeRecipesByColorCount(seedLibrary(), "#7a5c8e");
    for (let i = 1; i < recipes.length; i++) {
      expect(recipes[i].ingredients.length).toBeGreaterThan(
        recipes[i - 1].ingredients.length
      );
      expect(recipes[i - 1].deltaE - recipes[i].deltaE).toBeGreaterThanOrEqual(0.5);
    }
  });

  it("never uses more colors than maxColors", () => {
    for (const maxColors of [1, 2, 3]) {
      const recipes = computeRecipesByColorCount(seedLibrary(), "#3d7a6b", { maxColors });
      expect(recipes.length).toBeGreaterThan(0);
      for (const r of recipes) {
        expect(r.ingredients.length).toBeLessThanOrEqual(maxColors);
      }
    }
  });

  it("picks the nearest single color when limited to one", () => {
    const [only] = computeRecipesByColorCount(BASIC, "#f01010", { maxColors: 1 });
    expect(names(only)).toEqual(["Red"]);
    const expected = deltaE(hexToLab("#f01010"), hexToLab("#ff0000"));
    expect(only.deltaE).toBeCloseTo(expected, 10);
  });

  it("gets as close as it can to a target outside the library's gamut", () => {
    // Green is unreachable without blue+yellow; the solver must stay non-negative.
    const recipes = computeRecipesByColorCount([RED, WHITE, BLACK], "#00ff00");
    expect(recipes.length).toBeGreaterThan(0);
    for (const r of recipes) {
      for (const ing of r.ingredients) expect(ing.parts).toBeGreaterThan(0);
    }
  });

  it("tolerates duplicate library colors", () => {
    const library = [WHITE, clay("White 2", "#ffffff"), BLACK];
    const recipes = computeRecipesByColorCount(library, "#808080");
    const best = recipes[recipes.length - 1];
    expect(best.deltaE).toBeLessThan(0.5);
    expect(best.ingredients).toHaveLength(2);
  });

  describe("every recipe from the seed library", () => {
    const library = seedLibrary();
    const targets = ["#7a5c8e", "#c48a3f", "#2b4a6f", "#e9c7c1", "#556b2f", "#101010"];

    it.each(targets)("is self-consistent for %s", (target) => {
      const recipes = computeRecipesByColorCount(library, target);
      expect(recipes.length).toBeGreaterThan(0);
      for (const r of recipes) {
        const parts = r.ingredients.map((i) => i.parts);
        expect(r.ratioLabel).toBe(parts.join(" : "));
        for (const p of parts) expect(Number.isInteger(p) && p >= 1).toBe(true);
        expect(parts.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(40);
        expect([...parts].sort((a, b) => b - a)).toEqual(parts);
        expect(r.ingredients.reduce((s, i) => s + i.percent, 0)).toBeCloseTo(100, 10);
        expect(new Set(r.ingredients.map((i) => i.clay.id)).size).toBe(parts.length);

        const mixed = remix(r);
        expect(r.predictedHex).toBe(rgbToHex(mixed));
        expect(r.deltaE).toBeCloseTo(deltaE(rgbToLab(mixed), hexToLab(target)), 10);
      }
    });

    it("matches mid-tone targets closely", () => {
      for (const target of targets) {
        const recipes = computeRecipesByColorCount(library, target);
        expect(recipes[recipes.length - 1].deltaE).toBeLessThan(5);
      }
    });
  });
});

describe("computeRecipe", () => {
  it("returns null for an empty library", () => {
    expect(computeRecipe([], "#ffffff")).toBeNull();
  });

  it("returns the closest recipe of up to three colors by default", () => {
    const library = seedLibrary();
    const byCount = computeRecipesByColorCount(library, "#7a5c8e", { maxColors: 3 });
    expect(computeRecipe(library, "#7a5c8e")).toEqual(byCount[byCount.length - 1]);
  });

  it("honors maxColors", () => {
    const recipe = computeRecipe(seedLibrary(), "#7a5c8e", { maxColors: 1 });
    expect(recipe!.ingredients).toHaveLength(1);
  });
});
