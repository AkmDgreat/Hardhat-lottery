// enter the lottery by paying some amount
// pick a verifiably random number
//winner should be selected every x minutes

//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol"; //yarn add --dev @chainlink/contracts
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";

error Raffle__NotEnoughEntranceFee();
error Raffle__TransferFailed();
error Raffle__NotOpen();
error Raffle__UpkeepNotNeeded(uint256 currentBalance, uint256 numOfPlayers, uint256 raffleState);

contract Raffle is VRFConsumerBaseV2, KeeperCompatibleInterface {

    //Type declarations
    enum RaffleState {OPEN, CALCULATING} //we r secretly doing: uint256 0 = OPEN, uint256 1 = CALCULATING
    // From "when we request random no." to "we have selected a winner", we dont want anybody to be able to enter the lottery

    // state variables 
    uint256 private immutable i_entranceFee; // immutable cuz we set the variable only once
    address payable[] private s_players; // array to store the plyers 
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane; //max gas in gwei that we want yo use while requesting the random no.
    uint64 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGasLimit;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;//How many confirmations should chainlink node wait b4 responding
    uint32 private constant NUM_WORDS = 1;

    //Lottery variables
    address private s_recentWinner;
    RaffleState private s_raffleState;
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_interval;

    //events
    event raffleEnter(address indexed player);
    event RequestedRaffleWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed winner);

    constructor(address vrfCoordinatorV2, 
                uint256 entranceFee, 
                bytes32 gasLane, 
                uint64 subscriptionId, 
                uint32 callbackGasLimit, //Raffle contract inherits VRFConsumerBaseV2 contract.The latter one has a constructor whose argument is vrfcoordinatorv2
                uint256 interval)        
        VRFConsumerBaseV2(vrfCoordinatorV2){ 
            i_entranceFee = entranceFee;
            i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
            i_gasLane = gasLane;
            i_subscriptionId = subscriptionId;
            i_callbackGasLimit = callbackGasLimit;
            s_raffleState = RaffleState.OPEN; //s_raffleState = 0
            s_lastTimeStamp = block.timestamp; // s_lastTimeStamp = time when the contract is deployed
            i_interval = interval;
    }

    function enterRaffle() public payable{
        // require(msg.value > i_entranceFee, "Bet more, kid!") //costly
        if(msg.value < i_entranceFee){
            revert  Raffle__NotEnoughEntranceFee();
        }
        if(s_raffleState != RaffleState.OPEN){
            revert Raffle__NotOpen();
        }
        s_players.push(payable(msg.sender));
        //emit an event whenever u update a dynamic array or mapping
        emit raffleEnter(msg.sender);
    }

    /* this function checks if its time to select a winner and transfer the funds
       upkeepNeeded is true if: 1. The time interval has passed between raffle runs.
                                2. The lottery is open.
                                3. The contract has ETH.
                                4. Implicity, your subscription is funded with LINK.
    */

    function checkUpkeep(bytes memory /*checkData*/) public override returns (bool upkeepNeeded, bytes memory /*performData*/){
        bool isOpen = (RaffleState.OPEN == s_raffleState); //is (0 == 0)
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
        bool hasEnoughPlayers = (s_players.length > 0);
        bool hasEnoughBalance = (address(this).balance > 0);
        upkeepNeeded = (isOpen && timePassed && hasEnoughPlayers && hasEnoughBalance);
    }

    function performUpkeep(bytes calldata /* performData */) external override{
        //1. Request a random number 
        //2. Do something with it
        //ChainlinkVRF is a 2 txn proccess

        // if upkeepNeeded is false (ie.)
        (bool upkeepNeeded, ) = checkUpkeep(""); //we are extracting upkeepNeeded from checkupKeeep // we arent passing any arguments
        if(!upkeepNeeded){
            revert Raffle__UpkeepNotNeeded(
                 address(this).balance,
                 s_players.length, 
                 uint256(s_raffleState)
            );
        }

        s_raffleState = RaffleState.CALCULATING;
        uint256 requestId = i_vrfCoordinator.requestRandomWords( // requestRandomWords function returns a requestId
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit, // how much gas can function fulfillRandomWords use
            NUM_WORDS // how many random nos. do we need
        );
        emit RequestedRaffleWinner(requestId);
    }

    function fulfillRandomWords(uint256 /*requestId*/, uint256[] memory randomWords) internal override{
        //Pick a random winner from the s_players array
        uint256 indexOfWinner = randomWords[0] % s_players.length; // we are only gettin' 1 random no. (will be stored in index 0 0f randomWords array)
        address payable RecentWinner = s_players[indexOfWinner]; // RecentWinner is the address of the recent winner
        s_recentWinner = RecentWinner;
        s_raffleState = RaffleState.OPEN;
        s_players = new address payable[](0); // resetting the players array
        s_lastTimeStamp = block.timestamp; //resetting the lastTimeStamp
        (bool success, ) = RecentWinner.call{value: address(this).balance}("");
        if (!success){
            revert Raffle__TransferFailed();
        }
        emit WinnerPicked(RecentWinner); //recent winner will be logged

    }
    // 202 % 10 = 2 // 202 = 10*20 + 2 // 0 < 2 < (10-1) // 0 < indexOfWinner < s_players.length -1

    // View & pure functions
    function getEntranceFee() public view returns(uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns(address) {
        return s_players[index];
    }

    function getRecentWinner() public view returns(address){
        return s_recentWinner;
    }

    function getRaffleState() public view returns(RaffleState) {
        return s_raffleState; //reading a state variable
    }

    function getNumWords() public pure returns(uint256) {
        return NUM_WORDS; // return 1, hence pure not view
    }

    function getNumOfPlayers() public view returns(uint256) {
        return s_players.length;
    }

    function getLatestTimeStamp() public view returns(uint256) {
        return s_lastTimeStamp;
    }

    function getRequestConfirmations() public pure returns(uint256) {
        return REQUEST_CONFIRMATIONS;
    }

    function getInterval() public view returns(uint256) {
        return i_interval;
    }
}

//yarn global add hardhat-shorthand // Now: yarn hardhat <=> hh



