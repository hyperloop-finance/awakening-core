// SPDX-License-Identifier: GPL-2.0-or-later

using Utils as Utils;

methods {
    function multicall(bytes[]) external => HAVOC_ALL DELETE;

    function debtOf(bytes32 id, address user) external returns (uint128) envfree;
    function Utils.hashMarket(Awakening.Market) external returns (bytes32) envfree;

    // Deterministic toId summary.
    function IdLib.toId(Awakening.Market memory market, uint256, address) internal returns (bytes32) => summaryToId(market);

    // Callbacks and token transfers reached by take/repay/flashLoan use the default AUTO summary
    // (HAVOC_ECF), which assumes the callees do not re-enter Awakening and so leave the debt unchanged.
    // This is sound for the full re-entrant transaction by induction on the call depth: the inner-most
    // re-entrant call is itself a verified function (so it does not increase the debt), and by the
    // induction hypothesis neither does the surrounding call. The rule covers every non-view method,
    // so every re-entrant entry point is in scope.
}

/// HELPERS ///

function summaryToId(Awakening.Market market) returns bytes32 {
    return Utils.hashMarket(market);
}

/// RULE ///

// Post maturity, the debt cannot increase
rule debtCannotIncreasePostMaturity(env e, method f, calldataarg args, Awakening.Market market, address user) filtered { f -> !f.isView } {
    bytes32 id = summaryToId(market);

    mathint debtBefore = debtOf(id, user);

    f(e, args);

    assert e.block.timestamp > market.maturity => debtOf(id, user) <= debtBefore;
}
