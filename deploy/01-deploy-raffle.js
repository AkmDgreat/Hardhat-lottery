const { network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")
const {verify} = require("../utils/verify.js")
// const {verify} = require("../helper-hardhat-config")

const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("2");  //2 ether (in real contract, we funded with LINK token)

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    let vrfCoordinatorV2Address, subscriptionId

    if (developmentChains.includes(network.name)) {
        const VRFCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorV2Address = VRFCoordinatorV2Mock.address
        const txnResponse = await VRFCoordinatorV2Mock.createSubscription() //see VRFCoordinatorV2Mock.sol in node modules to see what the function does
        const txnReceipt = await txnResponse.wait(1)
        subscriptionId = txnReceipt.events[0].args.subId
        await VRFCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT)

    } else{
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
        subscriptionId = networkConfig[chainId]["subscriptionId"]
    }

    /* ARGUMENTS FOR CONSTRUCTOR (of raffle.sol) */
    const entranceFee = networkConfig[chainId]["raffleEntranceFee"]
    const gasLane = networkConfig[chainId]["gasLane"]
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
    const interval = networkConfig[chainId]["keepersUpdateInterval"]

    const args = [vrfCoordinatorV2Address,
            entranceFee, 
            gasLane, 
            subscriptionId, 
            callbackGasLimit, 
            interval
        ]

    console.log(args)
    const raffle = await deploy("Raffle", {
        from: deployer,
        args: args,
        logs: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying...")                 // etherscan api key is required to verify the contract
        await verify(raffle.address, args) //if we arent on local network, then verify the contract 
    }
    log("---------------------------")
}

module.exports.tags = ["all", "raffle"]