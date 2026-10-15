import { describe, expect, it } from "vitest";
import { fitWithin, imageFromClipboard, parseImageUrl } from "./imageSource";

describe("parseImageUrl", () => {
  it("accepts http(s) URLs and trims whitespace", () => {
    expect(
      parseImageUrl("  https://m.media-amazon.com/images/I/81OBhRM2tjL._SL1500_.jpg \n")
    ).toBe("https://m.media-amazon.com/images/I/81OBhRM2tjL._SL1500_.jpg");
    expect(parseImageUrl("http://example.com/a.webp")).toBe("http://example.com/a.webp");
  });

  it("rejects text that isn't an http(s) URL", () => {
    expect(parseImageUrl("")).toBeNull();
    expect(parseImageUrl("m.media-amazon.com/images/x.jpg")).toBeNull();
    expect(parseImageUrl("javascript:alert(1)")).toBeNull();
    expect(parseImageUrl("data:image/png;base64,AAAA")).toBeNull();
  });
});

describe("fitWithin", () => {
  it("leaves images that already fit alone", () => {
    expect(fitWithin(1000, 1500, 4096)).toEqual({ width: 1000, height: 1500 });
  });

  it("scales the long side down to the limit, keeping the aspect ratio", () => {
    expect(fitWithin(8000, 6000, 4096)).toEqual({ width: 4096, height: 3072 });
    expect(fitWithin(3000, 9000, 4096)).toEqual({ width: 1365, height: 4096 });
  });

  it("never rounds a side down to zero", () => {
    expect(fitWithin(1, 10000, 4096)).toEqual({ width: 1, height: 4096 });
  });
});

describe("imageFromClipboard", () => {
  const item = (kind: string, type: string, file: File | null = null) => ({
    kind,
    type,
    getAsFile: () => file,
  });

  it("returns null without clipboard data", () => {
    expect(imageFromClipboard(null)).toBeNull();
  });

  it("returns null for text-only pastes, so pasting into the URL field still works", () => {
    expect(
      imageFromClipboard({
        items: [item("string", "text/plain"), item("string", "text/html")],
      })
    ).toBeNull();
  });

  it("returns the first image file", () => {
    const png = new File([new Uint8Array([1])], "image.png", { type: "image/png" });
    expect(
      imageFromClipboard({
        items: [item("string", "text/html"), item("file", "image/png", png)],
      })
    ).toBe(png);
  });

  it("ignores non-image files", () => {
    const pdf = new File([new Uint8Array([1])], "doc.pdf", { type: "application/pdf" });
    expect(
      imageFromClipboard({ items: [item("file", "application/pdf", pdf)] })
    ).toBeNull();
  });
});
