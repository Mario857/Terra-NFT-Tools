const { spawn } = require("child_process");

const MINTER_CONTRACT_ADDR = "terra19pdh2yy9nytpspamz4n5t223thm3g09r3pq3x2";

const NETWORK_ID = "columbus-5";

const MINTING_PRICE = 200.2; // 0.2 fee

const MINT_DATE = "Tue Apr 30 2022 03:00:00 GMT+0200"

const WALLETS = [
  {
    MINTING_PRICE,
    MINT_COUNT: 3,
    MINTER_CONTRACT_ADDR,
    MNEMONIC_KEY: "notice oak worry limit wrap speak medal online prefer cluster roof addict wrist behave treat actual wasp year salad speed social layer crew genius",
    NETWORK_ID,
    WALLET_ADDRESS: "terra1x46rqay4d3cssq8gxxvqz8xt6nwlz4td20k38v",
  },
  {
    MINTING_PRICE,
    MINT_COUNT: 3,
    MINTER_CONTRACT_ADDR,
    MNEMONIC_KEY: "quality vacuum heart guard buzz spike sight swarm shove special gym robust assume sudden deposit grid alcohol choice devote leader tilt noodle tide penalty",
    NETWORK_ID,
    WALLET_ADDRESS: "terra17lmam6zguazs5q5u6z5mmx76uj63gldnse2pdp",
  },
];


function secondsToHms(d) {
  d = Number(d);
  const h = Math.floor(d / 3600);
  const m = Math.floor(d % 3600 / 60);
  const s = Math.floor(d % 3600 % 60);

  const hDisplay = h > 0 ? h + (h == 1 ? " hour, " : " hours, ") : "";
  const mDisplay = m > 0 ? m + (m == 1 ? " minute, " : " minutes, ") : "";
  const sDisplay = s > 0 ? s + (s == 1 ? " second" : " seconds") : "";
  return hDisplay + mDisplay + sDisplay; 
}

const waitUntilDate = (date) => {
  return new Promise((resolve, reject) => {
    const target = new Date(date);
    const timeOffset = target.getTimezoneOffset() * 60000;
    const targetTime = target.getTime();
    const targetUTC = targetTime + timeOffset;
  
    const today = new Date();
    const todayTime = today.getTime();
    const todayUTC = todayTime + timeOffset;
    const fireEarly = 2;
  
    const refreshTime = (targetUTC - todayUTC - fireEarly);
    if (refreshTime > 1) {
      console.warn(`I will fire in ${secondsToHms(refreshTime / 1000)} seconds`, )
      setTimeout(function() { 
        resolve()
       }, refreshTime);
    }
    else {
      reject('I have already finished')
    }
  })
}

(async () => {
  await waitUntilDate(MINT_DATE);

  WALLETS.forEach((env, index) => {
    const child = spawn("node", ["index.js"], {
      stdio: ["pipe"],
      shell: true,
      env,
    });

    child.stderr.on("data", (data) => {
      console.error(`${index} child stderr:\n${data}`);
    });

    child.on("exit", function (code, signal) {
      console.log(
        `${index} child process exited with code ${code} and signal ${signal}`
      );
    });
  });
})();
