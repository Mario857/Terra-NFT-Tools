const axios = require("axios");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;

const csvWriter = createCsvWriter({
  path: "skeleton-punks-rarity.csv",
  header: [
    { id: "tokenId", title: "SP Number" },
    { id: "imageURL", title: "ImageUrl" },
    { id: "name", title: "Name" },

    { id: "Background", title: "Background" },
    { id: "Skull", title: "Skull" },
    { id: "Eyes", title: "Eyes" },
    { id: "Clothes", title: "Clothes" },
    { id: "Headwear", title: "Headwear" },
    { id: "Accessory", title: "Accessory" },

    { id: "BackgroundRarity", title: "Background" },
    { id: "SkullRarity", title: "Skull" },
    { id: "EyesRarity", title: "Eyes" },
    { id: "ClothesRarity", title: "Clothes" },
    { id: "HeadwearRarity", title: "Headwear" },
    { id: "AccessoryRarity", title: "Accessory" },

    { id: "price", title: "Price" },
    { id: "sortPrice", title: "Price USD" },
    { id: "score", title: "Score" },
    { id: "top", title: "Top" },
    { id: "rank", title: "Rank" },
  ],
});

(async function () {
  const response = await axios.get(
    "https://cdn.luart.io/mainnet/terra1chu9s72tqguuzgn0tr6rhwvnrgcgzme73y5l4x/nft-compact-metadata.json"
  );

  const pricesResponse = await axios.get(
    "https://luart-marketplace-prices-indexer.2ue2d8tpif5rs.eu-central-1.cs.amazonlightsail.com/nft-collection-prices/terra1chu9s72tqguuzgn0tr6rhwvnrgcgzme73y5l4x"
  );

  const lunaPriceResponse = await axios.get(
    "http://127.0.0.1:5005/luna"
  );

  const lunaPriceUSD = lunaPriceResponse.data.USD;

  const data = Object.values(response.data);

  const prices = Object.values(pricesResponse?.data?.prices);

  const count = data.length;

  let obj = {};

  const withRarity = data.map((x) => {
    obj = { ...obj, ...x.traits };

    const rarities = {
      BackgroundRarity:
        100 /
        ((data.filter((y) => y.traits.Background === x.traits.Background)
          .length /
          count) *
          100),
      SkullRarity:
        100 /
        ((data.filter((y) => y.traits.Skull === x.traits.Skull).length /
          count) *
          100),
      EyesRarity:
        100 /
        ((data.filter((y) => y.traits.Eyes === x.traits.Eyes).length / count) *
          100),
      ClothesRarity:
        100 /
        ((data.filter((y) => y.traits.Clothes === x.traits.Clothes).length /
          count) *
          100),
      HeadwearRarity:
        100 /
        ((data.filter((y) => y.traits.Headwear === x.traits.Headwear).length /
          count) *
          100),
      AccessoryRarity:
        100 /
        ((data.filter((y) => y.traits.Accessory === x.traits.Accessory).length /
          count) *
          100),
    };

    const score = Object.values(rarities).reduce(
      (partialSum, a) => partialSum + a,
      0
    );

    return {
      ...x,
      ...rarities,
      score,
      price: prices.find((p) => p.tokenId === x.tokenId),
    };
  });

  console.warn(obj);

  const withRank = withRarity
    .sort((a, b) => b.score - a.score)
    .map((x, i) => ({ ...x, rank: i + 1 }));

  const withRankData = withRank.map(
    ({
      tokenId,
      imageURL,
      name,
      traits: { Background, Skull, Eyes, Clothes, Headwear, Accessory },
      BackgroundRarity,
      SkullRarity,
      EyesRarity,
      ClothesRarity,
      HeadwearRarity,
      AccessoryRarity,
      score,
      price,
      rank,
    }) => ({
      tokenId,
      imageURL,
      name,
      Background,
      Skull,
      Eyes,
      Clothes,
      Headwear,
      Accessory,
      BackgroundRarity: `${(1 / (BackgroundRarity / 100)).toFixed(2)}`,
      SkullRarity: `${(1 / (SkullRarity / 100)).toFixed(2)}`,
      EyesRarity: `${(1 / (EyesRarity / 100)).toFixed(2)}`,
      ClothesRarity: `${(1 / (ClothesRarity / 100)).toFixed(2)}`,
      HeadwearRarity: `${(1 / (HeadwearRarity / 100)).toFixed(2)}`,
      AccessoryRarity: `${(1 / (AccessoryRarity / 100)).toFixed(2)}`,
      price: `${price?.sellPriceAmount ?? ""}  ${
        price?.sellPriceCurrency ?? ""
      }`,
      sortPrice: Math.round(
        price?.sellPriceCurrency === "LUNA"
          ? (price?.sellPriceAmount ?? 0) * lunaPriceUSD
          : price?.sellPriceAmount ?? 0
      ),
      rank,
      score,
      top: `${((rank / withRank.length) * 100).toFixed(2)}%`,
    })
  );

  csvWriter
    .writeRecords(withRankData)
    .then(() => console.log("The CSV file was written successfully"));
})();
