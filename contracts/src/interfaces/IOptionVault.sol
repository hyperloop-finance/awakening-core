// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (c) 2025 Morpho Association
pragma solidity >=0.5.0;

/// @dev Dedicated escrow for loan tokens during the two-step take window (phase 1 → phase 2).
/// @dev The option keeper withdraws escrowed loan tokens to buy the put off-chain, then the completion
/// step transfers the remaining loan tokens to the borrower.
interface IOptionVault {
    /// @dev Deposits `amount` of `token` into escrow.
    function deposit(address token, uint256 amount) external;

    /// @dev Withdraws `amount` of `token` to `to` (used by the option keeper to buy the put off-chain).
    function withdrawTo(address token, address to, uint256 amount) external;

    /// @dev Refunds `amount` of `token` to `to` on take cancellation / timeout.
    function refund(address token, address to, uint256 amount) external;
}
