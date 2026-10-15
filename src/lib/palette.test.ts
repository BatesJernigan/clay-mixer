import { describe, expect, it } from "vitest";
import { analyzeImage, extractPalette, pixelHex, PixelGrid } from "./palette";

type RGBA = [number, number, number, number?];

function grid(
  width: number,
  height: number,
  colorAt: (x: number, y: number) => RGBA
): PixelGrid {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a = 255] = colorAt(x, y);
      data.set([r, g, b, a], (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

const RED: RGBA = [255, 0, 0];
const BLUE: RGBA = [0, 0, 255];
const GREEN: RGBA = [0, 160, 0];
const CORAL: RGBA = [0xe8, 0x39, 0x4f];
const MAROON: RGBA = [0x5a, 0x0f, 0x12];
const MID: RGBA = [0xa1, 0x24, 0x30]; // halfway between coral and maroon
const CLEAR: RGBA = [0, 0, 0, 0];

describe("analyzeImage", () => {
  it("recovers solid blocks with exact hexes and shares", () => {
    const img = grid(100, 100, (x) => (x < 50 ? RED : BLUE));
    const colors = extractPalette(analyzeImage(img), { minShare: 0.03 });
    expect(colors.map((c) => [c.hex, c.share])).toEqual([
      ["#0000ff", 0.5],
      ["#ff0000", 0.5],
    ]);
  });

  it("keeps a solid band of an in-between color", () => {
    const img = grid(90, 90, (_x, y) => (y < 35 ? CORAL : y < 55 ? MID : MAROON));
    const colors = extractPalette(analyzeImage(img), { minShare: 0.03 });
    expect(colors.map((c) => c.hex).sort()).toEqual([
      "#5a0f12",
      "#a12430",
      "#e8394f",
    ]);
  });

  it("places the dot inside the largest patch, in original-image coordinates", () => {
    // 400px wide, so the analysis runs on a 200px copy and must scale back up.
    const img = grid(400, 400, (x, y) =>
      (x >= 200 && x < 320 && y >= 40 && y < 160) || (x < 20 && y >= 380)
        ? BLUE
        : RED
    );
    const blue = analyzeImage(img).colors.find((c) => c.hex === "#0000ff")!;
    // Center of the big square is (260, 100); allow a few px either way.
    expect(blue.x).toBeGreaterThanOrEqual(240);
    expect(blue.x).toBeLessThan(280);
    expect(blue.y).toBeGreaterThanOrEqual(80);
    expect(blue.y).toBeLessThan(120);
  });

  it("ignores transparent pixels", () => {
    const img = grid(100, 100, (x) => (x < 50 ? CLEAR : RED));
    expect(analyzeImage(img).colors.map((c) => [c.hex, c.share])).toEqual([
      ["#ff0000", 1],
    ]);
  });

  it("returns no colors for a fully transparent image", () => {
    expect(analyzeImage(grid(10, 10, () => CLEAR)).colors).toEqual([]);
  });

  it("handles a 1×1 image", () => {
    expect(analyzeImage(grid(1, 1, () => RED)).colors).toEqual([
      { hex: "#ff0000", share: 1, x: 0, y: 0 },
    ]);
  });

  it("is deterministic, so shared links reproduce the same palette", () => {
    const img = grid(300, 200, (x, y) => [
      (x * 7) % 256,
      (y * 5) % 256,
      ((x + y) * 3) % 256,
    ]);
    expect(analyzeImage(img)).toEqual(analyzeImage(img));
  });
});

describe("extractPalette", () => {
  it("drops colors below the minimum share", () => {
    const img = grid(100, 100, (x, y) => (x < 20 && y < 10 ? GREEN : RED)); // green = 2%
    const analysis = analyzeImage(img);
    expect(extractPalette(analysis, { minShare: 0.03 }).map((c) => c.hex)).toEqual([
      "#ff0000",
    ]);
    expect(extractPalette(analysis, { minShare: 0.01 }).map((c) => c.hex)).toEqual([
      "#ff0000",
      "#00a000",
    ]);
  });
});

describe("pixelHex", () => {
  it("reads one pixel", () => {
    expect(pixelHex(grid(2, 1, (x) => (x ? BLUE : RED)), 1, 0)).toBe("#0000ff");
  });
});
