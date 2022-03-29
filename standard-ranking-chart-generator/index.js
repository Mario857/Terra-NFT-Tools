const axios = require("axios");
const fs = require("fs/promises");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const NFT_CONTRACT_ADDRESS = "terra1my4sy2gt5suu9fgt8wdkm7ywrd5jzg86692as2"; 

function asyncAction(promise) {
  return Promise.resolve(promise)
    .then((data) => [null, data])
    .catch((error) => [error]);
}

function getTraits(data) {
  let traits = {};

  data
    .map((nft) => nft.traits)
    .forEach((trait) => {
      traits = { ...traits, ...trait };
    });

  return Object.keys(traits);
}

async function createNFTRaritySheet(path, data) {
  const traitKeys = getTraits(data);
  const csvWriter = createCsvWriter({
    path,
    header: [
      { id: "tokenId", title: "Token Id" },
      { id: "imageURL", title: "ImageUrl" },
      { id: "name", title: "Name" },

      ...traitKeys.map((value) => ({ id: value, title: value })),
      ...traitKeys.map((value) => ({ id: `${value}Rarity`, title: value })),

      { id: "score", title: "Score" },
      { id: "top", title: "Top" },
      { id: "rank", title: "Rank" },
    ],
  });

  return csvWriter.writeRecords(data);
}

function calculateNFTRankings(data) {
  const traitKeys = getTraits(data);

  // Transform empty cells to None, this is the case when there is not equal number of traits
  const transformedDataTraits = data.map((nft) => ({
    ...nft,
    traits: {
      ...Object.fromEntries(traitKeys.map((key) => [key, "None"])),
      ...nft.traits,
    },
  }));

  return transformedDataTraits
    .map((x) => {
      const rarities = Object.fromEntries(
        traitKeys.map((key) => [
          key,
          100 /
            ((transformedDataTraits.filter(
              (y) => y.traits[key] === x.traits[key]
            ).length /
              transformedDataTraits.length) *
              100),
        ])
      );

      // Sum there rarity scores, standard ranking formula. 100 / (trait0 %) + 100 / (trait1 %)...
      const score = Object.values(rarities).reduce(
        (partialSum, a) => partialSum + a,
        0
      );

      return {
        ...x,
        rarities,
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ traits, rarities, ...rest }, i) => ({
      ...rest,
      traits,
      ...traits,
      ...Object.fromEntries(
        Object.entries(rarities).map(([key, value]) => [
          `${key}Rarity`,
          `${(100 / +value).toFixed(2)}%`,
        ])
      ),
      score: rest.score.toFixed(2),
      rank: i + 1,
      top: `${(((i + 1) / transformedDataTraits.length) * 100).toFixed(2)}%`,
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
  const luartData = Object.values(response.data).filter((x) =>
    parsedMinted ? parsedMinted.includes(x.tokenId) : true
  );

  // Generate rankings in json
  const nftRankings = calculateNFTRankings(luartData);
  await fs.writeFile("ranking.json", JSON.stringify(nftRankings));

  // Generate rarity sheet.
  await createNFTRaritySheet("ranking.csv", nftRankings);
})();
