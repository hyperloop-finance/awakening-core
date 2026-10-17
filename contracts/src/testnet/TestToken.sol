// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

/// @notice Valueless, permissionless faucet token for chain 97/local integration tests only.
contract TestToken {
    string public name;
    string public symbol;
    uint8 public immutable decimals;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);
    constructor(string memory n, string memory s, uint8 d) {
        require(block.chainid == 97 || block.chainid == 31337, "Testnet only");
        require(d <= 18,"Decimals"); name=n; symbol=s; decimals=d;
    }
    function faucet() external {
        uint256 amount=1000 * 10 ** decimals;
        totalSupply+=amount; balanceOf[msg.sender]+=amount;
        emit Transfer(address(0),msg.sender,amount);
    }
    function approve(address spender,uint256 amount) external returns(bool) {
        allowance[msg.sender][spender]=amount; emit Approval(msg.sender,spender,amount); return true;
    }
    function transfer(address to,uint256 amount) external returns(bool) { _transfer(msg.sender,to,amount); return true; }
    function transferFrom(address from,address to,uint256 amount) external returns(bool) {
        uint256 approved=allowance[from][msg.sender];
        if (approved!=type(uint256).max) allowance[from][msg.sender]=approved-amount;
        _transfer(from,to,amount); return true;
    }
    function _transfer(address from,address to,uint256 amount) internal {
        require(to!=address(0),"Zero recipient");
        balanceOf[from]-=amount; balanceOf[to]+=amount; emit Transfer(from,to,amount);
    }
}
