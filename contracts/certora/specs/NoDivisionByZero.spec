// SPDX-License-Identifier: GPL-2.0-or-later

// Proves that no division by zero occurs in mulDivDown or mulDivUp.
//
// All other Solidity divisions in the codebase use non-zero denominators:
// - settlementFee: divides by (end - start), always a positive constant from the breakpoint table.
// - setMarketSettlementFee / setDefaultSettlementFee: divide by CBP (1e12).
// - tickToPrice: divides by 5e12 or a value greater than 1e18.
// - wExp, used in tickToPrice: divides by non-zero constants.
// Therefore, we only look for division by zero in mulDivDown and mulDivUp in this file.

import "BitmapSummaries.spec";

methods {
    function multicall(bytes[]) external => HAVOC_ALL DELETE;

    // Ghost price function so that the price can be referenced in the rules.
    function _.price() external => ghostPrice(calledContract) expect(uint256);

    // Summary for deterministic toId for the global market.
    function IdLib.toId(Awakening.Market memory market, uint256 chainId, address midnight) internal returns (bytes32) => summaryToId(market, chainId, midnight);

    // This function is checked manually to not cause a division by zero.
    function TickLib.tickToPrice(uint256) internal returns (uint256) => NONDET;

    // Hook on mulDivDown and mulDivUp to check that the denominator is not zero, and add the necessary lemmas.
    function UtilsLib.mulDivDown(uint256 x, uint256 y, uint256 d) internal returns (uint256) => mulDivDownSummary(x, y, d);
    function UtilsLib.mulDivUp(uint256 x, uint256 y, uint256 d) internal returns (uint256) => mulDivUpSummary(x, y, d);
}

/// GHOSTS ///

// Reuse part of the setup of Healthiness.spec.

persistent ghost address globalMarketLoanToken;

persistent ghost uint256 globalMarketCollateralLength;

persistent ghost mapping(uint256 => address) globalMarketCollateralOracle;

persistent ghost mapping(uint256 => address) globalMarketCollateralToken;

persistent ghost uint256 globalMarketMaturity;

persistent ghost address globalMarketEnterGate;

persistent ghost bytes32 globalId;

/// SUMMARIES ///

ghost ghostPrice(address) returns uint256;

definition WAD() returns uint256 = 10 ^ 18;

definition collateralMatches(Awakening.Market market, uint256 index) returns bool = (index < globalMarketCollateralLength => market.collateralParams[index].oracle == globalMarketCollateralOracle[index] && market.collateralParams[index].token == globalMarketCollateralToken[index]);

function equalsGlobalMarket(Awakening.Market market) returns (bool) {
    return market.loanToken == globalMarketLoanToken && market.collateralParams.length == globalMarketCollateralLength && collateralMatches(market, 0) && collateralMatches(market, 1) && collateralMatches(market, 2) && market.maturity == globalMarketMaturity && market.enterGate == globalMarketEnterGate;
}

function summaryToId(Awakening.Market market, uint256 chainId, address midnight) returns (bytes32) {
    bytes32 id;
    if (equalsGlobalMarket(market) && midnight == currentContract) {
        require id == globalId, "toId() is deterministic";
    } else {
        require id != globalId, "toId() is injective";
    }
    return id;
}

function mulDivDownSummary(uint256 x, uint256 y, uint256 d) returns uint256 {
    assert d > 0;

    uint256 result;
    require y <= d => result <= x, "see mulDivArgumentLesserThanDenominator in MulDiv.spec";
    require x <= d => result <= y, "see mulDivArgumentLesserThanDenominator in MulDiv.spec";
    return result;
}

function mulDivUpSummary(uint256 x, uint256 y, uint256 d) returns uint256 {
    assert d > 0;

    uint256 result;
    require result * d <= x * y + d - 1, "see mulDivUpUpperBound in MulDiv.spec";
    require y <= d => result <= x, "see mulDivArgumentLesserThanDenominator in MulDiv.spec";
    require x <= d => result <= y, "see mulDivArgumentLesserThanDenominator in MulDiv.spec";
    return result;
}

/// RULES ///

rule noDivisionByZero(method f, env e, calldataarg args) {
    f(e, args);
    assert true;
}
