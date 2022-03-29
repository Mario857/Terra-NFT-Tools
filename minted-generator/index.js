const axios = require("axios");
const promiseRetry = require("promise-retry");
const fs = require("fs/promises");

const MINTER_ADDRESS = "terra18h7u4mda3ds8unwavzv4n6zmn0zxsksvf580zu";

const getAllTransactions = async (contractAddress) => {
  let responseOffset = 0;
  const txs = [];
  do {
    const response = await promiseRetry(
      { minTimeout: 100, retries: 50, factor: 2, randomize: true },
      (retry) =>
        axios
          .get(
            `https://fcd.terra.dev/v1/txs?offset=${responseOffset}&limit=100&account=${contractAddress}`
          )
          .catch(retry)
    );

    if (response.data.txs) {
      txs.push(response.data.txs);
      responseOffset = response.data.next;
    }
  } while (responseOffset);

  return txs.flat();
};

const getMintedNFTs = async () => {
  const txs = await getAllTransactions(MINTER_ADDRESS);

  const mints = txs.map((tx) => ({
    timestamp: tx.timestamp,
    txhash: tx.txhash,

    logs: tx.logs
      .flatMap((x) => x.events)
      .filter((x) => x.type === "wasm")
      .flatMap((x) => x.attributes)
      .filter((x) => ["token_id"].includes(x.key) && x.value)
      .flatMap(({ key, value }) => ({ [key]: value })),
  }));

  return mints.flatMap((x) => x.logs);
};

(async function () {
  const minted = await getMintedNFTs();

  console.warn(minted);

  await fs.writeFile(
    "minted.json",
    JSON.stringify([
      ...new Set(
        minted.map(({ token_id: tokenId }) => tokenId).filter((x) => x)
      ),
    ])
  );
})();
