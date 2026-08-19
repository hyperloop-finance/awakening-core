// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (c) 2025 Morpho Association
pragma solidity ^0.8.0;

import {BaseTest} from "./BaseTest.sol";
import {IAwakening, Market, Offer, CollateralParams, PendingTake, Loan} from "../src/interfaces/IAwakening.sol";
import {IEnterGate} from "../src/interfaces/IGate.sol";
import {OptionVault} from "../src/vault/OptionVault.sol";
import {AttestedPAT} from "../src/pat/AttestedPAT.sol";
import {IPAT, OptionTerms} from "../src/interfaces/IPAT.sol";
import {EventsLib} from "../src/libraries/EventsLib.sol";
import {TickLib, MAX_TICK} from "../src/libraries/TickLib.sol";
import {UtilsLib} from "../src/libraries/UtilsLib.sol";
import {WAD, ORACLE_PRICE_SCALE, TWO_STEP_TAKE_WINDOW} from "../src/libraries/ConstantsLib.sol";

contract TwoStepTakeTest is BaseTest {
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
        awakening.setOptionKeeper(keeper);
        awakening.setOptionVault(address(vault));

        (address custodian, uint256 pk) = makeAddrAndKey("custodian");
        custodianPk = pk;
        pat = new AttestedPAT(custodian);
        awakening.setPat(address(pat));

        // Borrower approves Awakening for BTC.
        vm.prank(borrower);
        collateralToken1.approve(address(awakening), type(uint256).max);

        market.loanToken = address(loanToken);
        market.maturity = vm.getBlockTimestamp() + 100 days;
        market.maxStrike = type(uint256).max;
        market.penaltyPct = 5e16;
        market.collateralParams.push(CollateralParams({token: address(collateralToken1), oracle: address(oracle1)}));
        market.collateralParams = sortCollateralParams(market.collateralParams);
        id = toId(market);

        // Case B: borrower lists a sell offer, the lender takes.
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

    /// @dev buyerAssets == sellerAssets at MAX_TICK with no settlement fee set.
    function _buyerAssets(uint256 units) internal pure returns (uint256) {
        return UtilsLib.mulDivUp(units, TickLib.tickToPrice(MAX_TICK), WAD);
    }

    /// @dev A fixed, non-zero trade id used by all single-borrow tests (anti-replay is tested separately).
    function _tradeId() internal pure returns (bytes32) {
        return bytes32(uint256(1));
    }

    function _initiate(uint256 units, uint256 collateral) internal returns (bytes32 pendingId) {
        deal(address(loanToken), lender, _buyerAssets(units));
        deal(address(collateralToken1), borrower, collateral);

        vm.prank(lender);
        pendingId = awakening.takeInit(offer, hex"", units, collateral, lender);
    }

    /// @dev Custodian attestation over the terms that completeTake derives from the pending take.
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

    // --- complete path ---

    function testCompleteTake(uint256 units, uint256 collateral, uint256 premium) public {
        units = bound(units, 1, 1e24);
        collateral = bound(collateral, 1, 1e24);
        uint256 buyerAssets = _buyerAssets(units);
        premium = bound(premium, 0, buyerAssets);

        bytes32 pendingId = _initiate(units, collateral);
        uint256 borrowerUsdcBefore = loanToken.balanceOf(borrower);

        bytes memory attestation = _attestation(units, collateral, _tradeId());
        vm.prank(keeper);
        awakening.completeTake(pendingId, premium, _tradeId(), attestation);

        assertEq(awakening.debtOf(id, borrower), units, "debt");
        assertEq(awakening.creditOf(id, lender), units, "credit");
        assertEq(awakening.collateral(id, borrower, 0), collateral, "collateral position");

        Loan memory loan = awakening.loans(pendingId);
        assertEq(loan.principal, units, "principal");
        assertEq(loan.collateral, collateral, "loan collateral");
        assertEq(loan.strike, UtilsLib.mulDivUp(units, ORACLE_PRICE_SCALE, collateral), "strike");
        assertEq(loan.premium, premium, "premium");
        assertEq(loan.expiry, market.maturity, "expiry");
        assertEq(loan.pat, address(pat), "pat");
        assertEq(loan.patTokenId, 1, "patTokenId");

        OptionTerms memory terms = pat.terms(loan.patTokenId);
        assertEq(terms.underlying, address(collateralToken1), "terms underlying");
        assertEq(terms.quoteToken, address(loanToken), "terms quote");
        assertEq(terms.strike, loan.strike, "terms strike");
        assertEq(terms.notional, collateral, "terms notional");
        assertEq(terms.expiry, market.maturity, "terms expiry");
        assertEq(terms.isPut, true, "terms isPut");

        assertEq(loanToken.balanceOf(borrower) - borrowerUsdcBefore, buyerAssets - premium, "borrower net");
        assertEq(loanToken.balanceOf(keeper), premium, "keeper premium");
        assertEq(vault.escrowed(address(loanToken)), 0, "vault drained");

        PendingTake memory pt = awakening.pendingTakes(pendingId);
        assertEq(pt.lender, address(0), "pending cleared");
    }

    function testCompleteTakeInvalidAttestation(uint256 units, uint256 collateral) public {
        units = bound(units, 1, 1e24);
        collateral = bound(collateral, 1, 1e24);
        bytes32 pendingId = _initiate(units, collateral);

        vm.prank(keeper);
        vm.expectRevert(IPAT.InvalidAttestation.selector);
        awakening.completeTake(pendingId, 0, _tradeId(), abi.encode(uint8(0), bytes32(0), bytes32(0)));
    }

    function testTakeInitReservesConsumed(uint256 units, uint256 collateral) public {
        units = bound(units, 1, 1e24);
        collateral = bound(collateral, 1, 1e24);
        _initiate(units, collateral);

        assertEq(awakening.consumed(borrower, offer.group), units, "consumed reserved");
    }

    // --- cancel path ---

    function testCancelTake(uint256 units, uint256 collateral) public {
        units = bound(units, 1, 1e24);
        collateral = bound(collateral, 1, 1e24);
        uint256 buyerAssets = _buyerAssets(units);

        bytes32 pendingId = _initiate(units, collateral);
        uint256 lenderUsdcBefore = loanToken.balanceOf(lender);

        vm.prank(keeper);
        awakening.cancelTake(pendingId);

        assertEq(loanToken.balanceOf(lender) - lenderUsdcBefore, buyerAssets, "lender refunded");
        assertEq(collateralToken1.balanceOf(borrower), collateral, "collateral returned");
        assertEq(vault.escrowed(address(loanToken)), 0, "vault drained");
        assertEq(awakening.debtOf(id, borrower), 0, "no debt");
        assertEq(awakening.creditOf(id, lender), 0, "no credit");
        assertEq(awakening.consumed(borrower, offer.group), 0, "consumed restored");

        PendingTake memory pt = awakening.pendingTakes(pendingId);
        assertEq(pt.lender, address(0), "pending cleared");
    }

    function testCancelAfterDeadlineAnyone(uint256 units, uint256 collateral) public {
        units = bound(units, 1, 1e24);
        collateral = bound(collateral, 1, 1e24);

        bytes32 pendingId = _initiate(units, collateral);

        vm.warp(block.timestamp + TWO_STEP_TAKE_WINDOW + 1);

        vm.prank(makeAddr("anyone"));
        awakening.cancelTake(pendingId);

        assertEq(collateralToken1.balanceOf(borrower), collateral, "collateral returned");
    }

    // --- access control ---

    function testCompleteOnlyOptionKeeper(uint256 units, uint256 collateral) public {
        units = bound(units, 1, 1e24);
        collateral = bound(collateral, 1, 1e24);
        bytes32 pendingId = _initiate(units, collateral);

        vm.prank(makeAddr("notKeeper"));
        vm.expectRevert(IAwakening.NotOptionKeeper.selector);
        awakening.completeTake(pendingId, 0, _tradeId(), hex"");
    }

    function testCancelOnlyOptionKeeperBeforeDeadline(uint256 units, uint256 collateral) public {
        units = bound(units, 1, 1e24);
        collateral = bound(collateral, 1, 1e24);
        bytes32 pendingId = _initiate(units, collateral);

        vm.prank(makeAddr("notKeeper"));
        vm.expectRevert(IAwakening.NotOptionKeeper.selector);
        awakening.cancelTake(pendingId);
    }

    function testCompleteExpired(uint256 units, uint256 collateral) public {
        units = bound(units, 1, 1e24);
        collateral = bound(collateral, 1, 1e24);
        bytes32 pendingId = _initiate(units, collateral);

        vm.warp(block.timestamp + TWO_STEP_TAKE_WINDOW + 1);

        vm.prank(keeper);
        vm.expectRevert(IAwakening.PendingTakeExpired.selector);
        awakening.completeTake(pendingId, 0, _tradeId(), hex"");
    }

    function testPendingTakeNotFound() public {
        vm.prank(keeper);
        vm.expectRevert(IAwakening.PendingTakeNotFound.selector);
        awakening.completeTake(bytes32(0), 0, _tradeId(), hex"");

        vm.expectRevert(IAwakening.PendingTakeNotFound.selector);
        awakening.cancelTake(bytes32(0));
    }

    // --- validation ---

    function testZeroCollateralReverts(uint256 units) public {
        units = bound(units, 1, 1e24);
        deal(address(loanToken), lender, _buyerAssets(units));

        vm.prank(lender);
        vm.expectRevert(IAwakening.ZeroCollateral.selector);
        awakening.takeInit(offer, hex"", units, 0, lender);
    }

    function testPremiumTooHigh(uint256 units, uint256 collateral) public {
        units = bound(units, 1, 1e24);
        collateral = bound(collateral, 1, 1e24);
        uint256 buyerAssets = _buyerAssets(units);
        bytes32 pendingId = _initiate(units, collateral);

        vm.prank(keeper);
        vm.expectRevert(IAwakening.PremiumTooHigh.selector);
        awakening.completeTake(pendingId, buyerAssets + 1, _tradeId(), hex"");
    }

    function testStrikeExceedsMaxStrike() public {
        offer.market.maxStrike = 1; // unrealistically low cap

        deal(address(loanToken), lender, _buyerAssets(1e18));
        deal(address(collateralToken1), borrower, 1e18);

        vm.prank(lender);
        vm.expectRevert(IAwakening.StrikeExceedsMax.selector);
        awakening.takeInit(offer, hex"", 1e18, 1e18, lender);
    }

    // --- Case A: lender lists a buy offer, the borrower takes ---

    function testCaseABuyOfferBorrowerTakes() public {
        Offer memory buyOffer;
        buyOffer.market = market;
        buyOffer.buy = true;
        buyOffer.maker = lender;
        buyOffer.maxUnits = type(uint256).max;
        buyOffer.ratifier = address(dummyRatifier);
        buyOffer.start = vm.getBlockTimestamp();
        buyOffer.expiry = vm.getBlockTimestamp() + 200;
        buyOffer.tick = MAX_TICK;

        uint256 units = 1e18;
        uint256 collateral = 1e18;
        deal(address(loanToken), lender, _buyerAssets(units));
        deal(address(collateralToken1), borrower, collateral);

        vm.prank(borrower);
        bytes32 pendingId = awakening.takeInit(buyOffer, hex"", units, collateral, borrower);

        bytes memory attestation = _attestation(units, collateral, _tradeId());
        vm.prank(keeper);
        awakening.completeTake(pendingId, 0, _tradeId(), attestation);

        assertEq(awakening.debtOf(id, borrower), units, "debt");
        assertEq(awakening.creditOf(id, lender), units, "credit");
        assertEq(awakening.collateral(id, borrower, 0), collateral, "collateral position");
    }

    // --- security: collateral withdrawal, post-maturity, gate ---

    function testWithdrawCollateralBlockedWhileDebt(uint256 units, uint256 collateral) public {
        units = bound(units, 1, 1e24);
        collateral = bound(collateral, 1, 1e24);
        bytes32 pendingId = _initiate(units, collateral);

        bytes memory attestation = _attestation(units, collateral, _tradeId());
        vm.prank(keeper);
        awakening.completeTake(pendingId, 0, _tradeId(), attestation);

        vm.prank(borrower);
        vm.expectRevert(IAwakening.HasOutstandingDebt.selector);
        awakening.withdrawCollateral(market, 0, collateral, borrower, borrower);
    }

    function testTakeInitPostMaturityReverts() public {
        uint256 units = 1e18;
        uint256 collateral = 1e18;

        market.maturity = vm.getBlockTimestamp() + 100;
        offer.market = market;
        offer.start = vm.getBlockTimestamp();
        offer.expiry = vm.getBlockTimestamp() + 500;

        vm.warp(vm.getBlockTimestamp() + 200); // past maturity, still before offer expiry

        deal(address(loanToken), lender, _buyerAssets(units));
        deal(address(collateralToken1), borrower, collateral);

        vm.prank(lender);
        vm.expectRevert(IAwakening.CannotIncreaseDebtPostMaturity.selector);
        awakening.takeInit(offer, hex"", units, collateral, lender);
    }

    function testTakeInitGateBlocksDebt(uint256 units, uint256 collateral) public {
        units = bound(units, 1, 1e24);
        collateral = bound(collateral, 1, 1e24);

        BlockDebtGate gate = new BlockDebtGate();
        market.enterGate = address(gate);
        offer.market = market;

        deal(address(loanToken), lender, _buyerAssets(units));
        deal(address(collateralToken1), borrower, collateral);

        vm.prank(lender);
        vm.expectRevert(IAwakening.SellerGatedFromIncreasingDebt.selector);
        awakening.takeInit(offer, hex"", units, collateral, lender);
    }

    function testCompleteTakeTradeIdReplayReverts(uint256 units, uint256 collateral) public {
        units = bound(units, 1, 1e24);
        collateral = bound(collateral, 1, 1e24);

        bytes32 tradeId = _tradeId();

        // First borrow mints a PAT for this trade id.
        bytes32 pendingId1 = _initiate(units, collateral);
        bytes memory attestation = _attestation(units, collateral, tradeId);
        vm.prank(keeper);
        awakening.completeTake(pendingId1, 0, tradeId, attestation);

        // Reusing the same trade id for a second, identical loan must revert.
        bytes32 pendingId2 = _initiate(units, collateral);
        bytes memory attestation2 = _attestation(units, collateral, tradeId);
        vm.prank(keeper);
        vm.expectRevert(IPAT.TradeIdAlreadyUsed.selector);
        awakening.completeTake(pendingId2, 0, tradeId, attestation2);
    }
}

contract BlockDebtGate is IEnterGate {
    function canIncreaseCredit(address) external pure returns (bool) {
        return true;
    }

    function canIncreaseDebt(address) external pure returns (bool) {
        return false;
    }
}
