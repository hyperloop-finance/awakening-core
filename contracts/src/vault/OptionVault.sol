// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (c) 2025 Morpho Association
pragma solidity 0.8.34;

import {IOptionVault} from "../interfaces/IOptionVault.sol";
import {SafeTransferLib} from "../libraries/SafeTransferLib.sol";

/// @dev Dedicated escrow for loan tokens during the two-step take window (phase 1 → phase 2).
/// @dev Only Awakening can deposit and refund.
/// @dev Escrowed balances are tracked per token so they are isolated from Awakening's own working balance and can
/// never be over-withdrawn (refund reverts on underflow).
contract OptionVault is IOptionVault {
    address public immutable AWAKENING;

    /// @dev Amount of `token` currently held in escrow.
    mapping(address token => uint256) public escrowed;

    constructor(address awakening) {
        AWAKENING = awakening;
    }

    /// @dev Pulls `amount` of `token` from Awakening into escrow.
    function deposit(address token, uint256 amount) external {
        require(msg.sender == AWAKENING, OnlyAwakening());
        escrowed[token] += amount;
        SafeTransferLib.safeTransferFrom(token, msg.sender, address(this), amount);
    }

    /// @dev Refunds `amount` of `token` to `to` on take cancellation / timeout.
    function refund(address token, address to, uint256 amount) external {
        require(msg.sender == AWAKENING, OnlyAwakening());
        escrowed[token] -= amount;
        SafeTransferLib.safeTransfer(token, to, amount);
    }
}
