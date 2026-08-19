// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (c) 2025 Morpho Association
pragma solidity ^0.8.0;

import {BaseTest} from "./BaseTest.sol";
import {IAwakening, Market, Offer, CollateralParams, Loan} from "../src/interfaces/IAwakening.sol";
import {OptionVault} from "../src/vault/OptionVault.sol";
import {AttestedPAT} from "../src/pat/AttestedPAT.sol";
import {OptionTerms} from "../src/interfaces/IPAT.sol";
import {TickLib, MAX_TICK} from "../src/libraries/TickLib.sol";
import {UtilsLib} from "../src/libraries/UtilsLib.sol";
import {WAD, ORACLE_PRICE_SCALE} from "../src/libraries/ConstantsLib.sol";

/// @dev Invariants of the non-liquidation guarantee: a loan's put (notional = collateral, strike) must always cover
/// its principal, and the strike must respect the market's maxStrike cap.
contract PutCoverageInvariantTest is BaseTest {
    OptionVault internal vault;
    AttestedPAT internal pat;
    address internal keeper = makeAddr("optionKeeper");
    uint256 internal custodianPk;

    Market internal market;
    Offer internal offer;
    bytes32 internal id;

    function setUp() public override {
        super.setUp();

        vault = new OptionVault(address(awakening));
        (address custodian, uint256 pk) = makeAddrAndKey("custodian");
        custodianPk = pk;
        pat = new AttestedPAT(custodian);

        awakening.setOptionKeeper(keeper);
        awakening.setOptionVault(address(vault));
        awakening.setPat(address(pat));

        vm.prank(borrower);
        collateralToken1.approve(address(awakening), type(uint256).max);

        market.loanToken = address(loanToken);
        market.maturity = vm.getBlockTimestamp() + 30 days;
        market.maxStrike = type(uint256).max;
        market.penaltyPct = 5e16;
        market.collateralParams.push(CollateralParams({token: address(collateralToken1), oracle: address(oracle1)}));
        market.collateralParams = sortCollateralParams(market.collateralParams);
        id = toId(market);

        offer.market = market;
        offer.buy = false;
        offer.maker = borrower;
        offer.receiverIfMakerIsSeller = borrower;
        offer.maxUnits = type(uint256).max;
        offer.ratifier = address(dummyRatifier);
        offer.start = vm.getBlockTimestamp();
        offer.expiry = vm.getBlockTimestamp() + 200;
        offer.tick = MAX_TICK;
    }

    function _attestation(uint256 units, uint256 collateral, bytes32 tradeId) internal view returns (bytes memory) {
        OptionTerms memory terms = OptionTerms({
            underlying: address(collateralToken1),
            quoteToken: address(loanToken),
            strike: UtilsLib.mulDivUp(units, ORACLE_PRICE_SCALE, collateral),
            notional: collateral,
            expiry: market.maturity,
            isPut: true,
            tradeId: tradeId
        });
        bytes32 structHash = keccak256(
            abi.encode(
                pat.OPTION_TERMS_TYPEHASH(),
                terms.underlying,
                terms.quoteToken,
                terms.strike,
                terms.notional,
                terms.expiry,
                terms.isPut,
                terms.tradeId
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", pat.CUSTODIAN_DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(custodianPk, digest);
        return abi.encode(v, r, s);
    }

    function _borrow(uint256 units, uint256 collateral) internal returns (Loan memory loan) {
        deal(address(loanToken), lender, UtilsLib.mulDivUp(units, TickLib.tickToPrice(MAX_TICK), WAD));
        deal(address(collateralToken1), borrower, collateral);

        vm.prank(lender);
        bytes32 loanId = awakening.takeInit(offer, hex"", units, collateral, lender);

        bytes32 tradeId = bytes32(uint256(1));
        bytes memory attestation = _attestation(units, collateral, tradeId);
        vm.prank(keeper);
        awakening.completeTake(loanId, 0, tradeId, attestation);

        loan = awakening.loans(loanId);
    }

    /// @dev The put + collateral always cover the principal: strike × collateral ≥ principal × SCALE.
    function testPutCoversPrincipal(uint256 units, uint256 collateral) public {
        units = bound(units, 1, 1e24);
        collateral = bound(collateral, 1, 1e24);

        Loan memory loan = _borrow(units, collateral);

        assertEq(loan.principal, units, "principal");
        assertEq(loan.collateral, collateral, "collateral");
        assertEq(loan.strike, UtilsLib.mulDivUp(units, ORACLE_PRICE_SCALE, collateral), "strike");
        assertGe(loan.strike * loan.collateral, loan.principal * ORACLE_PRICE_SCALE, "put covers principal");
        assertEq(loan.expiry, market.maturity, "expiry");
    }

    /// @dev The strike never exceeds the market's maxStrike cap.
    function testStrikeWithinMaxStrike(uint256 units, uint256 collateral, uint256 maxStrike) public {
        units = bound(units, 1, 1e24);
        collateral = bound(collateral, 1, 1e24);
        market.maxStrike = type(uint256).max;
        offer.market = market;

        uint256 strike = UtilsLib.mulDivUp(units, ORACLE_PRICE_SCALE, collateral);
        maxStrike = bound(maxStrike, strike, type(uint256).max);
        market.maxStrike = maxStrike;
        offer.market = market;

        Loan memory loan = _borrow(units, collateral);

        assertLe(loan.strike, maxStrike, "strike within maxStrike");
    }

    /// @dev The debt recorded on the borrower's position equals the loan principal.
    function testDebtEqualsPrincipal(uint256 units, uint256 collateral) public {
        units = bound(units, 1, 1e24);
        collateral = bound(collateral, 1, 1e24);

        Loan memory loan = _borrow(units, collateral);

        assertEq(awakening.debtOf(id, borrower), loan.principal, "debt equals principal");
        assertEq(awakening.creditOf(id, lender), loan.principal, "credit equals principal");
        assertEq(awakening.collateral(id, borrower, 0), collateral, "collateral recorded");
    }
}
