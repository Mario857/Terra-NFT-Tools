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
      next = response.data.result.tokens.at(-1);

      console.warn(next);
    }
  } while (next);

  return meta.flat();
};

(async function () {
  const NFTContract = "terra1jkw0g57qgu2rzc8pd22nf3uepjwc4ts2n0j0zu";

  const all = await getMetaData(NFTContract);

  const processed = await pMap(
    all,
    async (tokenId) => {
      const NFTInfoQuery = {
        nft_info: { token_id: tokenId },
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

      const ipfsResponse = await promiseRetry(
        { minTimeout: 100, retries: 50, factor: 2, randomize: true },
        (retry) =>
          axios
            .get(
              `https://ipfs.io/ipfs/${response.data.result.token_uri.replace(
                "ipfs://",
                ""
              )}`
            )
            .catch(retry)
      );

      console.warn(ipfsResponse.data);

      return {
        tokenId,
        ...ipfsResponse.data,
        imageURL: ipfsResponse?.data?.image
          ? `https://d1mx8bduarpf8s.cloudfront.net/${ipfsResponse.data.image.replace(
              "ipfs://",
              ""
            )}`
          : ``,
        animationURL: ipfsResponse?.data?.animation_url
          ? `https://d1mx8bduarpf8s.cloudfront.net/${ipfsResponse.data.animation_url.replace(
              "ipfs://",
              ""
            )}`
          : ``,
      };
    },
    { concurrency: 50 }
  );

  fs.writeFileSync(`${NFTContract}_metadata.json`, JSON.stringify(processed));
})();
