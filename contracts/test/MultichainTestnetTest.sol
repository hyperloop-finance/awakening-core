// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import {Test} from "forge-std/Test.sol";
import {TestToken} from "../src/testnet/TestToken.sol";
import {TestOracle} from "../src/testnet/TestOracle.sol";
import {UtilsLib} from "../src/libraries/UtilsLib.sol";

contract MultichainTestnetTest is Test {
    function testMsbBoundaryValues() public pure {
        assertEq(UtilsLib.msb(0), type(uint256).max);
        assertEq(UtilsLib.msb(1), 0);
        assertEq(UtilsLib.msb(uint128(1) << 127), 127);
        assertEq(UtilsLib.msb(type(uint128).max), 127);
    }

    function testFuzzMsbMatchesReference(uint128 bitmap, uint8 shift) public pure {
        bitmap >>= shift % 128;
        uint256 expected = type(uint256).max;
        uint128 remaining = bitmap;
        while (remaining != 0) {
            unchecked { ++expected; }
            remaining >>= 1;
        }
        assertEq(UtilsLib.msb(bitmap), expected);
    }

    function testMsbEveryBitPosition() public pure {
        for (uint256 bit; bit < 128; bit++) {
            uint128 value = uint128(uint256(1) << bit);
            assertEq(UtilsLib.msb(value), bit);
            if (bit != 0) assertEq(UtilsLib.msb(value - 1), bit - 1);
        }
    }

    function testSupportedTestnets() public {
        uint256[4] memory chains = [uint256(97), 31337, 421614, 46630];
        for (uint256 i; i < chains.length; i++) {
            vm.chainId(chains[i]);
            TestToken token = new TestToken("Test USDC", "tUSDC", 6);
            token.faucet();
            assertEq(token.balanceOf(address(this)), 1000e6);
            assertEq(token.totalSupply(), 1000e6);
            TestOracle oracle = new TestOracle(address(this), 2000e18);
            assertEq(oracle.owner(), address(this));
            assertEq(oracle.price(), 2000e18);
            oracle.setPrice(2100e18);
            assertEq(oracle.price(), 2100e18);
            vm.prank(address(0xBEEF));
            vm.expectRevert("Only owner");
            oracle.setPrice(1);
        }
    }

    function testUnsupportedChainsRevert() public {
        uint256[5] memory chains = [uint256(1), 56, 42161, 4663, 999];
        for (uint256 i; i < chains.length; i++) {
            vm.chainId(chains[i]);
            vm.expectRevert("Testnet only");
            new TestToken("Test USDC", "tUSDC", 6);
            vm.expectRevert("Testnet only");
            new TestOracle(address(this), 2000e18);
        }
    }
}
