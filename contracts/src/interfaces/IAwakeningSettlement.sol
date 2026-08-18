// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (c) 2025 Morpho Association
pragma solidity >=0.5.0;

import {SettlementState} from "./IAwakening.sol";

/// @dev Maturity settlement state machine for a market.
/// @dev PRE_MATURITY → ORACLE_READ → PAT_REDEEMED → REPAY_WINDOW_OPEN → REPAY_WINDOW_CLOSED → FINAL.
interface IAwakeningSettlement {
    /// @dev Reads the BTC oracle exactly once at maturity and stores the terminal price.
    function readOracleAtMaturity(bytes32 id) external;

    /// @dev Redeems the put options attributed to a market, collecting their payouts.
    function redeemPATs(bytes32 id) external;

    /// @dev Borrower repays principal and reclaims collateral, only during the repayment window.
    function repay(bytes32 id, uint256 units) external;

    /// @dev Settles a defaulted loan: the option keeper sells the put + BTC off-chain and reports net proceeds.
    function settle(bytes32 id, uint256 proceeds) external;

    /// @dev Returns the current settlement state of a market.
    function state(bytes32 id) external view returns (SettlementState);
}
