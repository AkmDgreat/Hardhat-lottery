// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

// yarn add --dev @openzeppelin/contracts
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract OurToken is ERC20 {

    constructor() ERC20("OurToken", "OT") {
        
    }
}

//'tis is not the part of this project.