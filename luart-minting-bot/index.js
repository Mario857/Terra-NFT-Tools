require("dotenv").config();
const {
  LCDClient,
  MnemonicKey,
  MsgExecuteContract,
  Coin,
  Coins,
} = require("@terra-money/terra.js");

const { pick } = require("lodash");

const axios = require("axios");

const promiseRetry = require("promise-retry");

const MINTING_PRICE = parseFloat(process.env.MINTING_PRICE);

const MINT_COUNT = parseInt(process.env.MINT_COUNT, 10);

const MINTER_CONTRACT_ADDR = process.env.MINTER_CONTRACT_ADDR;

const MNEMONIC_KEY = process.env.MNEMONIC_KEY;

const NETWORK_ID = process.env.NETWORK_ID;

const WALLET_ADDRESS = process.env.WALLET_ADDRESS;

function createAmountConverter(decimals) {
  return {
    userFacingToBlockchainValue: (amount) =>
      String(Math.floor(amount * 10 ** decimals)),
    blockchainValueToUserFacing: (amount) => Number(amount) / 10 ** decimals,
  };
}

const UST_DECIMALS = 6;
const LP_DECIMALS = 6;
const LUNA_DECIMALS = 6;

const amountConverter = {
  ust: createAmountConverter(UST_DECIMALS),
  lp: createAmountConverter(LP_DECIMALS),
  luna: createAmountConverter(LUNA_DECIMALS),
};

const mk = new MnemonicKey({
  mnemonic: MNEMONIC_KEY,
});

const getWalletAddress = () => WALLET_ADDRESS;

function getNetworkId() {
  return NETWORK_ID;
}

let __cachedGasPrices__;

// Tip: It's better to use other nodes. 
const FCD_URLS = {
  "bombay-12": "https://bombay-fcd.terra.dev", 
  "columbus-5": "https://fcd.terra.dev",
};

const LCD_URLS = {
  "bombay-12": "https://bombay-lcd.terra.dev",
  "columbus-5": "https://lcd.terra.dev",
};

function asyncAction(promise) {
  return Promise.resolve(promise)
    .then((data) => [null, data])
    .catch((error) => [error]);
}

async function lazyFetchGasPrices() {
  const networkId = getNetworkId();

  if (!__cachedGasPrices__) {
    const response = await axios.get(
      `${FCD_URLS[networkId]}/v1/txs/gas_prices`
    );
    __cachedGasPrices__ = pick(response.data, ["uusd"]);
  }

  return __cachedGasPrices__;
}

async function getLcdURL() {
  const networkId = getNetworkId();
  return LCD_URLS[networkId];
}

async function getLCDClient(gasPrices) {
  const url = await getLcdURL();
  const networkId = getNetworkId();
  return new LCDClient({
    URL: url,
    chainID: networkId,
    gasPrices,
  });
}

async function estimateTxFee(messages) {
  const gasPrices = await lazyFetchGasPrices();
  const lcdClient = await getLCDClient(gasPrices);
  const memo = "estimate fee";
  const walletAddress = getWalletAddress();

  const accountInfo = await lcdClient.auth.accountInfo(walletAddress);

  const txOptions = {
    msgs: messages,
    gasPrices,
    gasAdjustment: 1.75,
    feeDenoms: ["uusd"],
    memo,
  };

  const fee = await lcdClient.tx.estimateFee(
    [
      {
        sequenceNumber: accountInfo.getSequenceNumber(),
        publicKey: accountInfo.getPublicKey(),
      },
    ],
    txOptions
  );

  return fee;
}

function getCoinsConfig(coins) {
  if (coins) {
    const coinObjects = [];
    if (coins.luna) {
      const lunaCoin = Coin.fromData({ denom: "uluna", amount: coins.luna });
      coinObjects.push(lunaCoin);
    }
    if (coins.ust) {
      const utsCoin = Coin.fromData({ denom: "uusd", amount: coins.ust });
      coinObjects.push(utsCoin);
    }
    return new Coins(coinObjects);
  }
  return undefined;
}

async function getTerraUrlForTxId(txId) {
  const networkId = getNetworkId();

  return `https://finder.terra.money/${networkId}/tx/${txId}`;
}

async function postManyTransactions(txs) {
  const address = await getWalletAddress();
  const msgs = txs.map((tx) => {
    const coins = getCoinsConfig(tx.coins);
    return new MsgExecuteContract(
      address,
      tx.contractAddress,
      tx.message,
      coins
    );
  });

  const fee = await estimateTxFee(msgs);

  const terra = await getLCDClient();

  const wallet = terra.wallet(mk);

  const tx = await wallet.createAndSignTx({
    msgs,
    fee,
  });

  const result = await terra.tx.broadcast(tx);

  const txId = result.txhash;

  const txTerraFinderUrl = await getTerraUrlForTxId(txId);

  return {
    txId,
    txFee: "< 5UST",
    txTerraFinderUrl,
  };
}

(async () => {
  const [error, result] = await asyncAction(
    promiseRetry(
      { minTimeout: 100, retries: 1000, factor: 2, randomize: true },
      async (retry) => {
        const [error, result] = await asyncAction(
          postManyTransactions(
            Array.from({ length: MINT_COUNT }).map(() => ({
              contractAddress: MINTER_CONTRACT_ADDR,
              message: {
                random_mint: {},
              },
              coins: {
                ust: amountConverter.ust.userFacingToBlockchainValue(
                  MINTING_PRICE
                ),
              },
            }))
          )
        );

        if (error) {
          console.warn(error?.response?.data);
          return retry("Try again");
        }

        return result;
      }
    )
  );

  if (error) {
    console.warn(error?.response?.data);
  }

  if (result) {
    console.warn(result?.txTerraFinderUrl);
  }
})();