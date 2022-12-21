const { networkConfig, developmentChains } = require("../helper-hardhat-config")

const BASE_FEE = ethers.utils.parseEther("0.25") //0.25 LINK per request //we must pay for the random no. request
//pricefeeds didnt cost anything cuz a group of protocols were payin' for requests

const GAS_PRICE_LINK = 1e9 // if gas prices go up, price of requesting goes up too

module.exports = async function ({getNamedAccounts, deployments}) {
    const {deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    const args = [BASE_FEE, GAS_PRICE_LINK]

    if (developmentChains.includes(network.name)) {
        log("Local network detected, deploying mocks...")
        //deploy mock vrfcoordinator
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            log: true,
            args: args
        })
        log("Mocks deployed")
        log("-------------------------------")
    }
}

module.exports.tags = ["all", "mocks"]