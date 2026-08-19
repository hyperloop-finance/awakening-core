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

contract SettlementTest is BaseTest {
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

        market.loanToken = address(loanToken);
        market.maturity = vm.getBlockTimestamp() + 30 days;
        market.maxStrike = type(uint256).max;
        market.penaltyPct = 5e16; // 5%
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

    function _mature() internal {
        vm.warp(market.maturity + 1);
        settlement.readOracleAtMaturity(id);
    }

    // --- oracle read ---

    function testReadOracleAtMaturity() public {
        assertEq(uint256(settlement.state(id)), uint256(SettlementState.PRE_MATURITY), "initial state");

        vm.warp(market.maturity + 1);
        settlement.readOracleAtMaturity(id);

        assertEq(uint256(settlement.state(id)), uint256(SettlementState.ORACLE_READ), "oracle read");
        assertEq(settlement.terminalPrice(id), oracle1.price(), "terminal price");
    }

    function testReadOracleBeforeMaturityReverts() public {
        vm.expectRevert(IAwakeningSettlement.NotMature.selector);
        settlement.readOracleAtMaturity(id);
    }

    function testReadOracleTwiceReverts() public {
        vm.warp(market.maturity + 1);
        settlement.readOracleAtMaturity(id);

        vm.expectRevert(IAwakeningSettlement.InvalidState.selector);
        settlement.readOracleAtMaturity(id);
    }

    // --- repay path ---

    function testRepay(uint256 units, uint256 collateral) public {
        units = bound(units, 1e18, 1e24);
        collateral = bound(collateral, 1e6, 1e8);
        bytes32 loanId = _borrow(units, collateral);

        _mature();

        uint256 borrowerUsdcBefore = loanToken.balanceOf(borrower);
        vm.prank(borrower);
        settlement.repay(id, units);

        assertEq(awakening.debtOf(id, borrower), 0, "debt cleared");
        assertEq(collateralToken1.balanceOf(borrower), collateral, "collateral returned");
        assertEq(loanToken.balanceOf(borrower), borrowerUsdcBefore - units, "borrower paid");
        assertEq(awakening.loans(loanId).borrower, address(0), "loan deleted");
    }

    function testRepayPartial(uint256 units, uint256 collateral) public {
        units = bound(units, 1e18, 1e24);
        collateral = bound(collateral, 1e6, 1e8);
        bytes32 loanId = _borrow(units, collateral);

        _mature();

        uint256 partialUnits = units / 2;
        vm.prank(borrower);
        settlement.repay(id, partialUnits);

        assertEq(awakening.debtOf(id, borrower), units - partialUnits, "debt reduced");
        assertEq(awakening.loans(loanId).lastRepaid, partialUnits, "lastRepaid");
        assertEq(awakening.loans(loanId).borrower, borrower, "loan still exists");
        assertEq(collateralToken1.balanceOf(borrower), 0, "collateral still locked");
    }

    function testRepayBeforeOracleReadReverts(uint256 units, uint256 collateral) public {
        units = bound(units, 1e18, 1e24);
        collateral = bound(collateral, 1e6, 1e8);
        _borrow(units, collateral);

        vm.prank(borrower);
        vm.expectRevert(IAwakeningSettlement.InvalidState.selector);
        settlement.repay(id, units);
    }

    // --- default settlement path ---

    function testSettleDefault(uint256 units, uint256 collateral) public {
        units = bound(units, 1e18, 1e24);
        collateral = bound(collateral, 1e6, 1e8);
        bytes32 loanId = _borrow(units, collateral);

        _mature();
        vm.prank(keeper);
        settlement.redeemPATs(id);

        uint256 proceeds = units + units / 10;
        uint256 penalty = UtilsLib.mulDivDown(units, market.penaltyPct, WAD);
        uint256 remainder = proceeds - units - penalty;

        deal(address(loanToken), keeper, proceeds);
        vm.prank(keeper);
        loanToken.approve(address(settlement), type(uint256).max);

        uint256 claimableBefore = awakening.claimableSettlementFee(address(loanToken));
        uint256 borrowerUsdcBefore = loanToken.balanceOf(borrower);

        vm.prank(keeper);
        settlement.settle(id, proceeds);

        assertEq(awakening.debtOf(id, borrower), 0, "debt cleared");
        assertEq(collateralToken1.balanceOf(keeper), collateral, "collateral to keeper");
        assertEq(awakening.claimableSettlementFee(address(loanToken)) - claimableBefore, penalty, "penalty");
        assertEq(loanToken.balanceOf(borrower) - borrowerUsdcBefore, remainder, "remainder to borrower");
        assertEq(uint256(settlement.state(id)), uint256(SettlementState.FINAL), "final state");
        assertEq(awakening.loans(loanId).borrower, address(0), "loan deleted");
    }

    function testSettleAfterPartialRepay(uint256 units, uint256 collateral) public {
        units = bound(units, 1e18, 1e24);
        collateral = bound(collateral, 1e6, 1e8);
        bytes32 loanId = _borrow(units, collateral);

        _mature();
        uint256 partialUnits = units / 2;
        vm.prank(borrower);
        settlement.repay(id, partialUnits);

        vm.prank(keeper);
        settlement.redeemPATs(id);

        uint256 remaining = units - partialUnits;
        uint256 proceeds = remaining + remaining / 10;

        deal(address(loanToken), keeper, proceeds);
        vm.prank(keeper);
        loanToken.approve(address(settlement), type(uint256).max);

        vm.prank(keeper);
        settlement.settle(id, proceeds);

        assertEq(awakening.debtOf(id, borrower), 0, "debt cleared");
        assertEq(collateralToken1.balanceOf(keeper), collateral, "collateral to keeper");
        assertEq(awakening.loans(loanId).borrower, address(0), "loan deleted");
    }

    // --- collateral accounting: no phantom collateral after repay/settle ---

    function testNoPhantomCollateralAfterRepay(uint256 units, uint256 collateral) public {
        units = bound(units, 1e18, 1e24);
        collateral = bound(collateral, 1e6, 1e8);
        _borrow(units, collateral);
        assertEq(awakening.collateral(id, borrower, 0), collateral, "collateral recorded");

        _mature();
        vm.prank(borrower);
        settlement.repay(id, units);

        assertEq(awakening.collateral(id, borrower, 0), 0, "no phantom collateral after repay");
        assertEq(awakening.collateralBitmap(id, borrower), 0, "bitmap cleared");
    }

    function testNoPhantomCollateralAfterSettle(uint256 units, uint256 collateral) public {
        units = bound(units, 1e18, 1e24);
        collateral = bound(collateral, 1e6, 1e8);
        _borrow(units, collateral);
        assertEq(awakening.collateral(id, borrower, 0), collateral, "collateral recorded");

        _mature();
        vm.prank(keeper);
        settlement.redeemPATs(id);

        uint256 proceeds = units + units / 10;
        deal(address(loanToken), keeper, proceeds);
        vm.prank(keeper);
        loanToken.approve(address(settlement), type(uint256).max);
        vm.prank(keeper);
        settlement.settle(id, proceeds);

        assertEq(awakening.collateral(id, borrower, 0), 0, "no phantom collateral after settle");
        assertEq(awakening.collateralBitmap(id, borrower), 0, "bitmap cleared");
    }

    // --- access control / validation ---

    function testRedeemPATsOnlyOptionKeeper() public {
        _borrow(1e18, 1e8);
        _mature();

        vm.prank(makeAddr("notKeeper"));
        vm.expectRevert(IAwakeningSettlement.NotOptionKeeper.selector);
        settlement.redeemPATs(id);
    }

    function testSettleOnlyOptionKeeper() public {
        _borrow(1e18, 1e8);
        _mature();
        vm.prank(keeper);
        settlement.redeemPATs(id);

        vm.prank(makeAddr("notKeeper"));
        vm.expectRevert(IAwakeningSettlement.NotOptionKeeper.selector);
        settlement.settle(id, 1e18);
    }

    function testSettleBeforeRedeemPATsReverts() public {
        _borrow(1e18, 1e8);
        _mature();

        vm.prank(keeper);
        vm.expectRevert(IAwakeningSettlement.InvalidState.selector);
        settlement.settle(id, 1e18);
    }

    function testSettleInsufficientProceeds() public {
        _borrow(1e18, 1e8);
        _mature();
        vm.prank(keeper);
        settlement.redeemPATs(id);

        deal(address(loanToken), keeper, 1e18);
        vm.prank(keeper);
        loanToken.approve(address(settlement), type(uint256).max);

        vm.prank(keeper);
        vm.expectRevert(IAwakeningSettlement.InsufficientProceeds.selector);
        settlement.settle(id, 1e18 - 1);
    }

    function testSettleLoanOnlySettlement() public {
        _borrow(1e18, 1e8);

        vm.prank(makeAddr("notSettlement"));
        vm.expectRevert(IAwakening.OnlySettlement.selector);
        awakening.settleLoan(bytes32(0), keeper);
    }
}
