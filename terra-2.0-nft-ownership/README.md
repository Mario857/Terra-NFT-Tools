# Terra 2.0 NFT Ownership Generator (CSV)

Terra 2.0 NFT Ownership Generator is a Node JS tool for fetching ownership of all NFTs from CW721 contract deployed on Terra 2.0 and writing ownership info to CSV.

## Installation
Install Node JS >= (v16.13.0)

https://nodejs.org/en/

## Usage

```bash
# install node modules first
npm install

# generate owners csv
node index.js <NFT_CONTRACT_ADDRESS>

#ex. for Galactic Punks
node index.js terra16ds898j530kn4nnlc7xlj6hcxzqpcxxk4mj8gkcl3vswksu6s3zszs8kp2

# After script has been completed your should see:
# terra16ds898j530kn4nnlc7xlj6hcxzqpcxxk4mj8gkcl3vswksu6s3zszs8kp2-owners.csv generated in terra-2.0-nft-ownership directory

```

## License

[MIT](https://choosealicense.com/licenses/mit/)
