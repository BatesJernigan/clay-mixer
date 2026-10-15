import { ClayColor } from "./types";

/**
 * The full Sculpey Premo Oven Bake Clay color line, scraped from the color
 * swatch selector at sculpey.com. Hex values are sampled from the product's
 * official swatch photos, so they approximate the baked clay's appearance
 * rather than a manufacturer-published hex spec.
 * Source: https://www.sculpey.com/products/sculpey-premo%E2%84%A2-oven-bake-clay
 */
export const PREMO_BRAND = "Premo Sculpey";

const PRODUCT_URL =
  "https://www.sculpey.com/products/sculpey-premo%E2%84%A2-oven-bake-clay";

/** Links straight to one color (2 oz bar) on the product page. */
function variant(id: number): string {
  return `${PRODUCT_URL}?variant=${id}`;
}

export const premoColors: Omit<ClayColor, "id" | "createdAt">[] = [
  { brand: PREMO_BRAND, name: "White", hex: "#ffffff", url: variant(48151919689978) },
  { brand: PREMO_BRAND, name: "Frost White Glitter", hex: "#f0f1f1", url: variant(48151919722746) },
  { brand: PREMO_BRAND, name: "Pearl", hex: "#e6e2e0", url: variant(48151919755514) },
  { brand: PREMO_BRAND, name: "White Translucent", hex: "#f7d9a4", url: variant(48151919788282) },
  { brand: PREMO_BRAND, name: "Translucent", hex: "#ebcfa6", url: variant(48151919821050) },
  { brand: PREMO_BRAND, name: "Glow In The Dark", hex: "#efefa9", url: variant(48151919853818) },
  { brand: PREMO_BRAND, name: "Opal", hex: "#e2d9dc", url: variant(48151919886586) },
  { brand: PREMO_BRAND, name: "Beige", hex: "#f7c79e", url: variant(48151919919354) },
  { brand: PREMO_BRAND, name: "Ecru", hex: "#ddc48a", url: variant(48151919952122) },
  { brand: PREMO_BRAND, name: "Butter Yellow", hex: "#fdf2c1", url: variant(48440116805882) },
  { brand: PREMO_BRAND, name: "Sunshine", hex: "#fff45f", url: variant(48151919984890) },
  { brand: PREMO_BRAND, name: "Fluorescent Yellow", hex: "#e1f508", url: variant(48151920017658) },
  { brand: PREMO_BRAND, name: "Zinc Yellow Hue", hex: "#ffee05", url: variant(48151920050426) },
  { brand: PREMO_BRAND, name: "Cadmium Yellow Hue", hex: "#f0d327", url: variant(48151920083194) },
  { brand: PREMO_BRAND, name: "Yellow Gold Glitter", hex: "#aa986e", url: variant(48151920115962) },
  { brand: PREMO_BRAND, name: "Mustard Yellow", hex: "#eb9717", url: variant(48151920148730) },
  { brand: PREMO_BRAND, name: "Orange", hex: "#fa6604", url: variant(48151920181498) },
  { brand: PREMO_BRAND, name: "Burnt Orange", hex: "#e86a35", url: variant(48151920214266) },
  { brand: PREMO_BRAND, name: "Rose Gold Glitter", hex: "#9a746b", url: variant(48151920247034) },
  { brand: PREMO_BRAND, name: "Light Pink", hex: "#fee0d6", url: variant(48151920279802) },
  { brand: PREMO_BRAND, name: "Rose Gold Metallic", hex: "#e9b0aa", url: variant(48151920312570) },
  { brand: PREMO_BRAND, name: "Blush", hex: "#e47782", url: variant(48151920345338) },
  { brand: PREMO_BRAND, name: "Fluorescent Pink", hex: "#fa0467", url: variant(48151920410874) },
  { brand: PREMO_BRAND, name: "Fuchsia", hex: "#ab0777", url: variant(48151920443642) },
  { brand: PREMO_BRAND, name: "Cadmium Red Hue", hex: "#cb191a", url: variant(48151920476410) },
  { brand: PREMO_BRAND, name: "Pomegranate", hex: "#9c1030", url: variant(48151920509178) },
  { brand: PREMO_BRAND, name: "Alizarin Crimson Hue", hex: "#670d22", url: variant(48151920541946) },
  { brand: PREMO_BRAND, name: "Lavender", hex: "#c0b7d3", url: variant(48151920574714) },
  { brand: PREMO_BRAND, name: "Mauve", hex: "#916586", url: variant(48151920607482) },
  { brand: PREMO_BRAND, name: "Purple Pearl", hex: "#83357e", url: variant(48151920640250) },
  { brand: PREMO_BRAND, name: "Purple", hex: "#570c63", url: variant(48151920673018) },
  { brand: PREMO_BRAND, name: "Pale Blue", hex: "#8bcadb", url: variant(48151920705786) },
  { brand: PREMO_BRAND, name: "Turquoise", hex: "#02a5a9", url: variant(48151920738554) },
  { brand: PREMO_BRAND, name: "Turquoise Granite", hex: "#92c3c2", url: variant(48151920771322) },
  { brand: PREMO_BRAND, name: "Peacock Pearl", hex: "#116b75", url: variant(48151920804090) },
  { brand: PREMO_BRAND, name: "Teal", hex: "#028b95", url: variant(48151920836858) },
  { brand: PREMO_BRAND, name: "Cobalt Blue Hue", hex: "#05168c", url: variant(48151920869626) },
  { brand: PREMO_BRAND, name: "Ultramarine Blue Hue", hex: "#29325d", url: variant(48151920902394) },
  { brand: PREMO_BRAND, name: "Navy", hex: "#0c3f8e", url: variant(48151920935162) },
  { brand: PREMO_BRAND, name: "Galaxy Glitter", hex: "#204b6a", url: variant(48151920967930) },
  { brand: PREMO_BRAND, name: "Mint Green", hex: "#95f0d2", url: variant(48151921000698) },
  { brand: PREMO_BRAND, name: "Sage", hex: "#abb4b1", url: variant(48151921033466) },
  { brand: PREMO_BRAND, name: "Bright Green Pearl", hex: "#7fa546", url: variant(48151921066234) },
  { brand: PREMO_BRAND, name: "Green", hex: "#189519", url: variant(48151921099002) },
  { brand: PREMO_BRAND, name: "Wasabi", hex: "#ddf109", url: variant(48151921131770) },
  { brand: PREMO_BRAND, name: "Spanish Olive", hex: "#67823c", url: variant(48151921164538) },
  { brand: PREMO_BRAND, name: "Forest Green", hex: "#015e43", url: variant(48151921197306) },
  { brand: PREMO_BRAND, name: "18K Gold", hex: "#f7a734", url: variant(48151921230074) },
  { brand: PREMO_BRAND, name: "Copper", hex: "#d48b65", url: variant(48151921262842) },
  { brand: PREMO_BRAND, name: "Gold", hex: "#d48b23", url: variant(48151921295610) },
  { brand: PREMO_BRAND, name: "Terra Cotta", hex: "#b15a3f", url: variant(48151921328378) },
  { brand: PREMO_BRAND, name: "Raw Sienna", hex: "#9b4f19", url: variant(48151921361146) },
  { brand: PREMO_BRAND, name: "Burnt Umber", hex: "#391508", url: variant(48151921393914) },
  { brand: PREMO_BRAND, name: "Bronze", hex: "#863d2c", url: variant(48151921426682) },
  { brand: PREMO_BRAND, name: "Antique Gold", hex: "#ab7f14", url: variant(48151921459450) },
  { brand: PREMO_BRAND, name: "White Gold Glitter", hex: "#9d9b9c", url: variant(48151921492218) },
  { brand: PREMO_BRAND, name: "Silver", hex: "#6b6b6b", url: variant(48151921524986) },
  { brand: PREMO_BRAND, name: "Gray Granite", hex: "#95979a", url: variant(48151921557754) },
  { brand: PREMO_BRAND, name: "Slate", hex: "#6d6966", url: variant(48151921590522) },
  { brand: PREMO_BRAND, name: "Graphite Pearl", hex: "#353233", url: variant(48151921623290) },
  { brand: PREMO_BRAND, name: "Twinkle Twinkle", hex: "#0f0d0c", url: variant(48151921656058) },
  { brand: PREMO_BRAND, name: "Black", hex: "#000000", url: variant(48151921688826) },
];
