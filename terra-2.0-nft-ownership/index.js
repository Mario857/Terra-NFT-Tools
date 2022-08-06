const axios = require("axios");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const promiseRetry = require("promise-retry");

// Terra 2.0 WASM Base URL
const BASE_URL = "https://phoenix-lcd.terra.dev/cosmwasm/wasm/v1/contract";

const pMap = (...args) => import("p-map").then(({ default: pMap }) => pMap(...args));

const fetchAllTokens = async (contractAddress) => {
  let result = [];
  let startAfter;
  do {
    const allTokens =
      (
        await promiseRetry({ minTimeout: 150, retries: 40, factor: 2, randomize: true }, (retry) =>
          axios
            .get(
              `${BASE_URL}/${contractAddress}/smart/${encodeURI(
                Buffer.from(
                  JSON.stringify({
                    all_tokens: {
                      start_after: startAfter,
                      limit: 30,
                    },
                  })
                ).toString("base64")
              )}`
            )
            .catch(retry)
        )
      )?.data?.data?.tokens || [];

    result = [...result, ...allTokens];

    const [lastTokenId] = allTokens.slice(-1);

    console.warn(allTokens);

    startAfter = lastTokenId;
  } while (startAfter);

  return result;
};

(async function () {
  const args = process.argv.slice(2);

  const [contractAddress] = args;

  if (!contractAddress) {
    throw Error("Missing contract address as argument");
  }

  const csvWriter = createCsvWriter({
    path: `${contractAddress}-owners.csv`,
    header: [
      { id: "name", title: "name" },
      { id: "tokenId", title: "tokenId" },
      { id: "owner", title: "owner" },
    ],
  });

  const allTokens = await fetchAllTokens(contractAddress);

  const results = await pMap(
    allTokens,
    async (tokenId) => {
      const ownerInfo = (
        await promiseRetry({ minTimeout: 150, retries: 40, factor: 2, randomize: true }, (retry) =>
          axios
            .get(
              `${BASE_URL}/${contractAddress}/smart/${encodeURI(
                Buffer.from(
                  JSON.stringify({
                    all_nft_info: {
                      token_id: tokenId,
                    },
                  })
                ).toString("base64")
              )}`
            )
            .catch(retry)
        )
      )?.data?.data;

      const owner = ownerInfo.access.owner;

      const name = ownerInfo.info.extension.name;

      console.warn({ owner, name });

      return {
        owner,
        name,
        tokenId,
      };
    },
    { concurrency: 20 }
  );

  await csvWriter.writeRecords(results);
})();
