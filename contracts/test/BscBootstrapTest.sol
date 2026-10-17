// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;
import {Test} from "forge-std/Test.sol";
import {TestToken} from "../src/testnet/TestToken.sol";
import {TestOracle} from "../src/testnet/TestOracle.sol";
import {BootstrapBscTestnet} from "../script/BootstrapBscTestnet.s.sol";

contract BscBootstrapTest is Test {
    function testBootstrapRejectsWrongCoreChain() public {
        vm.chainId(97);
        BootstrapBscTestnet bootstrap=new BootstrapBscTestnet();
        vm.mockCall(0x99Cc7186E22F6d717FF7692d7e09F8cEd223f3C9,abi.encodeWithSignature("INITIAL_CHAIN_ID()"),abi.encode(uint256(56)));
        vm.expectRevert("Wrong core");bootstrap.run();
    }
    function testBootstrapRejectsMainnetBeforeBroadcast() public {
        vm.chainId(56);BootstrapBscTestnet bootstrap=new BootstrapBscTestnet();
        vm.expectRevert("BSC testnet only");bootstrap.run();
    }
    function testRejectsMainnet() public {
        vm.chainId(56);
        vm.expectRevert("Testnet only");
        new TestToken("Test BTC", "tBTC", 8);
    }
    function testFaucetAndTransfer() public {
        vm.chainId(31337);
        TestToken token = new TestToken("Test BTC", "tBTC", 8);
        vm.prank(address(1)); token.faucet();
        assertEq(token.balanceOf(address(1)),1000 * 1e8);
        vm.prank(address(1)); token.transfer(address(2),1e8);
        assertEq(token.balanceOf(address(2)),1e8);
    }
    function testOracleOnlyOwner() public {
        vm.chainId(31337);
        TestOracle oracle = new TestOracle(address(this), 600e36);
        vm.prank(address(0xBEEF)); vm.expectRevert("Only owner"); oracle.setPrice(1);
        oracle.setPrice(500e36);
        assertEq(oracle.price(),500e36);
    }
}
