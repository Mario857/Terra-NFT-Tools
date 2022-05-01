const axios = require("axios");
const NFT_CONTRACT_ADDRESS = "terra1e9h2mltrefryqzfsgegwzkzfada3mw77xztn2g";
const LUART_MARKETPLACE_ADDRESS =
  "terra1fj44gmt0rtphu623zxge7u3t85qy0jg6p5ucnk";
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const promiseRetry = require("promise-retry");

const pMap = (...args) =>
  import("p-map").then(({ default: pMap }) => pMap(...args));

const csvWriter = createCsvWriter({
  path: `${NFT_CONTRACT_ADDRESS}-owners.csv`,
  header: [
    { id: "tokenId", title: "tokenId" },
    { id: "owner", title: "owner" },
    { id: "listed", title: "listed" },
  ],
});

(async function () {
  const metadataResponse = await axios.get(
    `https://cdn.luart.io/mainnet/${NFT_CONTRACT_ADDRESS}/nft-compact-metadata.json`
  );

  const nftOwners = await pMap(
    Object.values(metadataResponse.data),
    async ({ tokenId }) => {
      const orderCreator = (
        (
          await promiseRetry(
            { minTimeout: 150, retries: 25, factor: 2, randomize: true },
            (retry) =>
              axios
                .get(
                  `https://nameless-autumn-hill.terra-mainnet.quiknode.pro/26d007136990dab7e62c85c2e9c4d98a7964d617/wasm/contracts/${LUART_MARKETPLACE_ADDRESS}/store?query_msg=${encodeURI(
                    JSON.stringify({
                      orders_for_token: {
                        nft_contract_address: NFT_CONTRACT_ADDRESS,
                        token_id: tokenId,
                        only_active: true,
                        limit: 30,
                      },
                    })
                  )}`
                )
                .catch(retry)
          )
        )?.data?.result?.orders ?? []
      ).find((order) => order.order_type === "sell")?.order_creator;

      if (orderCreator) {
        return {
          tokenId,
          owner: orderCreator,
          listed: true,
        };
      }

      const owner = (
        await await promiseRetry(
          { minTimeout: 150, retries: 25, factor: 2, randomize: true },
          (retry) =>
            axios
              .get(
                `https://nameless-autumn-hill.terra-mainnet.quiknode.pro/26d007136990dab7e62c85c2e9c4d98a7964d617/wasm/contracts/${NFT_CONTRACT_ADDRESS}/store?query_msg=${encodeURI(
                  JSON.stringify({
                    owner_of: { token_id: tokenId },
                  })
                )}`
              )
              .catch(retry)
        )
      )?.data?.result?.owner;

      return {
        tokenId,
        owner,
        listed: false,
      };
    },
    { concurrency: 50 }
  );

  await csvWriter.writeRecords(nftOwners);

  console.log("The CSV file was written successfully");
})();
