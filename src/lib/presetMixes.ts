export interface PresetMix {
  name: string;
  description: string;
  targetHex: string;
}

export interface PresetCollection {
  slug: string;
  title: string;
  intro: string;
  mixes: PresetMix[];
}

export const autumnCollection: PresetCollection = {
  slug: "autumn",
  title: "Autumn Mixes",
  intro:
    "Warm, earthy target shades for fall-themed projects. Each one is solved live against your current clay library, so the recipe updates automatically as your collection changes.",
  mixes: [
    {
      name: "Pumpkin Patch",
      description: "A ripe, glowing jack-o'-lantern orange.",
      targetHex: "#e2721c",
    },
    {
      name: "Maple Leaf",
      description: "The brick-red-orange of a maple leaf just past peak.",
      targetHex: "#b8481f",
    },
    {
      name: "Cinnamon Spice Latte",
      description: "Warm cinnamon stirred into a milky latte tan.",
      targetHex: "#a9714a",
    },
    {
      name: "Harvest Wheat Field",
      description: "Sun-bleached wheat swaying in a fall breeze.",
      targetHex: "#d9b26a",
    },
    {
      name: "Goldenrod Meadow",
      description: "The last wildflowers before the frost, deep and golden.",
      targetHex: "#d6a520",
    },
    {
      name: "Burnt Sienna Sunset",
      description: "A low autumn sun bleeding rust and orange across the sky.",
      targetHex: "#b4562c",
    },
    {
      name: "Toasted Acorn Brown",
      description: "The deep, matte brown of an acorn cap underfoot.",
      targetHex: "#6f4726",
    },
    {
      name: "Mossy Forest Floor",
      description: "Damp olive-green moss on a shaded forest floor.",
      targetHex: "#6d6b3f",
    },
    {
      name: "Spiced Plum Harvest",
      description: "Late-season plums, deep and wine-dark.",
      targetHex: "#6d3550",
    },
    {
      name: "Cranberry Bog",
      description: "Tart, saturated cranberry red for holiday accents.",
      targetHex: "#8a1f2d",
    },
  ],
};

export const presetCollections: PresetCollection[] = [autumnCollection];
