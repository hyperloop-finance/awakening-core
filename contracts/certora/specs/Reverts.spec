// SPDX-License-Identifier: GPL-2.0-or-later

import "BitmapSummaries.spec";

using Utils as Utils;

methods {
    function multicall(bytes[]) external => HAVOC_ALL DELETE;

    function debtOf(bytes32 id, address user) external returns (uint128) envfree;
    function creditOf(bytes32 id, address user) external returns (uint128) envfree;
    function collateral(bytes32 id, address user, uint256) external returns (uint128) envfree;
    function collateralBitmap(bytes32 id, address user) external returns (uint128) envfree;
    function Utils.hashMarket(Awakening.Market) external returns (bytes32) envfree;
    function Utils.callbackSuccess() external returns (bytes32) envfree;

    // Oracle: routed through CVL function to allow ghost flags to force specific behaviors (revert, return zero) per rule.
    // calledContract is used to target a single oracle address for per-oracle revert control (used by oracle revert/zero rules).
    function _.price() external => CVL_oraclePrice(calledContract) expect(uint256);

    // Gates: routed through CVL functions using calledContract to identify which gate is being called.
    // Return values are deterministic per gate address via ghost functions, so
    // rules can constrain a specific gate's return value without affecting other gates. Each call can also
    // nondeterministically revert, modeling that external gates can fail for any reason.
    function _.canIncreaseCredit(address) external => summaryCanIncreaseCredit(calledContract) expect(bool);
    function _.canIncreaseDebt(address) external => summaryCanIncreaseDebt(calledContract) expect(bool);

    // Callbacks: ghost-controlled to force revert/bad-return per rule. Modeled as pure (no state changes):
    // For callback-revert rules, the callback reverts so that it's equivalent to the real behavior of EVM.
    // For gate rules, gate checks precede callbacks so re-entrant state changes cannot affect them.
    // For oracle rules, re-entrant callbacks cannot deactivate collaterals without calling
    // withdrawCollateral -> isHealthy which would hit the same reverting/zero oracle.
    function _.onBuy(bytes32, Awakening.Market, uint256, uint256, uint256, address, bytes) external => CVL_callbackBytes32() expect(bytes32);
    function _.onSell(bytes32, Awakening.Market, uint256, uint256, uint256, address, address, bytes) external => CVL_callbackBytes32() expect(bytes32);
    function _.isRatified(Awakening.Offer, bytes) external => CVL_callbackBytes32() expect(bytes32);
    function _.onRepay(bytes32, Awakening.Market, uint256, address, bytes) external => CVL_callbackBytes32() expect(bytes32);
    function _.onFlashLoan(address, address[], uint256[], bytes) external => CVL_callbackBytes32() expect(bytes32);

    // Token transfers: routed through CVL functions to force revert per rule. Modeled as no-op on success
    // (no balance tracking), which is sound for revert-propagation rules.
    function SafeTransferLib.safeTransferFrom(address, address, address, uint256) internal => CVL_safeTransferFrom();
    function SafeTransferLib.safeTransfer(address, address, uint256) internal => CVL_safeTransfer();

    // Bitmap operations (msb, clearBit, setBit) are provided by BitmapSummaries.spec.
    function IdLib.toId(Awakening.Market memory market, uint256, address) internal returns (bytes32) => summaryToId(market);

    // The function toMarket is not used by the protocol.
    function IdLib.storeInCode(Awakening.Market memory, uint256) internal returns (address) => NONDET;

    function TickLib.tickToPrice(uint256) internal returns (uint256) => NONDET;
    function UtilsLib.mulDivDown(uint256 a, uint256 b, uint256 denominator) internal returns (uint256) => CVL_mulDivDown(a, b, denominator);
    function UtilsLib.mulDivUp(uint256 a, uint256 b, uint256 denominator) internal returns (uint256) => CVL_mulDivUp(a, b, denominator);
}

// needed for oracle returns zero case
persistent ghost CVL_mulDivDownGhost(uint256, uint256, uint256) returns uint256 {
    axiom forall uint256 a. forall uint256 d. d > 0 => CVL_mulDivDownGhost(a, 0, d) == 0;
    axiom forall uint256 b. forall uint256 d. d > 0 => CVL_mulDivDownGhost(0, b, d) == 0;
}

// needed for oracle returns zero case
persistent ghost CVL_mulDivUpGhost(uint256, uint256, uint256) returns uint256 {
    axiom forall uint256 a. forall uint256 d. d > 0 => CVL_mulDivUpGhost(a, 0, d) == 0;
    axiom forall uint256 b. forall uint256 d. d > 0 => CVL_mulDivUpGhost(0, b, d) == 0;
}

function CVL_mulDivDown(uint256 a, uint256 b, uint256 d) returns uint256 {
    if (d == 0) {
        revert();
    }
    return CVL_mulDivDownGhost(a, b, d);
}

function CVL_mulDivUp(uint256 a, uint256 b, uint256 d) returns uint256 {
    if (d == 0) {
        revert();
    }
    return CVL_mulDivUpGhost(a, b, d);
}

/// GHOST FLAGS ///

persistent ghost bool forceOracleRevert;

// Per-oracle revert: only the oracle at this address reverts.
persistent ghost address singleRevertingOracle;

persistent ghost bool forceOracleReturnZero;

// Per-oracle zero return: only the oracle at this address returns 0.
persistent ghost address singleZeroOracle;

persistent ghost ghostCanIncreaseCredit(address) returns bool;

persistent ghost ghostCanIncreaseDebt(address) returns bool;

persistent ghost bool forceCallbackRevert;

persistent ghost bool forceCallbackBadReturn;

persistent ghost bool forceTransferRevert;

persistent ghost bool forceTransferFromRevert;

/// SUMMARIES ///

function summaryToId(Awakening.Market market) returns (bytes32) {
    return Utils.hashMarket(market);
}

function CVL_oraclePrice(address oracle) returns uint256 {
    bool shouldRevert;
    if (shouldRevert || forceOracleRevert || oracle == singleRevertingOracle) {
        revert();
    }
    if (forceOracleReturnZero || oracle == singleZeroOracle) {
        return 0;
    }
    uint256 price;
    return price;
}

function summaryCanIncreaseCredit(address gate) returns bool {
    bool shouldRevert;
    if (shouldRevert) {
        revert();
    }
    return ghostCanIncreaseCredit(gate);
}

function summaryCanIncreaseDebt(address gate) returns bool {
    bool shouldRevert;
    if (shouldRevert) {
        revert();
    }
    return ghostCanIncreaseDebt(gate);
}

function CVL_callbackBytes32() returns bytes32 {
    bool shouldRevert;
    if (shouldRevert || forceCallbackRevert) {
        revert();
    }
    if (forceCallbackBadReturn) {
        bytes32 bad;
        require bad != Utils.callbackSuccess(), "not CALLBACK_SUCCESS";
        return bad;
    }
    bytes32 result;
    return result;
}

function CVL_safeTransferFrom() {
    bool shouldRevert;
    if (shouldRevert || forceTransferFromRevert) {
        revert();
    }
}

function CVL_safeTransfer() {
    bool shouldRevert;
    if (shouldRevert || forceTransferRevert) {
        revert();
    }
}

/// ORACLE REVERT PROPAGATION ///

/// If an activated collateral oracle reverts on price different than withdrawn collateral, withdrawCollateral reverts when the borrower has debt.
rule oracleRevertCausesWithdrawCollateralRevert(env e, Awakening.Market market, uint256 collateralIndex, uint256 assets, address onBehalf, address receiver, uint256 revertingCollateralIndex) {
    require singleRevertingOracle == market.collateralParams[revertingCollateralIndex].oracle, "oracle is reverting";
    require revertingCollateralIndex < 128, "clearBit produces a new bitmap whose summaryGetBit is unconstrained for indices >= 128";
    require revertingCollateralIndex != collateralIndex, "withdrawCollateral may clear the bit at collateralIndex before calling isHealthy";

    bytes32 id = summaryToId(market);
    uint128 bitmap = collateralBitmap(id, onBehalf);
    require summaryGetBit(bitmap, revertingCollateralIndex), "revertingCollateralIndex is activated";

    withdrawCollateral@withrevert(e, market, collateralIndex, assets, onBehalf, receiver);
    bool reverted = lastReverted;

    assert debtOf(id, onBehalf) > 0 => reverted;
}

/// ORACLE RETURNS ZERO ///

/// If all oracles return 0, withdrawCollateral reverts when the borrower has debt.
rule oracleZeroPreventsWithdrawCollateralWhenBorrowerHasDebt(env e, Awakening.Market market, uint256 collateralIndex, uint256 assets, address onBehalf, address receiver) {
    require forceOracleReturnZero, "all oracles return zero";

    bytes32 id = summaryToId(market);
    require collateralBitmap(id, onBehalf) != 0, "borrower has activated collaterals";

    withdrawCollateral(e, market, collateralIndex, assets, onBehalf, receiver);

    assert debtOf(id, onBehalf) == 0;
}

/// GATE BLOCKING ///

/// If enterGate.canIncreaseCredit returns false and take succeeds, no user's credit increases.
rule enterGateBlocksCreditIncrease(env e, Awakening.Offer offer, bytes ratifierData, uint256 units, address taker, address receiver, address takerCallback, bytes takerCallbackData, address user) {
    require !ghostCanIncreaseCredit(offer.market.enterGate), "canIncreaseCredit blocked";
    require offer.market.enterGate != 0, "enter gate is set";

    bytes32 id = summaryToId(offer.market);
    uint256 creditBefore = creditOf(id, user);

    take(e, offer, ratifierData, units, taker, receiver, takerCallback, takerCallbackData);

    uint256 creditAfter = creditOf(id, user);

    assert creditAfter <= creditBefore;
}

/// If enterGate.canIncreaseDebt returns false and take succeeds, no user's debt increases.
rule enterGateBlocksDebtIncrease(env e, Awakening.Offer offer, bytes ratifierData, uint256 units, address taker, address receiver, address takerCallback, bytes takerCallbackData, address user) {
    require !ghostCanIncreaseDebt(offer.market.enterGate), "canIncreaseDebt blocked";
    require offer.market.enterGate != 0, "enter gate is set";

    bytes32 id = summaryToId(offer.market);
    uint256 debtBefore = debtOf(id, user);

    take(e, offer, ratifierData, units, taker, receiver, takerCallback, takerCallbackData);

    uint256 debtAfter = debtOf(id, user);

    assert debtAfter <= debtBefore;
}

/// TOKEN TRANSFER REVERT PROPAGATION ///

/// If transferFrom reverts, take, repay, and supplyCollateral all revert.
rule transferFromRevertPropagation(method f, env e, calldataarg args)
filtered {
    f -> f.selector == sig:take(Awakening.Offer, bytes, uint256, address, address, address, bytes).selector
        || f.selector == sig:repay(Awakening.Market, uint256, address, address, bytes).selector
        || f.selector == sig:supplyCollateral(Awakening.Market, uint256, uint256, address).selector
} {
    require forceTransferFromRevert, "transferFrom reverts";
    f@withrevert(e, args);
    assert lastReverted;
}

/// If transferFrom reverts, flashLoan reverts, assuming that the arrays are not empty.
rule transferFromRevertPropagationFlashLoan(env e, address[] tokens, uint256[] assets, address callback, bytes data) {
    require forceTransferFromRevert, "transferFrom reverts";
    require tokens.length > 0, "assume tokens array is not empty";
    flashLoan@withrevert(e, tokens, assets, callback, data);
    assert lastReverted;
}

/// If transfer reverts, withdraw, withdrawCollateral, and fee claims all revert.
rule transferRevertPropagation(method f, env e, calldataarg args)
filtered {
    f -> f.selector == sig:withdraw(Awakening.Market, uint256, address, address).selector
        || f.selector == sig:withdrawCollateral(Awakening.Market, uint256, uint256, address, address).selector
        || f.selector == sig:claimSettlementFee(address, uint256, address).selector
        || f.selector == sig:claimContinuousFee(Awakening.Market, uint256, address).selector
} {
    require forceTransferRevert, "transfer reverts";
    f@withrevert(e, args);
    assert lastReverted;
}

/// If transfer reverts, flashLoan reverts, assuming that the arrays are not empty.
rule transferRevertPropagationFlashLoan(env e, address[] tokens, uint256[] assets, address callback, bytes data) {
    require forceTransferRevert, "transfer reverts";
    require tokens.length > 0, "assume tokens array is not empty";
    flashLoan@withrevert(e, tokens, assets, callback, data);
    assert lastReverted;
}

/// CALLBACK REVERT PROPAGATION ///

/// If the callback reverts or returns something other than CALLBACK_SUCCESS, callback-enabled repay (non-zero callback) reverts.
rule callbackRevertOrBadReturnCausesRepayRevert(env e, Awakening.Market market, uint256 units, address onBehalf, address callback, bytes data) {
    require forceCallbackRevert || forceCallbackBadReturn, "callback reverts or returns bad value";
    require callback != 0, "callback-enabled repay";

    repay@withrevert(e, market, units, onBehalf, callback, data);

    assert lastReverted;
}

/// If the callback reverts or returns something other than CALLBACK_SUCCESS, flashLoan reverts, assuming that the arrays are not empty.
rule callbackRevertOrBadReturnCausesFlashLoanRevert(env e, address[] tokens, uint256[] assets, address callback, bytes data) {
    require forceCallbackRevert || forceCallbackBadReturn, "callback reverts or returns bad value";
    require tokens.length > 0, "assume tokens array is not empty";

    flashLoan@withrevert(e, tokens, assets, callback, data);

    assert lastReverted;
}

/// If a buy/sell/isRatified callback reverts or returns something other than CALLBACK_SUCCESS, take reverts.
rule callbackRevertOrBadReturnCausesTakeRevert(env e, Awakening.Offer offer, bytes ratifierData, uint256 units, address taker, address receiver, address takerCallback, bytes takerCallbackData) {
    require forceCallbackRevert || forceCallbackBadReturn, "callback reverts or returns bad value";
    require takerCallback != 0 || offer.callback != 0 || offer.ratifier != 0, "callback-enabled take";

    take@withrevert(e, offer, ratifierData, units, taker, receiver, takerCallback, takerCallbackData);

    assert lastReverted;
}
