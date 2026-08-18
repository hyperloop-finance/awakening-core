// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (c) 2025 Morpho Association
pragma solidity ^0.8.0;

import {Test} from "../lib/forge-std/src/Test.sol";
import {stdError} from "../lib/forge-std/src/StdError.sol";
import {ERC20} from "./erc20s/ERC20.sol";
import {Awakening} from "../src/Awakening.sol";
import {OptionVault} from "../src/vault/OptionVault.sol";
import {IOptionVault} from "../src/interfaces/IOptionVault.sol";

contract OptionVaultTest is Test {
    Awakening internal awakening;
    OptionVault internal vault;
    ERC20 internal token;

    address internal optionKeeper = makeAddr("optionKeeper");
    address internal newOptionKeeper = makeAddr("newOptionKeeper");
    address internal rdm = makeAddr("rdm");

    function setUp() public {
        awakening = new Awakening();
        vault = new OptionVault(address(awakening));
        token = new ERC20("USDC", "USDC");

        awakening.setOptionKeeper(optionKeeper);
    }

    /// @dev Simulates Awakening escrowing `amount` into the vault.
    function _deposit(uint256 amount) internal {
        deal(address(token), address(awakening), amount);
        vm.startPrank(address(awakening));
        token.approve(address(vault), type(uint256).max);
        vault.deposit(address(token), amount);
        vm.stopPrank();
    }

    // --- deposit ---

    function testDepositOnlyAwakening() public {
        vm.prank(rdm);
        vm.expectRevert(IOptionVault.OnlyAwakening.selector);
        vault.deposit(address(token), 1e18);
    }

    function testDepositIncreasesEscrow(uint256 amount) public {
        amount = bound(amount, 1, type(uint128).max);
        _deposit(amount);

        assertEq(vault.escrowed(address(token)), amount, "escrowed");
        assertEq(token.balanceOf(address(vault)), amount, "vault balance");
    }

    // --- withdrawTo ---

    function testWithdrawToOnlyOptionKeeper(uint256 amount) public {
        amount = bound(amount, 1, type(uint128).max);
        _deposit(amount);

        vm.prank(rdm);
        vm.expectRevert(IOptionVault.OnlyOptionKeeper.selector);
        vault.withdrawTo(address(token), rdm, amount);
    }

    function testWithdrawToSuccess(uint256 amount) public {
        amount = bound(amount, 1, type(uint128).max);
        _deposit(amount);

        vm.prank(optionKeeper);
        vault.withdrawTo(address(token), rdm, amount);

        assertEq(vault.escrowed(address(token)), 0, "escrowed drained");
        assertEq(token.balanceOf(rdm), amount, "receiver balance");
    }

    function testWithdrawToUsesUpdatedOptionKeeper(uint256 amount) public {
        amount = bound(amount, 1, type(uint128).max);
        _deposit(amount);

        awakening.setOptionKeeper(newOptionKeeper);

        vm.prank(optionKeeper);
        vm.expectRevert(IOptionVault.OnlyOptionKeeper.selector);
        vault.withdrawTo(address(token), rdm, amount);

        vm.prank(newOptionKeeper);
        vault.withdrawTo(address(token), rdm, amount);
        assertEq(token.balanceOf(rdm), amount, "receiver balance");
    }

    function testWithdrawToExceedsEscrowReverts(uint256 amount) public {
        amount = bound(amount, 1, type(uint128).max);
        _deposit(amount);

        vm.prank(optionKeeper);
        vm.expectRevert(stdError.arithmeticError);
        vault.withdrawTo(address(token), rdm, amount + 1);
    }

    // --- refund ---

    function testRefundOnlyAwakening(uint256 amount) public {
        amount = bound(amount, 1, type(uint128).max);
        _deposit(amount);

        vm.prank(rdm);
        vm.expectRevert(IOptionVault.OnlyAwakening.selector);
        vault.refund(address(token), rdm, amount);
    }

    function testRefundSuccess(uint256 amount) public {
        amount = bound(amount, 1, type(uint128).max);
        _deposit(amount);

        vm.prank(address(awakening));
        vault.refund(address(token), rdm, amount);

        assertEq(vault.escrowed(address(token)), 0, "escrowed drained");
        assertEq(token.balanceOf(rdm), amount, "receiver balance");
    }

    function testRefundExceedsEscrowReverts(uint256 amount) public {
        amount = bound(amount, 1, type(uint128).max);
        _deposit(amount);

        vm.prank(address(awakening));
        vm.expectRevert(stdError.arithmeticError);
        vault.refund(address(token), rdm, amount + 1);
    }
}
