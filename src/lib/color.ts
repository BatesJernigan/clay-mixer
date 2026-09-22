export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface Lab {
  l: number;
  a: number;
  b: number;
}

const HEX_RE = /^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

export function isValidHex(hex: string): boolean {
  return HEX_RE.test(hex.trim());
}

export function normalizeHex(hex: string): string {
  const trimmed = hex.trim().replace(/^#/, "");
  const expanded =
    trimmed.length === 3
      ? trimmed
          .split("")
          .map((c) => c + c)
          .join("")
      : trimmed;
  return `#${expanded.toLowerCase()}`;
}

export function hexToRgb(hex: string): RGB {
  const normalized = normalizeHex(hex).slice(1);
  const int = parseInt(normalized, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function srgbChannelToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function linearToXyz(rgb: RGB): { x: number; y: number; z: number } {
  const r = srgbChannelToLinear(rgb.r);
  const g = srgbChannelToLinear(rgb.g);
  const b = srgbChannelToLinear(rgb.b);
  return {
    x: r * 0.4124564 + g * 0.3575761 + b * 0.1804375,
    y: r * 0.2126729 + g * 0.7151522 + b * 0.072175,
    z: r * 0.0193339 + g * 0.119192 + b * 0.9503041,
  };
}

const D65 = { x: 0.95047, y: 1.0, z: 1.08883 };

function xyzToLab(xyz: { x: number; y: number; z: number }): Lab {
  const f = (t: number) =>
    t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const fx = f(xyz.x / D65.x);
  const fy = f(xyz.y / D65.y);
  const fz = f(xyz.z / D65.z);
  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

export function rgbToLab(rgb: RGB): Lab {
  return xyzToLab(linearToXyz(rgb));
}

export function hexToLab(hex: string): Lab {
  return rgbToLab(hexToRgb(hex));
}

export function deltaE(a: Lab, b: Lab): number {
  return Math.sqrt((a.l - b.l) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2);
}

export function mixRgb(colors: RGB[], weights: number[]): RGB {
  const totals = colors.reduce(
    (acc, c, i) => ({
      r: acc.r + c.r * weights[i],
      g: acc.g + c.g * weights[i],
      b: acc.b + c.b * weights[i],
    }),
    { r: 0, g: 0, b: 0 }
  );
  return totals;
}
