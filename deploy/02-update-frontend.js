const { ethers } = require("hardhat")
const fs  = require("fs")
//const //{} = require("../../nextjs-lottery/constants/contractAddresses.json")

const FRONT_END_ADDRESSES_FILE = "../nextjs-lottery/constants/contractAddresses.json"
const FRONT_END_ABI_FILE = "../nextjs-lottery/constants/abi.json"


module.exports = async function () {
    console.log("Updating front end...")
    updateContractAddresses()
    updateAbi()
}

async function updateAbi() {
    const raffle = await ethers.getContract("Raffle")
    fs.writeFileSync(FRONT_END_ABI_FILE, raffle.interface.format(ethers.utils.FormatTypes.json))
}

async function updateContractAddresses() {
    const raffle = await ethers.getContract("Raffle")
    const currentAddresses = await JSON.parse(fs.readFileSync(FRONT_END_ADDRESSES_FILE, "utf8"))
    const chainId = network.config.chainId.toString() 
    if (chainId in currentAddresses) { //If chain-ID is present in the contractAddress file
        if (!currentAddresses[chainId].includes(raffle.address)) {
            currentAddresses[chainId].push(raffle.address)
        }
    } else {
        currentAddresses[chainId] = [raffle.address] // If chain-ID doen't exist
    }
    fs.writeFileSync(FRONT_END_ADDRESSES_FILE, JSON.stringify(currentAddresses))
}

module.exports.tags = ["all", "frontend"]