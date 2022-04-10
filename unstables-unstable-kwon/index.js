const fs = require("fs");
const { WebSocketClient, LCDClient } = require("@terra-money/terra.js");
const discord = require("discord.js");
const { MessageEmbed, Intents } = require("discord.js");
require("discord-reply"); //⚠️ IMPORTANT: put this before your discord.Client()
const client = new discord.Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
});

const terra = new LCDClient({
  URL: "https://terra-lcd.easy2stake.com",
  chainID: "Columbus-5",
});

const promiseRetry = require("promise-retry");

const axios = require("axios");

const NFT_CONTRACT_ADDR = process.env.NFT_CONTRACT_ADDR;

const LUART_CONTRACT_ADDR = process.env.LUART_CONTRACT_ADDR;

const RANDOM_EARTH_CONTRACT_ADDR = process.env.RANDOM_EARTH_CONTRACT_ADDR;

const KNOWHERE_CONTRACT_ADDR = process.env.KNOWHERE_CONTRACT_ADDR;

const TAILS_CONTRACT_ADDR = process.env.TAILS_CONTRACT_ADDR;

const TAILS_FAMILY_ID = process.env.TAILS_FAMILY_ID;

const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

const DISCORD_BOT_AUTH = process.env.DISCORD_BOT_AUTH;

const IS_RANDOM_EARTH_ENABLED = process.env.IS_RANDOM_EARTH_ENABLED === "true";

const IS_LAURT_ENABLED = process.env.IS_LAURT_ENABLED === "true";

const IS_KNOWHERE_ENABLED = process.env.IS_KNOWHERE_ENABLED === "true";

const IS_TAILS_ENABLED = process.env.IS_TAILS_ENABLED === "true";

let cachedMetaData = [];

function formatPrice(price, denom, lunaPrice) {
  return price
    ? `${`${+price / 10 ** 6 || ""} ${(denom || "")
        .replace("uluna", "$LUNA")
        .replace("uusd", "$UST")} ${
        denom === "uluna" && +price / 10 ** 6
          ? ` = ~${((+price / 10 ** 6) * lunaPrice).toFixed(2)}$UST`
          : ""
      }`}`
    : "";
}

if (IS_LAURT_ENABLED) {
  const wsLuartClient = new WebSocketClient(
    "https://terra-rpc.easy2stake.com/websocket",
    -1
  );

  /* ... START LUART ... */
  wsLuartClient.subscribeTx(
    { "wasm.contract_address": LUART_CONTRACT_ADDR },
    async (data) => {
      const tx = data.value.TxResult;

      const item = {
        txhash: tx.txhash,
        ...Object.fromEntries(
          JSON.parse(tx.result.log)
            .flatMap((x) => x.events)
            .filter((x) => x.type === "wasm")
            .flatMap((x) => x.attributes)
            .filter((x) =>
              [
                "token_id",
                "buyer_amount",
                "denom",
                "price",
                "order_type",
                "method",
                "nft_contract_address",
              ].includes(x.key)
            )
            .map(({ key, value }) => [key, value])
        ),
      };

      if (
        item?.nft_contract_address !== NFT_CONTRACT_ADDR ||
        item?.method !== "execute_order"
      ) {
        return;
      }

      const nft = cachedMetaData.find((x) => x.tokenId === item.token_id);

      const channel = client.channels.cache.get(DISCORD_CHANNEL_ID);

      const response = await promiseRetry(
        { minTimeout: 250, retries: 5, factor: 2, randomize: true },
        (retry) => axios.get("http://127.0.0.1:5005/luna").catch(retry)
      );

      const lunaPrice = response.data.USD;

      if (channel?.isText()) {
        const embad = new MessageEmbed()
          .setColor("#0099ff")
          .setTitle(nft.name)
          .setURL(
            `https://marketplace.luart.io/collections/${NFT_CONTRACT_ADDR}/${nft.tokenId}`
          )
          .addFields({
            name: `Sold on Luart`,
            value: `Has been sold for ${formatPrice(
              item.price,
              item.denom,
              lunaPrice
            )} `,
          })
          .addFields({
            name: `Transaction`,
            value: `https://finder.terra.money/mainnet/tx/${item.txhash}`,
          })

          .setImage(nft.imageURL)
          .setTimestamp()
          .setFooter(
            "Powered by @LuckyMario",
            "https://pbs.twimg.com/profile_images/1484087115122106368/WcbfdAI1_400x400.jpg"
          );

        await promiseRetry(
          { minTimeout: 250, retries: 5, factor: 2, randomize: true },
          (retry) => channel.send({ embeds: [embad] }).catch(retry)
        );
      }
    }
  );
  wsLuartClient.start();
}
/*... END LUART ...*/

/*...START RANDOM EARTH ...*/

if (IS_RANDOM_EARTH_ENABLED) {
  const wsRandomEarthClient = new WebSocketClient(
    "https://terra-rpc.easy2stake.com/websocket",
    -1
  );
  wsRandomEarthClient.subscribeTx(
    { "wasm.contract_address": RANDOM_EARTH_CONTRACT_ADDR },
    async (data) => {
      const tx = data.value.TxResult;

      const item = {
        txhash: tx.txhash,
        ...Object.fromEntries(
          JSON.parse(tx.result.log)
            .flatMap((x) => x.events)
            .filter((x) => x.type === "wasm")
            .flatMap((x) => x.attributes)
            .filter((x) => ["action", "order"].includes(x.key))
            .map(({ key, value }) => [key, value])
        ),
      };

      if (item.action !== "execute_orders") {
        return;
      }

      const order = JSON.parse(
        Buffer.from(item.order, "base64").toString("utf-8")
      )?.order;

      const extendedItem = {
        ...item,
        ...(order.maker_asset?.info ?? {}),
        ...(order.taker_asset?.info ?? {}),
        amount:
          +order.maker_asset.amount <= 1
            ? order.taker_asset.amount
            : order.maker_asset.amount,
      };

      if (extendedItem?.nft?.contract_addr !== NFT_CONTRACT_ADDR) {
        return;
      }

      const nft = cachedMetaData.find(
        (x) => x.tokenId === extendedItem?.nft?.token_id
      );

      if (!nft.tokenId) {
        return;
      }

      const channel = client.channels.cache.get(DISCORD_CHANNEL_ID);

      const response = await promiseRetry(
        { minTimeout: 250, retries: 5, factor: 2, randomize: true },
        (retry) => axios.get("http://127.0.0.1:5005/luna").catch(retry)
      );

      const lunaPrice = response.data.USD;

      const price = extendedItem.amount.replace(
        extendedItem.native_token?.denom || "",
        ""
      );

      const denom = extendedItem.native_token?.denom;

      if (channel?.isText()) {
        const embad = new MessageEmbed()
          .setColor("#0099ff")
          .setTitle(nft.name)
          .setURL(
            `https://randomearth.io/items/${NFT_CONTRACT_ADDR}_${nft.tokenId}`
          )
          .addFields({
            name: `Sold on RandomEarth`,
            value: `Has been sold for ${formatPrice(price, denom, lunaPrice)} `,
          })
          .addFields({
            name: `Transaction`,
            value: `https://finder.terra.money/mainnet/tx/${extendedItem.txhash}`,
          })
          .setImage(nft.imageURL)
          .setTimestamp()
          .setFooter(
            "Powered by @LuckyMario",
            "https://pbs.twimg.com/profile_images/1484087115122106368/WcbfdAI1_400x400.jpg"
          );

        await promiseRetry(
          { minTimeout: 250, retries: 5, factor: 2, randomize: true },
          (retry) => channel.send({ embeds: [embad] }).catch(retry)
        );
      }
    }
  );
  wsRandomEarthClient.start();
}

/* ... BEGIN KNOWHERE SALES ... */

if (IS_KNOWHERE_ENABLED) {
  const wsKnowhereClient = new WebSocketClient(
    "https://terra-rpc.easy2stake.com/websocket",
    -1
  );
  wsKnowhereClient.subscribeTx(
    { "wasm.contract_address": KNOWHERE_CONTRACT_ADDR },
    async (data) => {
      const tx = data.value.TxResult;

      const item = {
        txhash: tx.txhash,
        ...Object.fromEntries(
          JSON.parse(tx.result.log)
            .flatMap((x) => x.events)
            .filter((x) => x.type === "wasm" || x.type === "coin_received")
            .flatMap((x) =>
              x.attributes.filter(
                (x) =>
                  x.value !== KNOWHERE_CONTRACT_ADDR &&
                  x.value != "transfer_nft"
              )
            )
            .filter((x) =>
              [
                "action",
                "order",
                "amount",
                "token_id",
                "contract_address",
                "auction_id",
              ].includes(x.key)
            )
            .map(({ key, value }) => [key, value])
        ),
      };

      if (
        item?.action !== "settle" ||
        !item?.amount ||
        item?.contract_address !== NFT_CONTRACT_ADDR
      ) {
        return;
      }

      const nft = cachedMetaData.find((x) => x.tokenId === item.token_id);

      if (!nft.tokenId) {
        return;
      }

      const channel = client.channels.cache.get(DISCORD_CHANNEL_ID);

      const response = await promiseRetry(
        { minTimeout: 250, retries: 5, factor: 2, randomize: true },
        (retry) => axios.get("http://127.0.0.1:5005/luna").catch(retry)
      );

      const lunaPrice = response.data.USD;

      const price = item?.amount.replace(/[a-zA-z]+/, "");

      const denom = item?.amount.replace(/[0-9]+/, "");

      if (channel?.isText()) {
        const embad = new MessageEmbed()
          .setColor("#0099ff")
          .setTitle(nft.name)
          .setURL(`https://knowhere.art/sale/${item?.auction_id}`)
          .addFields({
            name: `Sold on Knowhere`,
            value: `Has been sold for ${formatPrice(price, denom, lunaPrice)} `,
          })
          .addFields({
            name: `Transaction`,
            value: `https://finder.terra.money/mainnet/tx/${item.txhash}`,
          })
          .setImage(nft.imageURL)
          .setTimestamp()
          .setFooter(
            "Powered by @LuckyMario",
            "https://pbs.twimg.com/profile_images/1484087115122106368/WcbfdAI1_400x400.jpg"
          );

        await promiseRetry(
          { minTimeout: 250, retries: 5, factor: 2, randomize: true },
          (retry) => channel.send({ embeds: [embad] }).catch(retry)
        );
      }
    }
  );
  wsKnowhereClient.start();
}

/* ... END KNOWHERE SALES ... */

/* ... START TAILS SALES ... */
if (IS_TAILS_ENABLED) {
  const wsTailsClient = new WebSocketClient(
    "https://terra-rpc.easy2stake.com/websocket",
    -1
  );
  wsTailsClient.subscribeTx(
    { "wasm.contract_address": TAILS_CONTRACT_ADDR },
    async (data) => {
      const tx = data.value.TxResult;

      const transactionResponse = await promiseRetry(
        { minTimeout: 250, retries: 5, factor: 2, randomize: true },
        (retry) => terra.tx.txInfo(tx.txhash).catch(retry)
      );

      const buyResponse =
        transactionResponse?.tx?.body?.messages.find(
          (x) => x?.execute_msg?.buy_token
        ) ?? null;

      if (!buyResponse) {
        return;
      }

      const { contract_address: contractAddress, token_id: tokenId } =
        buyResponse?.execute_msg?.buy_token ?? {};

      if (contractAddress !== NFT_CONTRACT_ADDR) {
        return;
      }

      const nft = cachedMetaData.find((x) => x.tokenId === tokenId);

      if (!nft.tokenId) {
        return;
      }

      const { denom, amount } =
        Object.values(buyResponse?.coins?._coins).find((x) =>
          ["uusd", "uluna"].includes(x.denom)
        ) ?? {};

      const query = `
      {
        token(input: {
        filter: {
          token_id: { eq: "${nft.tokenId}" },
          family: { eq: "${TAILS_FAMILY_ID}" },
        }
      }) {
        id
        token_id
      }
    }`;

      const tailsMarketplaceInfo = await promiseRetry(
        { minTimeout: 250, retries: 5, factor: 2, randomize: true },
        (retry) =>
          axios
            .post("https://talis.art/api/graphql", {
              query,
            })
            .catch(retry)
      );

      const channel = client.channels.cache.get(DISCORD_CHANNEL_ID);

      const response = await promiseRetry(
        { minTimeout: 250, retries: 5, factor: 2, randomize: true },
        (retry) => axios.get("http://127.0.0.1:5005/luna").catch(retry)
      );

      const lunaPrice = response.data.USD;

      if (channel?.isText()) {
        const embad = new MessageEmbed()
          .setColor("#0099ff")
          .setTitle(nft.name)
          .setURL(
            `https://talis.art/token/${tailsMarketplaceInfo?.data?.data?.token?.id}?from=collection`
          )
          .addFields({
            name: `Sold on Tails`,
            value: `Has been sold for ${formatPrice(
              amount,
              denom,
              lunaPrice
            )} `,
          })
          .addFields({
            name: `Transaction`,
            value: `https://finder.terra.money/mainnet/tx/${tx.txhash}`,
          })
          .setImage(nft.imageURL)
          .setTimestamp()
          .setFooter(
            "Powered by @LuckyMario",
            "https://pbs.twimg.com/profile_images/1484087115122106368/WcbfdAI1_400x400.jpg"
          );

        await promiseRetry(
          { minTimeout: 250, retries: 5, factor: 2, randomize: true },
          (retry) => channel.send({ embeds: [embad] }).catch(retry)
        );
      }
    }
  );
  wsTailsClient.start();
}

(async function () {
  let rawdata = fs.readFileSync("meta.json");

  cachedMetaData = JSON.parse(rawdata);
})();

client.on("ready", async () => {
  console.log(client.user.tag);
  console.log(`BOT STARTED AT : ${new Date().toDateString()}`);

  // const channel = client.channels.cache.get(DISCORD_CHANNEL_ID);

  // const embad = new MessageEmbed().setColor("#0099ff").setTitle("TEST");

  // await promiseRetry(
  //   { minTimeout: 250, retries: 5, factor: 2, randomize: true },
  //   (retry) => channel.send({ embeds: [embad] }).catch(retry)
  // );
});

client.login(DISCORD_BOT_AUTH);
