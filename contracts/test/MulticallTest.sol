// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (c) 2025 Morpho Association
pragma solidity ^0.8.0;

import {BaseTest} from "./BaseTest.sol";
import {IAwakening} from "../src/interfaces/IAwakening.sol";

contract MulticallTest is BaseTest {
    function testMulticallSuccess() public {
        bytes[] memory data = new bytes[](2);
        data[0] = abi.encodeCall(awakening.setFeeSetter, (makeAddr("newFeeSetter")));
        data[1] = abi.encodeCall(awakening.setRoleSetter, (makeAddr("newRoleSetter")));

        vm.prank(awakening.roleSetter());
        awakening.multicall(data);

        assertEq(awakening.roleSetter(), makeAddr("newRoleSetter"), "wrong role setter");
        assertEq(awakening.feeSetter(), makeAddr("newFeeSetter"), "wrong fee setter");
    }

    function testMulticallFailing() public {
        bytes[] memory data = new bytes[](2);
        data[0] = abi.encodeCall(awakening.setRoleSetter, (makeAddr("newRoleSetter")));
        data[1] = abi.encodeCall(awakening.setFeeSetter, (makeAddr("newFeeSetter")));

        vm.prank(awakening.roleSetter());
        vm.expectRevert(IAwakening.OnlyRoleSetter.selector);
        awakening.multicall(data);
    }

    function testMulticallEmpty() public {
        awakening.multicall(new bytes[](0));
    }
}
