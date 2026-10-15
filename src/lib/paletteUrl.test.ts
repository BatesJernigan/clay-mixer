import { describe, expect, it } from "vitest";
import {
  buildPaletteSearch,
  DEFAULT_MIN_PERCENT,
  parsePaletteSearch,
  PaletteUrlState,
} from "./paletteUrl";

const IMG = "https://m.media-amazon.com/images/I/81OBhRM2tjL._SL1500_.jpg";

describe("buildPaletteSearch / parsePaletteSearch", () => {
  it("round-trips the full state", () => {
    const state: PaletteUrlState = {
      img: IMG,
      minPercent: 4,
      added: [
        { x: 412, y: 880 },
        { x: 95, y: 1200 },
      ],
      hidden: ["5a0f12", "ee3a4b"],
    };
    const search = buildPaletteSearch(state);
    expect(search).toBe(
      `?img=${encodeURIComponent(IMG)}&min=4&add=412,880;95,1200&hide=5a0f12,ee3a4b`
    );
    expect(parsePaletteSearch(search)).toEqual(state);
  });

  it("omits empty add and hide lists", () => {
    expect(
      buildPaletteSearch({ img: IMG, minPercent: 3, added: [], hidden: [] })
    ).toBe(`?img=${encodeURIComponent(IMG)}&min=3`);
  });

  it("round-trips image URLs that have their own query string", () => {
    const img = "https://example.com/pic.jpg?w=800&h=600";
    const search = buildPaletteSearch({ img, minPercent: 3, added: [], hidden: [] });
    expect(parsePaletteSearch(search)?.img).toBe(img);
  });
});

describe("parsePaletteSearch", () => {
  it("returns null without a usable image URL", () => {
    expect(parsePaletteSearch("")).toBeNull();
    expect(parsePaletteSearch("?min=3")).toBeNull();
    expect(parsePaletteSearch("?img=not-a-url")).toBeNull();
  });

  it("defaults or clamps a bad minimum share", () => {
    const img = `img=${encodeURIComponent(IMG)}`;
    expect(parsePaletteSearch(`?${img}`)?.minPercent).toBe(DEFAULT_MIN_PERCENT);
    expect(parsePaletteSearch(`?${img}&min=abc`)?.minPercent).toBe(DEFAULT_MIN_PERCENT);
    expect(parsePaletteSearch(`?${img}&min=50`)?.minPercent).toBe(10);
    expect(parsePaletteSearch(`?${img}&min=0`)?.minPercent).toBe(1);
    expect(parsePaletteSearch(`?${img}&min=2.6`)?.minPercent).toBe(3);
  });

  it("skips malformed points and hexes but keeps the good ones", () => {
    const parsed = parsePaletteSearch(
      `?img=${encodeURIComponent(IMG)}&add=10,20;oops;-5,3;7,8,9;30,40&hide=5A0F12,zzzzzz,123`
    );
    expect(parsed?.added).toEqual([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ]);
    expect(parsed?.hidden).toEqual(["5a0f12"]);
  });
});
