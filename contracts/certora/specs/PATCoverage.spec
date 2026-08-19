// SPDX-License-Identifier: GPL-2.0-or-later

/// @dev Invariants of the non-liquidation guarantee.
/// @dev NOTE: this spec is a first draft and has not been run against `certoraRun` yet; storage access paths and
/// mathint casts may need adjustment. The properties are:
///   1. every loan's put (notional = collateral, strike) covers its principal, i.e. strike * collateral >= principal * SCALE.
///   2. the strike never exceeds the market's maxStrike cap.
///   3. `readOracleAtMaturity` can never read the oracle before maturity.

/// The put + collateral always cover the principal: strike × collateral ≥ principal × ORACLE_PRICE_SCALE.
rule putCoversPrincipal(bytes32 loanId) {
    address borrower = currentContract._loans[loanId].borrower;
    require borrower != 0;

    mathint strike = to_mathint(currentContract._loans[loanId].strike);
    mathint collateral = to_mathint(currentContract._loans[loanId].collateral);
    mathint principal = to_mathint(currentContract._loans[loanId].principal);

    assert strike * collateral >= principal * 10 ^ 36;
}

/// The strike never exceeds the market's maxStrike cap (LTV cap).
rule strikeWithinMaxStrike(bytes32 loanId) {
    address borrower = currentContract._loans[loanId].borrower;
    require borrower != 0;

    bytes32 id = currentContract._loans[loanId].id;
    // best-effort: maxStrike lives in the market struct stored via SSTORE2, decoded by toMarket(id).maxStrike.
    mathint strike = to_mathint(currentContract._loans[loanId].strike);
    mathint maxStrike = to_mathint(currentContract.toMarket(id).maxStrike);

    assert strike <= maxStrike;
}

/// The oracle is never read before maturity: `readOracleAtMaturity` reverts unless the market has matured.
rule noOracleReadBeforeMaturity(env e, bytes32 id) {
    address settlementContract = currentContract.settlement();
    require settlementContract != 0;

    // `toMarket` reverts for an untouched market; only consider created markets.
    bool created = currentContract.tickSpacing(id) > 0;
    require created;

    uint256 maturity = currentContract.toMarket(id).maturity;

    readOracleAtMaturity@withrevert(e, id);
    assert lastReverted || e.block.timestamp >= maturity;
}
