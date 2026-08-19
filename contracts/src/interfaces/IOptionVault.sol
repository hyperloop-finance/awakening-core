// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (c) 2025 Morpho Association
pragma solidity >=0.5.0;

/// @dev Dedicated escrow for loan tokens during the two-step take window (phase 1 → phase 2).
/// @dev Only Awakening can deposit and refund; funds are released on completion (premium to the keeper, net to the
/// borrower, settlement fee to Awakening) or rollback.
interface IOptionVault {
    /// ERRORS ///
    error OnlyAwakening();

    /// @dev Deposits `amount` of `token` into escrow.
    function deposit(address token, uint256 amount) external;

    /// @dev Refunds `amount` of `token` to `to` on take cancellation / timeout.
    function refund(address token, address to, uint256 amount) external;
}
