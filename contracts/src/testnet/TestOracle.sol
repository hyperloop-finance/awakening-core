// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

/// @notice Explicitly simulated test prices. Never a production price feed.
contract TestOracle {
    address public immutable owner;
    uint256 public price;
    event PriceSet(uint256 price);
    constructor(address operator,uint256 initialPrice) {
        require(block.chainid==97 || block.chainid==31337 || block.chainid==421614 || block.chainid==46630,"Testnet only");
        require(operator!=address(0),"Zero owner"); owner=operator; price=initialPrice;
    }
    function setPrice(uint256 newPrice) external {
        require(msg.sender==owner,"Only owner"); price=newPrice; emit PriceSet(newPrice);
    }
}
