import { describe, expect, it } from "vitest";
import {
  brandsOf,
  filterByBrands,
  formatBrandsParam,
  LEGACY_PREMO_BRAND,
  parseBrandsParam,
  resolveBrands,
  toggleBrand,
} from "./brandFilter";
import { PREMO_BRAND } from "./premoColors";

const ALL = ["Fimo", "Sculpey Premo", "Sculpey Souffle"];

describe("brandsOf", () => {
  it("lists each brand once, sorted", () => {
    expect(
      brandsOf([{ brand: "Sculpey Premo" }, { brand: "Fimo" }, { brand: "Sculpey Premo" }])
    ).toEqual(["Fimo", "Sculpey Premo"]);
  });
});

describe("resolveBrands", () => {
  it("keeps null as every brand", () => {
    expect(resolveBrands(null, ALL)).toBeNull();
  });

  it("drops brands the library doesn't have", () => {
    expect(resolveBrands(["Fimo", "Cernit"], ALL)).toEqual(["Fimo"]);
  });

  it("becomes null when nothing known is left", () => {
    expect(resolveBrands(["Cernit"], ALL)).toBeNull();
    expect(resolveBrands([], ALL)).toBeNull();
  });

  it("becomes null when every brand is selected", () => {
    expect(resolveBrands([...ALL].reverse(), ALL)).toBeNull();
  });

  it("maps the legacy Premo name to the current one", () => {
    expect(resolveBrands([LEGACY_PREMO_BRAND], ALL)).toEqual([PREMO_BRAND]);
  });

  it("leaves the selection alone before the library has loaded", () => {
    expect(resolveBrands(["Cernit"], [])).toEqual(["Cernit"]);
  });
});

describe("toggleBrand", () => {
  it("turning one off from every brand selects the rest", () => {
    expect(toggleBrand(null, "Fimo", ALL)).toEqual(["Sculpey Premo", "Sculpey Souffle"]);
  });

  it("turning the last missing brand back on returns to every brand", () => {
    expect(toggleBrand(["Sculpey Premo", "Sculpey Souffle"], "Fimo", ALL)).toBeNull();
  });

  it("won't turn off the only selected brand", () => {
    expect(toggleBrand(["Fimo"], "Fimo", ALL)).toEqual(["Fimo"]);
  });

  it("can't empty the selection with a single brand in the library", () => {
    expect(toggleBrand(null, "Fimo", ["Fimo"])).toBeNull();
  });
});

describe("filterByBrands", () => {
  const colors = [{ brand: "Fimo" }, { brand: "Sculpey Premo" }];

  it("passes everything through for null", () => {
    expect(filterByBrands(colors, null)).toBe(colors);
  });

  it("keeps only the selected brands", () => {
    expect(filterByBrands(colors, ["Fimo"])).toEqual([{ brand: "Fimo" }]);
  });
});

describe("parseBrandsParam / formatBrandsParam", () => {
  it("round-trips through URLSearchParams", () => {
    const value = formatBrandsParam(["Sculpey Premo", "Fimo & Co"]);
    expect(value).toBe("Sculpey%20Premo,Fimo%20%26%20Co");
    const params = new URLSearchParams(`brands=${value}`);
    expect(parseBrandsParam(params.get("brands"))).toEqual(["Sculpey Premo", "Fimo & Co"]);
  });

  it("treats missing or empty values as every brand", () => {
    expect(parseBrandsParam(null)).toBeNull();
    expect(parseBrandsParam("")).toBeNull();
    expect(parseBrandsParam(",,")).toBeNull();
    expect(formatBrandsParam(null)).toBeNull();
    expect(formatBrandsParam([])).toBeNull();
  });
});
