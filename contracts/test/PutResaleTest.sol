// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (c) 2025 Morpho Association
pragma solidity ^0.8.0;

import {BaseTest} from "./BaseTest.sol";
import {IAwakening, Market, Offer, CollateralParams, Loan, SettlementState} from "../src/interfaces/IAwakening.sol";
import {IAwakeningSettlement} from "../src/interfaces/IAwakeningSettlement.sol";
import {OptionVault} from "../src/vault/OptionVault.sol";
import {AttestedPAT} from "../src/pat/AttestedPAT.sol";
import {AwakeningSettlement} from "../src/settlement/AwakeningSettlement.sol";
import {OptionTerms} from "../src/interfaces/IPAT.sol";
import {TickLib, MAX_TICK} from "../src/libraries/TickLib.sol";
import {UtilsLib} from "../src/libraries/UtilsLib.sol";
import {WAD, ORACLE_PRICE_SCALE} from "../src/libraries/ConstantsLib.sol";

/// @dev D8: early full repayment keeps the put; at maturity the keeper resells it and the borrower claims the proceeds.
contract PutResaleTest is BaseTest {
    OptionVault internal vault;
    AttestedPAT internal pat;
    AwakeningSettlement internal settlement;
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
        settlement = new AwakeningSettlement(address(awakening));

        awakening.setOptionKeeper(keeper);
        awakening.setOptionVault(address(vault));
        awakening.setPat(address(pat));
        awakening.setSettlement(address(settlement));

        vm.prank(borrower);
        collateralToken1.approve(address(awakening), type(uint256).max);
        vm.prank(borrower);
        loanToken.approve(address(awakening), type(uint256).max);
        vm.prank(borrower);
        loanToken.approve(address(settlement), type(uint256).max);

        market.loanToken = address(loanToken);
        market.maturity = vm.getBlockTimestamp() + 30 days;
        market.maxStrike = type(uint256).max;
        market.penaltyPct = 5e16;
        market.collateralParams.push(CollateralParams({token: address(collateralToken1), oracle: address(oracle1)}));
        market.collateralParams = sortCollateralParams(market.collateralParams);
        id = toId(market);
        awakening.touchMarket(market);

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

    function _buyerAssets(uint256 units) internal pure returns (uint256) {
        return UtilsLib.mulDivUp(units, TickLib.tickToPrice(MAX_TICK), WAD);
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

    function _borrow(uint256 units, uint256 collateral) internal returns (bytes32 loanId) {
        deal(address(loanToken), lender, _buyerAssets(units));
        deal(address(collateralToken1), borrower, collateral);

        vm.prank(lender);
        loanId = awakening.takeInit(offer, hex"", units, collateral, lender);

        bytes32 tradeId = bytes32(uint256(1));
        bytes memory attestation = _attestation(units, collateral, tradeId);
        vm.prank(keeper);
        awakening.completeTake(loanId, 0, tradeId, attestation);
    }

    // --- early repayment keeps the loan for put resale ---

    function testEarlyFullRepayKeepsLoan(uint256 units, uint256 collateral) public {
        units = bound(units, 1e18, 1e24);
        collateral = bound(collateral, 1e6, 1e8);
        bytes32 loanId = _borrow(units, collateral);

        deal(address(loanToken), borrower, units);
        vm.prank(borrower);
        settlement.repay(id, units); // before maturity → early

        assertEq(awakening.debtOf(id, borrower), 0, "debt cleared");
        assertEq(collateralToken1.balanceOf(borrower), collateral, "collateral returned");

        Loan memory loan = awakening.loans(loanId);
        assertEq(loan.borrower, borrower, "loan kept");
        assertEq(loan.lastRepaid, units, "lastRepaid == principal");
        assertEq(awakening.borrowerLoan(id, borrower), loanId, "borrowerLoan still points");
    }

    function testReportPutResaleAndClaim(uint256 units, uint256 collateral, uint256 proceeds) public {
        units = bound(units, 1e18, 1e24);
        collateral = bound(collateral, 1e6, 1e8);
        bytes32 loanId = _borrow(units, collateral);

        deal(address(loanToken), borrower, units);
        vm.prank(borrower);
        settlement.repay(id, units); // early full repay

        proceeds = bound(proceeds, 1, 1e24);
        deal(address(loanToken), keeper, proceeds);
        vm.prank(keeper);
        loanToken.approve(address(settlement), type(uint256).max);

        vm.prank(keeper);
        settlement.reportPutResale(id, loanId, proceeds);

        assertEq(awakening.loans(loanId).claimablePutProceeds, proceeds, "claimable recorded");

        uint256 borrowerUsdcBefore = loanToken.balanceOf(borrower);
        vm.prank(borrower);
        awakening.claimPutProceeds(loanId, borrower);

        assertEq(loanToken.balanceOf(borrower) - borrowerUsdcBefore, proceeds, "proceeds claimed");
        assertEq(awakening.loans(loanId).borrower, address(0), "loan deleted after claim");
        assertEq(awakening.borrowerLoan(id, borrower), 0, "borrowerLoan cleared");
    }

    function testPartialEarlyRepayKeepsLoanActive(uint256 units, uint256 collateral) public {
        units = bound(units, 2e18, 1e24);
        collateral = bound(collateral, 1e6, 1e8);
        bytes32 loanId = _borrow(units, collateral);

        uint256 partialUnits = units / 2;
        deal(address(loanToken), borrower, partialUnits);
        vm.prank(borrower);
        settlement.repay(id, partialUnits);

        Loan memory loan = awakening.loans(loanId);
        assertEq(loan.lastRepaid, partialUnits, "lastRepaid");
        assertEq(loan.principal, units, "principal unchanged");
        assertEq(loan.claimablePutProceeds, 0, "no claim yet");
        assertEq(collateralToken1.balanceOf(borrower), 0, "collateral still locked");
    }

    // --- post-maturity repayment deletes the loan ---

    function testPostMaturityRepayDeletesLoan(uint256 units, uint256 collateral) public {
        units = bound(units, 1e18, 1e24);
        collateral = bound(collateral, 1e6, 1e8);
        bytes32 loanId = _borrow(units, collateral);

        vm.warp(market.maturity + 1);
        settlement.readOracleAtMaturity(id);

        deal(address(loanToken), borrower, units);
        vm.prank(borrower);
        settlement.repay(id, units);

        assertEq(awakening.loans(loanId).borrower, address(0), "loan deleted");
        assertEq(awakening.borrowerLoan(id, borrower), 0, "borrowerLoan cleared");
    }

    // --- settle skips early-repaid loans ---

    function testSettleSkipsEarlyRepaidLoan(uint256 units, uint256 collateral) public {
        units = bound(units, 1e18, 1e24);
        collateral = bound(collateral, 1e6, 1e8);
        _borrow(units, collateral);

        deal(address(loanToken), borrower, units);
        vm.prank(borrower);
        settlement.repay(id, units); // early full repay

        vm.warp(market.maturity + 1);
        settlement.readOracleAtMaturity(id);
        vm.prank(keeper);
        settlement.redeemPATs(id);

        // Only the early-repaid loan exists → no defaulted loans to settle.
        deal(address(loanToken), keeper, units);
        vm.prank(keeper);
        loanToken.approve(address(settlement), type(uint256).max);
        vm.prank(keeper);
        vm.expectRevert(IAwakeningSettlement.NoDefaultedLoans.selector);
        settlement.settle(id, units);
    }

    // --- access control / validation ---

    function testReportPutResaleOnlyKeeper(uint256 units, uint256 collateral) public {
        units = bound(units, 1e18, 1e24);
        collateral = bound(collateral, 1e6, 1e8);
        bytes32 loanId = _borrow(units, collateral);
        deal(address(loanToken), borrower, units);
        vm.prank(borrower);
        settlement.repay(id, units);

        vm.prank(makeAddr("notKeeper"));
        vm.expectRevert(IAwakeningSettlement.NotOptionKeeper.selector);
        settlement.reportPutResale(id, loanId, 1e18);
    }

    function testReportPutResaleRequiresFullyRepaid(uint256 units, uint256 collateral) public {
        units = bound(units, 1e18, 1e24);
        collateral = bound(collateral, 1e6, 1e8);
        bytes32 loanId = _borrow(units, collateral); // not repaid

        deal(address(loanToken), keeper, 1e18);
        vm.prank(keeper);
        loanToken.approve(address(settlement), type(uint256).max);

        vm.prank(keeper);
        vm.expectRevert(IAwakening.LoanNotFullyRepaid.selector);
        settlement.reportPutResale(id, loanId, 1e18);
    }

    function testClaimOnlyBorrower(uint256 units, uint256 collateral) public {
        units = bound(units, 1e18, 1e24);
        collateral = bound(collateral, 1e6, 1e8);
        bytes32 loanId = _borrow(units, collateral);

        vm.prank(makeAddr("notBorrower"));
        vm.expectRevert(IAwakening.OnlyBorrower.selector);
        awakening.claimPutProceeds(loanId, makeAddr("receiver"));
    }

    function testClaimNothingToClaim(uint256 units, uint256 collateral) public {
        units = bound(units, 1e18, 1e24);
        collateral = bound(collateral, 1e6, 1e8);
        bytes32 loanId = _borrow(units, collateral);
        deal(address(loanToken), borrower, units);
        vm.prank(borrower);
        settlement.repay(id, units); // early full repay, no resale reported yet

        vm.prank(borrower);
        vm.expectRevert(IAwakening.NothingToClaim.selector);
        awakening.claimPutProceeds(loanId, borrower);
    }
}
