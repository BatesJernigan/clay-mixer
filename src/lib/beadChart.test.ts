import { describe, expect, it } from "vitest";
import { BeadChart, BeadChartOptions, buildBeadChart, shrinkImage } from "./beadChart";
import { PixelGrid, pixelHex } from "./palette";

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

const BLACK: RGBA = [0, 0, 0];
const WHITE: RGBA = [255, 255, 255];
const GRAY: RGBA = [128, 128, 128];
const RED: RGBA = [255, 0, 0];
const GREEN: RGBA = [0, 160, 0];
const BLUE: RGBA = [0, 0, 255];
const YELLOW: RGBA = [255, 230, 0];
const CLEAR: RGBA = [0, 0, 0, 0];

function options(overrides: Partial<BeadChartOptions> = {}): BeadChartOptions {
  return {
    width: 15,
    height: 15,
    colors: { mode: "bw" },
    removeBackground: true,
    outline: false,
    ...overrides,
  };
}

/** The bead name at a cell, or null when it is empty. */
function nameAt(chart: BeadChart, x: number, y: number): string | null {
  const c = chart.cells[y * chart.width + x];
  return c < 0 ? null : chart.palette[c].name;
}

function names(chart: BeadChart): (string | null)[] {
  return Array.from(chart.cells, (c) => (c < 0 ? null : chart.palette[c].name));
}

/** A `size`-pixel square of `inner`, centered on an `outer` image of `side` pixels. */
function square(side: number, size: number, inner: RGBA, outer: RGBA): PixelGrid {
  const lo = (side - size) / 2;
  return grid(side, side, (x, y) =>
    x >= lo && x < lo + size && y >= lo && y < lo + size ? inner : outer
  );
}

describe("shrinkImage", () => {
  it("halves a large image and keeps its colors", () => {
    const small = shrinkImage(grid(800, 400, (x) => (x < 400 ? RED : BLUE)), 400);
    expect([small.width, small.height]).toEqual([400, 200]);
    expect(pixelHex(small, 0, 0)).toBe("#ff0000");
    expect(pixelHex(small, 399, 199)).toBe("#0000ff");
  });

  it("never enlarges", () => {
    const small = shrinkImage(grid(100, 50, () => RED), 400);
    expect([small.width, small.height]).toEqual([100, 50]);
  });
});

describe("buildBeadChart background", () => {
  it("leaves a plain background empty and beads the subject", () => {
    const chart = buildBeadChart(square(30, 10, BLUE, WHITE), options());
    expect(nameAt(chart, 0, 0)).toBeNull();
    expect(nameAt(chart, 14, 14)).toBeNull();
    expect(nameAt(chart, 7, 7)).toBe("Black");
    expect(new Set(names(chart).filter((n) => n !== null))).toEqual(new Set(["Black"]));
  });

  it("beads every cell when background removal is off", () => {
    const chart = buildBeadChart(
      square(30, 10, RED, WHITE),
      options({ removeBackground: false })
    );
    expect(names(chart)).not.toContain(null);
    expect(nameAt(chart, 0, 0)).toBe("White");
  });

  it("always leaves transparent cells empty", () => {
    const chart = buildBeadChart(
      square(30, 10, RED, CLEAR),
      options({ removeBackground: false })
    );
    expect(nameAt(chart, 0, 0)).toBeNull();
    expect(nameAt(chart, 7, 7)).not.toBeNull();
  });

  it("finds no subject in a plain image, unless removal is off", () => {
    const img = grid(30, 30, () => GRAY);
    const removed = buildBeadChart(img, options());
    expect(removed.counts).toEqual([]);
    expect(names(removed).every((n) => n === null)).toBe(true);

    const kept = buildBeadChart(img, options({ removeBackground: false }));
    expect(kept.palette).toHaveLength(1);
    expect(names(kept)).not.toContain(null);
  });

  it("removes nothing when the border is busy", () => {
    const ring = [RED, GREEN, BLUE, YELLOW];
    const img = grid(30, 30, (x, y) => {
      if (x < 2 || y < 2 || x >= 28 || y >= 28) {
        return ring[(Math.floor(x / 2) + Math.floor(y / 2)) % ring.length];
      }
      return x >= 10 && x < 20 && y >= 10 && y < 20 ? BLACK : WHITE;
    });
    const chart = buildBeadChart(img, options());
    expect(names(chart)).not.toContain(null);
  });
});

describe("buildBeadChart black and white", () => {
  it("maps three bands to black, gray and white", () => {
    const img = grid(30, 30, (_x, y) => (y < 10 ? BLACK : y < 20 ? GRAY : WHITE));
    const chart = buildBeadChart(
      img,
      options({ colors: { mode: "bgw" }, removeBackground: false })
    );
    expect(chart.palette.map((b) => b.name)).toEqual(["Black", "White", "Gray"]);
    expect(nameAt(chart, 7, 0)).toBe("Black");
    expect(nameAt(chart, 7, 7)).toBe("Gray");
    expect(nameAt(chart, 7, 14)).toBe("White");
  });

  it("maps a single light shade to white", () => {
    const chart = buildBeadChart(square(30, 10, YELLOW, WHITE), options());
    expect(nameAt(chart, 7, 7)).toBe("White");
  });
});

describe("buildBeadChart", () => {
  it("fills every cell from an image smaller than the grid", () => {
    const img = grid(3, 3, (x, y) => ((x + y) % 2 ? BLACK : WHITE));
    const chart = buildBeadChart(img, options({ removeBackground: false }));
    expect(names(chart)).not.toContain(null);
  });

  it("counts every bead", () => {
    const chart = buildBeadChart(square(30, 10, RED, WHITE), options());
    const filled = Array.from(chart.cells).filter((c) => c >= 0).length;
    expect(chart.counts.reduce((a, b) => a + b, 0)).toBe(filled);
    expect(chart.counts).toHaveLength(chart.palette.length);
  });

  it("is deterministic", () => {
    const img = grid(40, 30, (x, y) => [x * 6, y * 8, (x * y) % 255]);
    const opts = options({ colors: { mode: "bgw" } });
    expect(buildBeadChart(img, opts).cells).toEqual(buildBeadChart(img, opts).cells);
  });
});
