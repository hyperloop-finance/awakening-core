// SPDX-License-Identifier: GPL-2.0-or-later

using Utils as Utils;

methods {
    function multicall(bytes[]) external => HAVOC_ALL DELETE;

    function tickSpacing(bytes32) external returns (uint8) envfree;
    function Utils.hashMarket(Awakening.Market) external returns (bytes32) envfree;

    // Over-approximate view functions for prover performance.
    function settlementFee(bytes32, uint256) internal returns (uint256) => NONDET;
    function UtilsLib.msb(uint128) internal returns (uint256) => NONDET;
    function UtilsLib.countBits(uint128) internal returns (uint256) => NONDET;
    function TickLib.tickToPrice(uint256) internal returns (uint256) => NONDET;
    function TickLib.wExp(int256) internal returns (uint256) => NONDET;
    function UtilsLib.mulDivUp(uint256, uint256, uint256) internal returns (uint256) => NONDET;

    // Deterministic summary of mulDivDown, which is sound because mulDivDown is deterministic.
    function UtilsLib.mulDivDown(uint256 x, uint256 y, uint256 d) internal returns (uint256) => ghostMulDivDown(x, y, d);

    // Summary is required because abi.encodePacked doesn't ensure injectivity of the hash function in CVL, for an unknown reason.
    function IdLib.toId(Awakening.Market memory market, uint256, address) internal returns (bytes32) => summaryToId(market);

    // Sound because the protocol doesn't use toMarket.
    function IdLib.storeInCode(Awakening.Market memory, uint256) internal returns (address) => NONDET;

    // Tokens are assumed to not reenter, for performance reasons.
    function SafeTransferLib.safeTransferFrom(address, address, address, uint256) internal => NONDET;
    function SafeTransferLib.safeTransfer(address, address, uint256) internal => NONDET;
}

/// HELPERS ///

definition WAD() returns uint256 = 10 ^ 18;

persistent ghost ghostMulDivDown(uint256, uint256, uint256) returns uint256;

function summaryToId(Awakening.Market market) returns (bytes32) {
    return Utils.hashMarket(market);
}

function marketIsCreated(Awakening.Market market) returns (bool) {
    return tickSpacing(summaryToId(market)) > 0;
}

/// RULES ///

// Show that a created market has at least one collateral.
strong invariant createdMarketsHaveNonEmptyCollaterals(Awakening.Market market)
    marketIsCreated(market) => market.collateralParams.length > 0;

// Show that a created market has sorted collateralParams.
strong invariant createdMarketsHaveSortedCollaterals(Awakening.Market market, uint256 i, uint256 j)
    marketIsCreated(market) => i < j => j < market.collateralParams.length => market.collateralParams[i].token < market.collateralParams[j].token;

// Show that a created market do not have address(0) collateralParams.
strong invariant createdMarketsHaveNonZeroCollaterals(Awakening.Market market, uint256 i)
    marketIsCreated(market) => i < market.collateralParams.length => market.collateralParams[i].token != 0;

// Show that a created market cannot be deleted.
rule marketCannotBeDeleted(env e, method f, calldataarg args, Awakening.Market market) {
    require marketIsCreated(market), "Assume that the market is created";
    f(e, args);
    assert marketIsCreated(market);
}

// Show that a market is created after an interaction.

rule marketIsCreatedAfterTouchMarket(env e, Awakening.Market market) {
    touchMarket(e, market);
    assert marketIsCreated(market);
}

rule marketIsCreatedAfterTake(env e, Awakening.Offer offer, bytes ratifierData, uint256 units, address taker, address receiverIfTakerIsSeller, address takerCallback, bytes takerCallbackData) {
    take(e, offer, ratifierData, units, taker, receiverIfTakerIsSeller, takerCallback, takerCallbackData);
    assert marketIsCreated(offer.market);
}

rule marketIsCreatedAfterWithdraw(env e, Awakening.Market market, uint256 units, address onBehalf, address receiver) {
    withdraw(e, market, units, onBehalf, receiver);
    assert marketIsCreated(market);
}

rule marketIsCreatedAfterRepay(env e, Awakening.Market market, uint256 units, address onBehalf, address callback, bytes data) {
    repay(e, market, units, onBehalf, callback, data);
    assert marketIsCreated(market);
}

rule marketIsCreatedAfterSupplyCollateral(env e, Awakening.Market market, uint256 collateralIndex, uint256 assets, address onBehalf) {
    supplyCollateral(e, market, collateralIndex, assets, onBehalf);
    assert marketIsCreated(market);
}

rule marketIsCreatedAfterWithdrawCollateral(env e, Awakening.Market market, uint256 collateralIndex, uint256 assets, address onBehalf, address receiver) {
    withdrawCollateral(e, market, collateralIndex, assets, onBehalf, receiver);
    assert marketIsCreated(market);
}

// Markets can only be created by: touchMarket, take, withdraw, repay, supplyCollateral or withdrawCollateral.
rule onlyTouchMarketCreatesMarket(env e, method f, calldataarg args, Awakening.Market market)
filtered {
    f -> f.selector != sig:touchMarket(Awakening.Market).selector
        && f.selector != sig:take(Awakening.Offer, bytes, uint256, address, address, address, bytes).selector
        && f.selector != sig:withdraw(Awakening.Market, uint256, address, address).selector
        && f.selector != sig:repay(Awakening.Market, uint256, address, address, bytes).selector
        && f.selector != sig:supplyCollateral(Awakening.Market, uint256, uint256, address).selector
        && f.selector != sig:withdrawCollateral(Awakening.Market, uint256, uint256, address, address).selector
} {
    require !marketIsCreated(market), "Assume that the market is not created";
    f(e, args);
    assert !marketIsCreated(market);
}
