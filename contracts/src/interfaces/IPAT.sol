// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (c) 2025 Morpho Association
pragma solidity >=0.5.0;

/// @dev Terms of a put option attributed to a loan.
struct OptionTerms {
    /// @dev Collateral token (BTC).
    address underlying;
    /// @dev Loan token (USDC).
    address quoteToken;
    /// @dev Quote per underlying, scaled by ORACLE_PRICE_SCALE (1e36).
    uint256 strike;
    /// @dev Underlying amount (BTC).
    uint256 notional;
    /// @dev Maturity timestamp.
    uint256 expiry;
    /// @dev Always true in Awakening.
    bool isPut;
    /// @dev Unique trade id (Deribit order id) binding this attestation to a single put purchase.
    bytes32 tradeId;
}

/// @dev Minimal interface for a put-attribution token (PAT) — a non-fungible record of an off-chain put option
/// purchase, minted only against a custodian's attestation.
interface IPAT {
    error InvalidAttestation();
    error NotOwner();
    error AlreadySettled();
    error TradeIdAlreadyUsed();
    error ZeroTradeId();

    /// @dev Mints a PAT for `to` after verifying `attestation` is the custodian's signature over `terms`.
    function mint(OptionTerms memory terms, bytes memory attestation, address to) external returns (uint256 tokenId);

    /// @dev Returns the option terms attributed to `tokenId`.
    function terms(uint256 tokenId) external view returns (OptionTerms memory);

    /// @dev Transfers the PAT to a new owner (used to attribute the option to its beneficiary).
    function attribute(uint256 tokenId, address newOwner) external;

    /// @dev Marks the option settled and records its payout.
    function settle(uint256 tokenId, address to, uint256 payout) external;
}
