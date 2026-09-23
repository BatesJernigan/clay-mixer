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

export const winterCollection: PresetCollection = {
  slug: "winter",
  title: "Winter Mixes",
  intro:
    "Cool, hushed shades pulled from frost, evergreen, and fireside red. Each one is solved live against your current clay library, so the recipe updates automatically as your collection changes.",
  mixes: [
    {
      name: "Midnight Snowfall",
      description: "The deep blue-black of a sky between snow showers.",
      targetHex: "#232b3a",
    },
    {
      name: "Icy Glacier Blue",
      description: "Pale, glassy blue like light through old glacier ice.",
      targetHex: "#a9d3e5",
    },
    {
      name: "Frosted Pine",
      description: "Evergreen needles dusted white with frost.",
      targetHex: "#3c5a4a",
    },
    {
      name: "Holly Berry Red",
      description: "Bright, waxy red berries against winter greenery.",
      targetHex: "#a4193d",
    },
    {
      name: "Silver Birch Bark",
      description: "Cool pale grey with a whisper of warmth, like birch bark.",
      targetHex: "#c6c6c4",
    },
    {
      name: "Fireside Amber",
      description: "The warm glow of embers on a cold winter night.",
      targetHex: "#c1652b",
    },
    {
      name: "Slate Sky Grey",
      description: "A heavy, overcast sky before the first snow.",
      targetHex: "#5c6670",
    },
    {
      name: "Cranberry Sweater",
      description: "Deep, cozy cranberry red for knitwear and holiday trim.",
      targetHex: "#7c2231",
    },
  ],
};

export const springCollection: PresetCollection = {
  slug: "spring",
  title: "Spring Mixes",
  intro:
    "Fresh, blooming pastels and greens for the first warm weeks of the year. Each one is solved live against your current clay library, so the recipe updates automatically as your collection changes.",
  mixes: [
    {
      name: "Cherry Blossom Blush",
      description: "The soft pink of blossoms just starting to open.",
      targetHex: "#d9b8ba",
    },
    {
      name: "Fresh Mint Sprout",
      description: "The bright, tender green of a new seedling.",
      targetHex: "#6fbf8b",
    },
    {
      name: "Lilac Garden",
      description: "Dusky purple lilac clusters in early bloom.",
      targetHex: "#b09cb9",
    },
    {
      name: "Daffodil Yellow",
      description: "Cheerful, sunlit yellow of the first daffodils.",
      targetHex: "#f4c430",
    },
    {
      name: "Robin's Egg Sky",
      description: "A clear pale-blue spring sky.",
      targetHex: "#8fcfe0",
    },
    {
      name: "Tulip Coral",
      description: "The warm coral-pink of a tulip petal.",
      targetHex: "#f4735e",
    },
    {
      name: "New Grass Green",
      description: "Bright new lawn after the first spring rain.",
      targetHex: "#82a54a",
    },
    {
      name: "Peony Pink",
      description: "Full, saturated pink from an heirloom peony bloom.",
      targetHex: "#e0598b",
    },
  ],
};

export const summerCollection: PresetCollection = {
  slug: "summer",
  title: "Summer Mixes",
  intro:
    "Bold, saturated shades from long days outdoors. Each one is solved live against your current clay library, so the recipe updates automatically as your collection changes.",
  mixes: [
    {
      name: "Ocean Wave Blue",
      description: "Deep, clear blue from a rolling summer wave.",
      targetHex: "#1b7fbf",
    },
    {
      name: "Tropical Sunset Orange",
      description: "Bright orange from a sky at the end of a beach day.",
      targetHex: "#f97139",
    },
    {
      name: "Watermelon Punch",
      description: "Juicy pink-red straight from a summer watermelon.",
      targetHex: "#f76c82",
    },
    {
      name: "Golden Sand Beach",
      description: "Warm, sun-baked sand between your toes.",
      targetHex: "#e3bf80",
    },
    {
      name: "Poolside Turquoise",
      description: "Bright turquoise water on a hot afternoon.",
      targetHex: "#22b6c4",
    },
    {
      name: "Mango Sorbet",
      description: "Sweet, vivid orange-yellow of a frozen mango treat.",
      targetHex: "#ffb238",
    },
    {
      name: "Citrus Lime Zest",
      description: "Sharp, zesty green-yellow from fresh lime peel.",
      targetHex: "#a8c93a",
    },
    {
      name: "Coral Reef Pink",
      description: "Warm coral pink pulled from a sunlit reef.",
      targetHex: "#ff7f6e",
    },
  ],
};

export const presetCollections: PresetCollection[] = [
  autumnCollection,
  winterCollection,
  springCollection,
  summerCollection,
];
