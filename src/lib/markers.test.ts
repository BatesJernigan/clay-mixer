import { describe, expect, it } from "vitest";
import { buildMarkers, markerLabel } from "./markers";
import { PaletteColor, PixelGrid } from "./palette";

describe("markerLabel", () => {
  it("counts A–Z, then AA, AB…", () => {
    expect([0, 1, 25, 26, 27, 51, 52].map(markerLabel)).toEqual([
      "A",
      "B",
      "Z",
      "AA",
      "AB",
      "AZ",
      "BA",
    ]);
  });
});

describe("buildMarkers", () => {
  // 4×2 image: top row red, bottom row blue.
  const data = new Uint8ClampedArray(4 * 2 * 4);
  for (let i = 0; i < 8; i++) data.set(i < 4 ? [255, 0, 0, 255] : [0, 0, 255, 255], i * 4);
  const pixels: PixelGrid = { width: 4, height: 2, data };

  const scanned: PaletteColor[] = [
    { hex: "#ee3a4b", share: 0.56, x: 1, y: 0 },
    { hex: "#60050a", share: 0.3, x: 2, y: 1 },
  ];

  it("letters scanned colors first, then picks in the order added", () => {
    const markers = buildMarkers(scanned, [{ x: 3, y: 1 }], [], pixels);
    expect(markers.map((m) => [m.label, m.hex, m.source, m.share])).toEqual([
      ["A", "#ee3a4b", "scan", 0.56],
      ["B", "#60050a", "scan", 0.3],
      ["C", "#0000ff", "pick", null],
    ]);
  });

  it("drops hidden scanned colors and reletters the rest", () => {
    const markers = buildMarkers(scanned, [{ x: 0, y: 0 }], ["ee3a4b"], pixels);
    expect(markers.map((m) => [m.label, m.hex])).toEqual([
      ["A", "#60050a"],
      ["B", "#ff0000"],
    ]);
  });

  it("drops picks outside the image, as from a link made for another image", () => {
    const markers = buildMarkers([], [{ x: 4, y: 0 }, { x: 0, y: 2 }, { x: 1, y: 1 }], [], pixels);
    expect(markers.map((m) => [m.x, m.y])).toEqual([[1, 1]]);
  });

  it("gives every marker a distinct key", () => {
    const markers = buildMarkers(scanned, [{ x: 0, y: 0 }, { x: 1, y: 0 }], [], pixels);
    expect(new Set(markers.map((m) => m.key)).size).toBe(markers.length);
  });
});
