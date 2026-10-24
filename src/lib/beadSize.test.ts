import { describe, expect, it } from "vitest";
import { linkedSize, presetFor, sizeForLongSide } from "./beadSize";

describe("sizeForLongSide", () => {
  it("sets the long side and follows the aspect ratio", () => {
    expect(sizeForLongSide(800, 600, 25)).toEqual({ width: 25, height: 19 });
    expect(sizeForLongSide(600, 800, 40)).toEqual({ width: 30, height: 40 });
  });

  it("clamps the short side of a very wide image", () => {
    expect(sizeForLongSide(1000, 100, 15)).toEqual({ width: 15, height: 5 });
  });
});

describe("linkedSize", () => {
  it("updates the other side to keep the aspect ratio", () => {
    expect(linkedSize(800, 600, "width", 40)).toEqual({ width: 40, height: 30 });
  });

  it("clamps to the maximum while keeping the ratio", () => {
    expect(linkedSize(800, 600, "height", 200)).toEqual({ width: 100, height: 75 });
  });

  it("floors the short side at the minimum", () => {
    expect(linkedSize(800, 600, "width", 0)).toEqual({ width: 7, height: 5 });
  });

  it("treats a non-number as the minimum", () => {
    expect(linkedSize(800, 600, "width", NaN)).toEqual({ width: 7, height: 5 });
  });
});

describe("presetFor", () => {
  it("names the preset that produced a size", () => {
    expect(presetFor(800, 600, { width: 25, height: 19 })).toBe("medium");
  });

  it("is null for a custom size", () => {
    expect(presetFor(800, 600, { width: 26, height: 20 })).toBeNull();
  });
});
