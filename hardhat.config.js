
require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-etherscan")
require("hardhat-deploy")
require("solidity-coverage")
require("hardhat-gas-reporter")
require("hardhat-contract-sizer")
require("dotenv").config()

/*
yarn add --dev @nomiclabs/hardhat-ethers@npm:hardhat-deploy-ethers ethers @nomiclabs/hardhat-etherscan @nomiclabs/hardhat-waffle chai ethereum-waffle hardhat hardhat-contract-sizer hardhat-deploy hardhat-gas-reporter prettier prettier-plugin-solidity solhint solidity-coverage dotenv
*/

const GOERLI_RPC_URL = process.env.GOERLI_RPC_URL || "https://eth-goerli.g.alchemy.com/v2/GYtzy8VpBfOnZAYwiCxz7nYqFy5Or77_"
const MAINNET_RPC_URL = process.env.MAINNET_RPC_URL
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x"
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY

module.exports = {

  defaultNetwork: "hardhat",

  networks: {
    hardhat: {
      chainId: 31337,
     /*  forking: {
        url: MAINNET_RPC_URL
      },  */
    },
    localhost: {
      chainId: 31337
    },
    goerli: {
      chainId: 5,
      blockConfirmations: 6,
      url: GOERLI_RPC_URL,
      accounts: [PRIVATE_KEY],
      saveDeployments: true
    }
  },

  gasReporter: {
    enabled: false,
    currency: "USD",
    outputFile: "gas-reporter.txt",
    noColors: true,
    //coinmarketcap: process.env.COINMARKETCAP_API_KEY
  },

  etherscan: {
    apiKey: {
      goerli: ETHERSCAN_API_KEY
    }
  },

  solidity: {
    compilers: [
      {version: "0.8.9"},
      {version: "0.4.19"},
      {version: "0.6.12"}
    ]
  },

  namedAccounts: {
    deployer: {
      default: 0,
    },
    player: {
      default: 1,
    },
  },

  contractSizer: {
    runOnCompile: false,
    only: ["Raffle"],
  },

  mocha: {
    timeout: 300000 // 300 seconds max
  }
  
};


