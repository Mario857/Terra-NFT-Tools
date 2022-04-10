const axios = require("axios");
const fs = require("fs");
const pMap = (...args) =>
  import("p-map").then(({ default: pMap }) => pMap(...args));

const promiseRetry = require("promise-retry");

const getMetaData = async (nftContractAddr) => {
  let next = undefined;

  let meta = [];
  do {
    const allTokensQuery = {
      all_tokens: { limit: 50, ...(next ? { start_after: next } : {}) },
    };

    const response = await promiseRetry(
      { minTimeout: 100, retries: 50, factor: 2, randomize: true },
      (retry) =>
        axios
          .get(
            `https://lcd.terra.dev/wasm/contracts/${nftContractAddr}/store?query_msg=${encodeURI(
              JSON.stringify(allTokensQuery)
            )}`
          )
          .catch(retry)
    );

    if (response.data.result.tokens) {
      meta.push(response.data.result.tokens);
      next = response.data.result.tokens.at(-1)?.token_id;

      console.warn(next);
    }
  } while (next);

  return meta.flat();
};

(async function () {
  const NFTContract = "terra10plsnuw2f3d8gnd8tp3de6hryyak2ntuhqcw97";

  const all = await getMetaData(NFTContract);

  const processed = await pMap(
    all,
    async ({ token_id }) => {
      const NFTInfoQuery = {
        nft_info: { token_id },
      };

      const response = await promiseRetry(
        { minTimeout: 100, retries: 50, factor: 2, randomize: true },
        (retry) =>
          axios
            .get(
              `https://lcd.terra.dev/wasm/contracts/${NFTContract}/store?query_msg=${encodeURI(
                JSON.stringify(NFTInfoQuery)
              )}`
            )
            .catch(retry)
      );

      console.warn(response?.data?.result);

      const ipfsResponse = await promiseRetry(
        { minTimeout: 100, retries: 50, factor: 2, randomize: true },
        (retry) => axios.get(response.data.result.token_uri).catch(retry)
      );

      console.warn(ipfsResponse.data);

      return {
        tokenId: token_id,
        ...ipfsResponse.data,
        imageURL: ipfsResponse?.data?.media,
        name: ipfsResponse?.data?.title,
      };
    },
    { concurrency: 80 }
  );

  fs.writeFileSync(`meta.json`, JSON.stringify(processed));
})();
