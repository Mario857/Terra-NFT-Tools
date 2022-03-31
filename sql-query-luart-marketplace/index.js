const axios = require("axios");
const fs = require("fs/promises");
const NFT_CONTRACT_ADDRESS = "terra1chu9s72tqguuzgn0tr6rhwvnrgcgzme73y5l4x";
const alasql = require("alasql");
const express = require("express");
const cron = require("node-cron");
const app = express();
const port = 8080;
const bodyParser = require("body-parser");

app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

const pMap = (...args) =>
  import("p-map").then(({ default: pMap }) => pMap(...args));

function asyncAction(promise) {
  return Promise.resolve(promise)
    .then((data) => [null, data])
    .catch((error) => [error]);
}

let luartData = null;
let dbData = null;

function getTraits(data) {
  let traits = {};

  data
    .map((nft) => nft.traits)
    .forEach((trait) => {
      traits = { ...traits, ...trait };
    });

  return Object.keys(traits);
}

async function calculateNFTRankings(data) {
  const traitKeys = getTraits(data);

  // Transform empty cells to None, this is the case when there is not equal number of traits
  const transformedDataTraits = data.map((nft) => ({
    ...nft,
    traits: {
      ...Object.fromEntries(traitKeys.map((key) => [key, "None"])),
      ...nft.traits,
    },
  }));

  const pricesResponse = await axios.get(
    `https://luart-marketplace-prices-indexer.2ue2d8tpif5rs.eu-central-1.cs.amazonlightsail.com/nft-collection-prices/${NFT_CONTRACT_ADDRESS}`
  );

  const lunaPriceResponse = await axios.get("http://127.0.0.1:5005/luna");

  const result = await pMap(transformedDataTraits, async (x) => {
    const rarities = Object.fromEntries(
      traitKeys.map((key) => [
        key,
        100 /
          ((transformedDataTraits.filter((y) => y.traits[key] === x.traits[key])
            .length /
            transformedDataTraits.length) *
            100),
      ])
    );

    // Sum there rarity scores, standard ranking formula. 100 / (trait0 %) + 100 / (trait1 %)...
    const score = Object.values(rarities).reduce(
      (partialSum, a) => partialSum + a,
      0
    );

    const lunaPriceUSD = lunaPriceResponse.data.USD;

    const prices = Object.values(pricesResponse?.data?.prices);

    const price = prices.find((p) => p.tokenId === `${x.tokenId}`);

    return {
      ...x,
      rarities,
      score,
      price,
      priceUSD: Math.round(
        price?.sellPriceCurrency === "LUNA"
          ? (price?.sellPriceAmount ?? 0) * lunaPriceUSD
          : price?.sellPriceAmount ?? 0
      ),
    };
  });

  return result
    .sort((a, b) => b.score - a.score)
    .map(({ traits, rarities, price, ...rest }, i) => ({
      ...rest,
      ...traits,
      ...price,
      ...Object.fromEntries(
        Object.entries(rarities).map(([key, value]) => [
          `${key}Rarity`,
          `${(100 / +value).toFixed(2)}%`,
        ])
      ),
      ...Object.fromEntries(
        Object.entries(rarities).map(([key, value]) => [
          `${key}RarityRaw`,
          +((100 / +value).toFixed(2)),
        ])
      ),
      marketplaceURL: `https://marketplace.luart.io/collections/${NFT_CONTRACT_ADDRESS}/${rest.tokenId}`,
      score: rest.score.toFixed(2),
      scoreRaw: +rest.score.toFixed(2),
      rank: i + 1,
      top: `${(((i + 1) / transformedDataTraits.length) * 100).toFixed(2)}%`,
      topRaw: +(((i + 1) / transformedDataTraits.length) * 100).toFixed(2)
    }));
}

(async function () {
  const [error, minted] = await asyncAction(fs.readFile("minted.json"));

  // This are all minted if you want to use this make sure to generate minted.json containing all token ids. If file does't exist ignore (take all).
  const parsedMinted = error || !minted ? null : JSON.parse(minted);
  const response = await axios.get(
    `https://cdn.luart.io/mainnet/${NFT_CONTRACT_ADDRESS}/nft-compact-metadata.json`
  );

  // Get all minted
  luartData = Object.values(response.data).filter((x) =>
    parsedMinted ? parsedMinted.includes(x.tokenId) : true
  );

  dbData = await calculateNFTRankings(luartData);
})();

app.post("/", async (req, res) => {
  const query = req?.body?.query ?? "SELECT * FROM ?";

  try {
    const response = alasql(query, [dbData]);

    res.send(response);
  } catch {
    res.send([]);
  }
});

app.listen(port, () => {
  console.log(`Server Listening on port ${port}`);
});

cron.schedule("*/5 * * * *", async () => {
  dbData = await calculateNFTRankings(luartData);
});
