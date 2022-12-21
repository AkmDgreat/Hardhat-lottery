const { assert, expect } = require("chai")
const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const {developmentChains, networkConfig} = require("../../helper-hardhat-config")
//yarn hardhat test 
// yarn hardhat deploy

//ig when Patrick filmed the video, the chainlink/contracts version was 0.4.1 not 0.4.2, hence that invalidConsumer() error

//unit tests are for local dev
//  we are on real network
!(developmentChains.includes(network.name)) 
    ? describe.skip 
    : describe("Raffle", function() {
        let raffle, vrfCoordinatorV2Mock // we need to deploy raffle and vrfCoordinatorV2Mock
        let raffleEntranceFee, deployer, interval
        const chainId = network.config.chainId

        beforeEach(async function() {
            //const { deployer } = await getNamedAccounts()
            deployer = (await getNamedAccounts()).deployer
            await deployments.fixture(["all"]) //deploy every file that has "all" as a tag
            raffle = await ethers.getContract("Raffle", deployer)
            vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
            raffleEntranceFee = await raffle.getEntranceFee()
            interval = await raffle.getInterval()
        })
        
        describe("constructor", function() {
            it("initializes the raffle correctly", async function() {
                const raffleState = await raffle.getRaffleState() // a bigNumber
                assert.equal(raffleState.toString(), "0")
                assert.equal(interval.toString(), networkConfig[chainId]["interval"])
            })
        })

        describe("enterRaffle", function() {
            it("reverts when you don't pay enough", async function() {
                //entranceFee = await raffle.getEntranceFee()
                //if(msg.value < i_entranceFee){
                    await expect (raffle.enterRaffle()).to.be.revertedWith("Raffle__NotEnoughEntranceFee")
                //}
            })

            it("records players when they enter", async function() {
                // I am deployin' the contract (see beforeEach), so I enter the the raffle contract for testing puropses
                await raffle.enterRaffle({ value: raffleEntranceFee })
                const playerFromContract = await raffle.getPlayer(0)
                assert.equal(playerFromContract, deployer)
            })

            it("emits event on enter", async function() {
                await expect( raffle.enterRaffle({ value: raffleEntranceFee })).to.emit( raffle, "raffleEnter")
            })

            it("doesn't allow players to enter when raffleState is CALCULATING", async function() {
                /*
                let raffleState = (await raffle.getRaffleState()).toString()
                if( raffleState = "1" ) {
                    expect(raffle.enterRaffle({value: raffleEntranceFee})).to.be.revertedWith("Raffle__NotOpen")
                }
                */

                /* first, we need to make sure that raffleState ==  CALCULATING 
                    inside performUpkeep(), we change raffleState to CALCULATING, so we need to call performUpkeep()
                    to call performUpkeep, upkeepNeeded (return value of checkUpkeep()) needs to be true*/ 
                //In beforeEach, we deployed the contract, so raffleState == OPEN (happens inside the constructor)
                
                await raffle.enterRaffle({value: raffleEntranceFee}) // hasEnoughPlayers, hasEnoughBalance == true
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]) // now, timePassed == true 
                await network.provider.send("evm_mine", []) //We are minig an extra block// OR: await network.provider.request({ method: "evm_mine", params: [] })
                await raffle.performUpkeep([]) // OR: await raffle.performUpkeep("0x")
                await expect(raffle.enterRaffle({value: raffleEntranceFee})).to.be.revertedWith("Raffle__NotOpen")
            })
        })

        describe("checkUpkeep", function() {
            it("returns false if people haven't sent any eth", async function() {
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.send("evm_mine", [])
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])// I dont wanna send the txn, i just wanna simulate it 
                assert(!upkeepNeeded) // upkeepNeeded == false
            })

            it("returns false if raffle isn't open", async function() {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                await raffle.performUpkeep([]) // changes the state to calculating
                const raffleState = await raffle.getRaffleState() 
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") //
                    // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                assert.equal(raffleState.toString() == "1", upkeepNeeded == false)
            })

            it("returns false if enough time hasn't passed", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() - 1]) // <<-- changes made
                await network.provider.request({ method: "evm_mine", params: [] })
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                assert(!upkeepNeeded)
            })

            it("returns true if enough time has passed, has players, eth, and is open", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                assert(upkeepNeeded)
            })
        })

        describe("performUpkeep", function() {

            it("can only run if checkUpkeep returns true", async function() {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const tx = await raffle.performUpkeep("0x") // if performUpkeep runs, this means checkUpkeep returned true
                assert(tx)
            }) 

            it("reverts if checkup is false", async () => {
                await expect(raffle.performUpkeep([])).to.be.revertedWith("Raffle__UpkeepNotNeeded") // we dont need to add all the parameters it'll be reverted with
                //checkupkeep returns false as timePassed, hasBalance, hasPlayers is false
            })

            it("updates the raffleState, emits an event, calls the vrfCoordinator", async function() {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.send("evm_mine", [])
                txnResponse = await raffle.performUpkeep([])
                txnReceipt = await txnResponse.wait(1)
                const requestId = txnReceipt.events[1].args.requestId  // requestRandomWords (line 105) emits an event RandomWordsRequested (0th event), so RequestedRaffleWinner is the 1st event
                const raffleState = await raffle.getRaffleState()
                assert.equal(raffleState.toString(), "1")
                assert(requestId.toNumber() > 0)
                //expect(raffle.performUpkeep([])).to.emit("RequestedRaffleWinner")

            })
        })

        describe("fulfillRandomWords", function() {
            beforeEach(async function() {
                await raffle.enterRaffle({value: raffleEntranceFee})
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.send("evm_mine", [])
            })

            it("can only be called after performUpkeep", async function() {
                await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)).to.be.revertedWith("nonexistent request")
                await expect(vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)).to.be.revertedWith("nonexistent request")
                /*
                VRFCoordinatorV2Mock.sol
                function fulfillRandomWordsWithOverride(uint256 _requestId, address _consumer,uint256[] memory _words) public {
                    ....
                    if (s_requests[_requestId].subId == 0) {
                      revert("nonexistent request");
                    }
                    ....
                }
                 */
            })

            it("picks a winner, resets the lottery, sends money", async function() {
                const additionalEntrants = 3 // now we have 3 players + deployer
                const startingAccountIndex = 1 // startingAccountIndex for players, as deployer = 0
                const accounts = await ethers.getSigners()
                for (let i = startingAccountIndex; i < startingAccountIndex + additionalEntrants; i++) {
                    const accountConnectedRaffle = raffle.connect(accounts[i]); // raffle connected with 3 new players, instead of deployer 
                    await accountConnectedRaffle.enterRaffle({value: raffleEntranceFee})
                }
                const startingTimeStamp = await raffle.getLatestTimeStamp()

                // performUpkeep (mock Chainlink Keepers)
                // fulfillRandomWords (mock being the chainlink VRF)

                await new Promise( async(resolve, reject) => {     // promise can be resolved or rejected 
                    raffle.once("WinnerPicked", async function() { //fulfillRandomWords emits an event WinnerPicked
                        console.log("event found!")                // listen and wait for the event, once the event is fired, do the followin'
                        try{ // we r doin' try catch cuz we dont want the listener to listen forever (what if theres a problem on server side?)
                             // if timeToRespond > 300s, error will be thrown and rrpomise rejected
                            const recentWinner = await raffle.getRecentWinner()
                            const raffleState = await raffle.getRaffleState()
                            const endingTimeStamp = await raffle.getLatestTimeStamp()
                            const numPlayers = await raffle.getNumOfPlayers()
                            const winnerEndingBalance = await accounts[1].getBalance()

                            console.log(`deployer: ${accounts[0].address}`)
                            console.log(`first player: ${accounts[1].address}`)
                            console.log(`second player: ${accounts[2].address}`)
                            console.log(`third player: ${accounts[3].address}`)
                            console.log(`recent winner: ${recentWinner}`)

                            assert.equal(numPlayers.toString(), "0")  // checking "resets the lottery"
                            assert.equal(raffleState.toString(), "0")
                            assert(endingTimeStamp > startingTimeStamp)
                            
                            assert.equal(
                                winnerEndingBalance.toString(),
                                winnerStartingBlance.add(
                                    raffleEntranceFee
                                        .mul(additionalEntrants)
                                        .add(raffleEntranceFee)
                                        .toString()
                                )
                            )
                            resolve() // if try passes, resolves the promise  
                        }
                        catch (e) {
                            reject(e) //if try fails, rejects the promise
                        }
                    })

                    const tx = await raffle.performUpkeep([])
                    const txReceipt =  await tx.wait(1)
                    const winnerStartingBlance = await accounts[1].getBalance() // player 1 will always be the winner (dunno why)
                    await vrfCoordinatorV2Mock.fulfillRandomWords(
                        txReceipt.events[1].args.requestId,
                        raffle.address
                    ) // fullfillRandomWords will emit an event 
                })
            })
        })
    })