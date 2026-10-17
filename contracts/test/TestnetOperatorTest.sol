// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;
import {Test} from "forge-std/Test.sol";
import {TestnetOperator} from "../script/TestnetOperator.s.sol";
contract TestnetOperatorTest is Test {
    function testRefusesWrongChainBeforeSigning() public {
        TestnetOperator op=new TestnetOperator();vm.chainId(56);
        vm.expectRevert("BSC testnet only");op.run();
    }
    function testRefusesNonKeeperBeforeSigning() public {
        TestnetOperator op=new TestnetOperator();vm.chainId(97);
        address core=0x99Cc7186E22F6d717FF7692d7e09F8cEd223f3C9;
        vm.mockCall(core,abi.encodeWithSignature("INITIAL_CHAIN_ID()"),abi.encode(uint256(97)));
        vm.mockCall(core,abi.encodeWithSignature("optionKeeper()"),abi.encode(address(0xBEEF)));
        vm.expectRevert("Wrong test operator");op.run();
    }
}
