import { describe, expect, it } from "vitest";
import {
  complementaryHex,
  deltaE,
  hexToLab,
  hexToRgb,
  hslToRgb,
  isValidHex,
  mixRgb,
  normalizeHex,
  rgbToHex,
  rgbToHsl,
  rgbToLab,
} from "./color";

describe("isValidHex", () => {
  it.each(["#ff0000", "ff0000", "#F0a", "abc", "  #123456  ", "#ABCDEF"])(
    "accepts %j",
    (hex) => expect(isValidHex(hex)).toBe(true)
  );

  it.each(["", "#", "#12", "#1234", "#12345", "#1234567", "#ggg", "##fff", "red"])(
    "rejects %j",
    (hex) => expect(isValidHex(hex)).toBe(false)
  );
});

describe("normalizeHex", () => {
  it("lowercases and adds the leading #", () => {
    expect(normalizeHex("AbCdEf")).toBe("#abcdef");
  });

  it("expands shorthand by doubling each digit", () => {
    expect(normalizeHex("#F0a")).toBe("#ff00aa");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeHex("  #123456 ")).toBe("#123456");
  });
});

describe("hexToRgb", () => {
  it("splits the hex into channels", () => {
    expect(hexToRgb("#e8394f")).toEqual({ r: 0xe8, g: 0x39, b: 0x4f });
  });

  it("handles shorthand and missing #", () => {
    expect(hexToRgb("fa0")).toEqual({ r: 255, g: 170, b: 0 });
  });

  it("reads the extremes", () => {
    expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
  });
});

describe("rgbToHex", () => {
  it("pads single-digit channels", () => {
    expect(rgbToHex({ r: 1, g: 2, b: 15 })).toBe("#01020f");
  });

  it("rounds fractional channels", () => {
    expect(rgbToHex({ r: 127.5, g: 127.49, b: 0.5 })).toBe("#807f01");
  });

  it("clamps out-of-range channels", () => {
    expect(rgbToHex({ r: -20, g: 300, b: 255.6 })).toBe("#00ffff");
  });

  it("round-trips every value of each channel", () => {
    for (let v = 0; v < 256; v++) {
      const hex = rgbToHex({ r: v, g: 255 - v, b: (v * 7) % 256 });
      expect(rgbToHex(hexToRgb(hex))).toBe(hex);
    }
  });
});

describe("rgbToLab / hexToLab", () => {
  it("maps white to L=100 and black to L=0, both neutral", () => {
    const white = hexToLab("#ffffff");
    expect(white.l).toBeCloseTo(100, 2);
    expect(white.a).toBeCloseTo(0, 2);
    expect(white.b).toBeCloseTo(0, 2);

    const black = hexToLab("#000000");
    expect(black.l).toBeCloseTo(0, 5);
    expect(black.a).toBeCloseTo(0, 5);
    expect(black.b).toBeCloseTo(0, 5);
  });

  it("matches published CIELAB values for the sRGB primaries", () => {
    const red = rgbToLab({ r: 255, g: 0, b: 0 });
    expect(red.l).toBeCloseTo(53.24, 1);
    expect(red.a).toBeCloseTo(80.09, 1);
    expect(red.b).toBeCloseTo(67.2, 1);

    const green = rgbToLab({ r: 0, g: 255, b: 0 });
    expect(green.l).toBeCloseTo(87.73, 1);
    expect(green.a).toBeCloseTo(-86.18, 1);
    expect(green.b).toBeCloseTo(83.18, 1);

    const blue = rgbToLab({ r: 0, g: 0, b: 255 });
    expect(blue.l).toBeCloseTo(32.3, 1);
    expect(blue.a).toBeCloseTo(79.19, 1);
    expect(blue.b).toBeCloseTo(-107.86, 1);
  });

  it("keeps grays neutral and lightness increasing", () => {
    let lastL = -1;
    for (let v = 0; v <= 255; v += 17) {
      const lab = rgbToLab({ r: v, g: v, b: v });
      expect(Math.abs(lab.a)).toBeLessThan(0.01);
      expect(Math.abs(lab.b)).toBeLessThan(0.01);
      expect(lab.l).toBeGreaterThan(lastL);
      lastL = lab.l;
    }
  });

  it("is continuous across the dark-channel linearization cutoff", () => {
    // sRGB switches formulas at 0.04045 (channel ~10.3); neighbors stay close.
    const a = rgbToLab({ r: 10, g: 10, b: 10 });
    const b = rgbToLab({ r: 11, g: 11, b: 11 });
    expect(b.l - a.l).toBeGreaterThan(0);
    expect(b.l - a.l).toBeLessThan(0.5);
  });
});

describe("deltaE", () => {
  it("is zero for identical colors", () => {
    const lab = hexToLab("#e8394f");
    expect(deltaE(lab, lab)).toBe(0);
  });

  it("is symmetric", () => {
    const a = hexToLab("#e8394f");
    const b = hexToLab("#1e3a5f");
    expect(deltaE(a, b)).toBe(deltaE(b, a));
  });

  it("is the Euclidean distance in Lab", () => {
    expect(deltaE({ l: 0, a: 0, b: 0 }, { l: 3, a: 4, b: 12 })).toBe(13);
  });

  it("measures black to white as 100", () => {
    expect(deltaE(hexToLab("#000"), hexToLab("#fff"))).toBeCloseTo(100, 2);
  });

  it("ranks a near color closer than a far one", () => {
    const target = hexToLab("#c1272d");
    expect(deltaE(target, hexToLab("#b8232a"))).toBeLessThan(
      deltaE(target, hexToLab("#9c1f34"))
    );
  });
});

describe("rgbToHsl / hslToRgb", () => {
  it("converts the primaries", () => {
    expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 1, l: 0.5 });
    const green = rgbToHsl({ r: 0, g: 255, b: 0 });
    expect(green.h).toBeCloseTo(1 / 3);
    const blue = rgbToHsl({ r: 0, g: 0, b: 255 });
    expect(blue.h).toBeCloseTo(2 / 3);
  });

  it("gives grays zero hue and saturation", () => {
    expect(rgbToHsl({ r: 128, g: 128, b: 128 })).toEqual({
      h: 0,
      s: 0,
      l: 128 / 255,
    });
    expect(hslToRgb({ h: 0.7, s: 0, l: 0.5 })).toEqual({ r: 128, g: 128, b: 128 });
  });

  it("wraps magenta-side hues into [0, 1)", () => {
    const hsl = rgbToHsl({ r: 255, g: 0, b: 128 });
    expect(hsl.h).toBeGreaterThan(0.8);
    expect(hsl.h).toBeLessThan(1);
  });

  it("round-trips a sweep of colors exactly", () => {
    for (let r = 0; r < 256; r += 51) {
      for (let g = 0; g < 256; g += 51) {
        for (let b = 0; b < 256; b += 51) {
          expect(hslToRgb(rgbToHsl({ r, g, b }))).toEqual({ r, g, b });
        }
      }
    }
  });
});

describe("complementaryHex", () => {
  it.each([
    ["#ff0000", "#00ffff"],
    ["#00ff00", "#ff00ff"],
    ["#0000ff", "#ffff00"],
  ])("maps %s to %s", (hex, expected) => {
    expect(complementaryHex(hex)).toBe(expected);
  });

  it("leaves grays unchanged", () => {
    expect(complementaryHex("#808080")).toBe("#808080");
  });

  it("returns the original color when applied twice", () => {
    for (const hex of ["#e8394f", "#1e3a5f", "#f6e13c", "#5a0f12"]) {
      const twice = hexToRgb(complementaryHex(complementaryHex(hex)));
      const original = hexToRgb(hex);
      expect(Math.abs(twice.r - original.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(twice.g - original.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(twice.b - original.b)).toBeLessThanOrEqual(1);
    }
  });
});

describe("mixRgb", () => {
  it("returns the weighted sum of channels", () => {
    expect(
      mixRgb(
        [
          { r: 255, g: 0, b: 0 },
          { r: 0, g: 0, b: 255 },
        ],
        [0.5, 0.5]
      )
    ).toEqual({ r: 127.5, g: 0, b: 127.5 });
  });

  it("returns the color itself at full weight", () => {
    const c = { r: 12, g: 34, b: 56 };
    expect(mixRgb([c, { r: 255, g: 255, b: 255 }], [1, 0])).toEqual(c);
  });

  it("handles three-way mixes", () => {
    const mix = mixRgb(
      [
        { r: 255, g: 255, b: 255 },
        { r: 0, g: 0, b: 0 },
        { r: 255, g: 0, b: 0 },
      ],
      [0.25, 0.25, 0.5]
    );
    expect(mix).toEqual({ r: 191.25, g: 63.75, b: 63.75 });
  });
});
