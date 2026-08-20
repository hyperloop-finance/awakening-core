// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (c) 2025 Morpho Association
pragma solidity ^0.8.0;

import {
    MAX_CONTINUOUS_FEE,
    MAX_SETTLEMENT_FEE_0_DAYS,
    MAX_SETTLEMENT_FEE_1_DAY,
    MAX_SETTLEMENT_FEE_7_DAYS,
    MAX_SETTLEMENT_FEE_30_DAYS,
    MAX_SETTLEMENT_FEE_90_DAYS,
    MAX_SETTLEMENT_FEE_180_DAYS,
    MAX_SETTLEMENT_FEE_360_DAYS
} from "../src/libraries/ConstantsLib.sol";
import {BaseTest} from "./BaseTest.sol";
import {IAwakening, Market, CollateralParams} from "../src/interfaces/IAwakening.sol";
import {Awakening} from "../src/Awakening.sol";
import {EventsLib} from "../src/libraries/EventsLib.sol";

contract SettersTest is BaseTest {
    /// @dev Builds a single-BTC market to keep the large fee-setter tests shallow on the stack.
    function _makeMarket(address loanToken, uint256 maturity) internal view returns (Market memory market) {
        CollateralParams[] memory collateralParams = new CollateralParams[](1);
        collateralParams[0] = CollateralParams({token: address(collateralToken1), oracle: address(oracle1)});
        market = Market({
            loanToken: loanToken,
            maturity: maturity,
            collateralParams: collateralParams,
            maxStrike: type(uint256).max,
            penaltyPct: 5e16,
            enterGate: address(0)
        });
    }

    /// @dev Builds + touches a single-BTC market, returning its id (keeps callers shallow on the stack).
    function _touchSingleCollateralMarket(address loanToken, uint256 maturity) internal returns (bytes32 id) {
        Market memory market = _makeMarket(loanToken, maturity);
        id = toId(market);
        awakening.touchMarket(market);
    }

    function testMaxSettlementFeeConstants() public pure {
        assertEq(maxSettlementFee(0), MAX_SETTLEMENT_FEE_0_DAYS, "0 days max settlement fee");
        assertEq(maxSettlementFee(1), MAX_SETTLEMENT_FEE_1_DAY, "1 day max settlement fee");
        assertEq(maxSettlementFee(2), MAX_SETTLEMENT_FEE_7_DAYS, "7 days max settlement fee");
        assertEq(maxSettlementFee(3), MAX_SETTLEMENT_FEE_30_DAYS, "30 days max settlement fee");
        assertEq(maxSettlementFee(4), MAX_SETTLEMENT_FEE_90_DAYS, "90 days max settlement fee");
        assertEq(maxSettlementFee(5), MAX_SETTLEMENT_FEE_180_DAYS, "180 days max settlement fee");
        assertEq(maxSettlementFee(6), MAX_SETTLEMENT_FEE_360_DAYS, "360 days max settlement fee");
    }

    function testInitialRoleSetter() public view {
        assertEq(awakening.roleSetter(), address(this), "deployer should be initial role setter");
    }

    function testConstructorEvent() public {
        vm.expectEmit();
        emit EventsLib.Constructor(address(this), block.chainid);

        new Awakening();
    }

    function testSetRoleSetterSuccess(address rdm) public {
        vm.expectEmit();
        emit EventsLib.SetRoleSetter(rdm);

        awakening.setRoleSetter(rdm);
        assertEq(awakening.roleSetter(), rdm, "role setter should be transferred");
    }

    function testSetRoleSetterOnlyRoleSetter(address rdm) public {
        vm.assume(rdm != address(this));
        vm.prank(rdm);
        vm.expectRevert(IAwakening.OnlyRoleSetter.selector);
        awakening.setRoleSetter(makeAddr("newRoleSetter"));
    }

    function testSetFeeSetterSuccess(address feeSetter) public {
        vm.expectEmit();
        emit EventsLib.SetFeeSetter(feeSetter);

        awakening.setFeeSetter(feeSetter);
        assertEq(awakening.feeSetter(), feeSetter);
    }

    function testSetTickSpacingSetterSuccess(address tickSpacingSetter) public {
        vm.expectEmit();
        emit EventsLib.SetTickSpacingSetter(tickSpacingSetter);

        awakening.setTickSpacingSetter(tickSpacingSetter);
        assertEq(awakening.tickSpacingSetter(), tickSpacingSetter);
    }

    function testSetFeeSetterOnlyRoleSetter(address rdm) public {
        vm.assume(rdm != address(this));
        vm.prank(rdm);
        vm.expectRevert(IAwakening.OnlyRoleSetter.selector);
        awakening.setFeeSetter(makeAddr("newFeeSetter"));
    }

    function testSetSettlementFeeSuccess(address loanToken, uint256[7] memory fees) public {
        for (uint256 i; i < 7; i++) {
            fees[i] = bound(fees[i], 0, maxSettlementFee(i)) / 1e12 * 1e12;
        }

        bytes32 id = _touchSingleCollateralMarket(loanToken, vm.getBlockTimestamp() + 1 days);

        for (uint256 i; i < 7; i++) {
            vm.expectEmit();
            emit EventsLib.SetMarketSettlementFee(id, i, fees[i]);
            awakening.setMarketSettlementFee(id, i, fees[i]);
        }

        assertEq(awakening.settlementFee(id, 0), fees[0], "post maturity settlement fee");
        assertEq(awakening.settlementFee(id, 1 days), fees[1], "one day settlement fee");
        assertEq(awakening.settlementFee(id, 7 days), fees[2], "seven days settlement fee");
        assertEq(awakening.settlementFee(id, 30 days), fees[3], "thirty days settlement fee");
        assertEq(awakening.settlementFee(id, 90 days), fees[4], "ninety days settlement fee");
        assertEq(awakening.settlementFee(id, 180 days), fees[5], "one eighty days settlement fee");
        assertEq(awakening.settlementFee(id, 360 days), fees[6], "three sixty days settlement fee");
        assertEq(awakening.settlementFee(id, 365 days), fees[6], "three sixty five days settlement fee");
        assertEq(awakening.settlementFee(id, 1000 days), fees[6], "one thousand days settlement fee");
    }

    function testSetSettlementFeeInvalidIndex(bytes32 id) public {
        vm.expectRevert(IAwakening.InvalidFeeIndex.selector);
        awakening.setMarketSettlementFee(id, 7, 0);
    }

    function testSetDefaultSettlementFeeInvalidIndex(address loanToken) public {
        vm.expectRevert(IAwakening.InvalidFeeIndex.selector);
        awakening.setDefaultSettlementFee(loanToken, 7, 0);
    }

    function testSetMarketSettlementFeeValueTooHigh(bytes32 id, uint256 feeTooHigh, uint256 index) public {
        index = bound(index, 0, 6);
        feeTooHigh = bound(feeTooHigh, maxSettlementFee(index) + 1, 1e18);
        vm.expectRevert(IAwakening.SettlementFeeTooHigh.selector);
        awakening.setMarketSettlementFee(id, index, feeTooHigh);
    }

    function testSetSettlementFeeNotMultipleOfFeeCbp(bytes32 id, uint256 index, uint256 fee) public {
        index = bound(index, 0, 6);
        fee = bound(fee, 1, maxSettlementFee(index));
        vm.assume(fee % 1e12 != 0);
        vm.expectRevert(IAwakening.FeeNotMultipleOfFeeCbp.selector);
        awakening.setMarketSettlementFee(id, index, fee);
    }

    function testSetDefaultSettlementFeeNotMultipleOfFeeCbp(address loanToken, uint256 index, uint256 fee) public {
        index = bound(index, 0, 6);
        fee = bound(fee, 1, maxSettlementFee(index));
        vm.assume(fee % 1e12 != 0);
        vm.expectRevert(IAwakening.FeeNotMultipleOfFeeCbp.selector);
        awakening.setDefaultSettlementFee(loanToken, index, fee);
    }

    function testSetMarketSettlementFeeMarketNotCreated(bytes32 id) public {
        vm.expectRevert(IAwakening.MarketNotCreated.selector);
        awakening.setMarketSettlementFee(id, 0, 0);
    }

    function testSetMarketContinuousFeeMarketNotCreated(bytes32 id, uint256 fee) public {
        fee = bound(fee, 0, MAX_CONTINUOUS_FEE);
        vm.expectRevert(IAwakening.MarketNotCreated.selector);
        awakening.setMarketContinuousFee(id, fee);
    }

    function testSetSettlementFeeOnlyFeeSetter(address rdm, bytes32 id) public {
        vm.assume(rdm != address(this));
        vm.prank(rdm);
        vm.expectRevert(IAwakening.OnlyFeeSetter.selector);
        awakening.setMarketSettlementFee(id, 0, 0);
    }

    function testSetFeeClaimerSuccess(address feeClaimer) public {
        vm.expectEmit();
        emit EventsLib.SetFeeClaimer(feeClaimer);

        awakening.setFeeClaimer(feeClaimer);
        assertEq(awakening.feeClaimer(), feeClaimer, "fee claimer set");
    }

    function testSetFeeClaimerOnlyRoleSetter(address rdm) public {
        vm.assume(rdm != address(this));
        vm.prank(rdm);
        vm.expectRevert(IAwakening.OnlyRoleSetter.selector);
        awakening.setFeeClaimer(makeAddr("newRecipient"));
    }

    function testSetOptionKeeperSuccess(address optionKeeper) public {
        vm.expectEmit();
        emit EventsLib.SetOptionKeeper(optionKeeper);

        awakening.setOptionKeeper(optionKeeper);
        assertEq(awakening.optionKeeper(), optionKeeper, "option keeper set");
    }

    function testSetOptionKeeperOnlyRoleSetter(address rdm) public {
        vm.assume(rdm != address(this));
        vm.prank(rdm);
        vm.expectRevert(IAwakening.OnlyRoleSetter.selector);
        awakening.setOptionKeeper(makeAddr("newOptionKeeper"));
    }

    function testSetOptionVaultSuccess(address optionVault) public {
        vm.expectEmit();
        emit EventsLib.SetOptionVault(optionVault);

        awakening.setOptionVault(optionVault);
        assertEq(awakening.optionVault(), optionVault, "option vault set");
    }

    function testSetOptionVaultOnlyRoleSetter(address rdm) public {
        vm.assume(rdm != address(this));
        vm.prank(rdm);
        vm.expectRevert(IAwakening.OnlyRoleSetter.selector);
        awakening.setOptionVault(makeAddr("newOptionVault"));
    }

    function testSetPatSuccess(address pat) public {
        vm.expectEmit();
        emit EventsLib.SetPat(pat);

        awakening.setPat(pat);
        assertEq(awakening.pat(), pat, "pat set");
    }

    function testSetPatOnlyRoleSetter(address rdm) public {
        vm.assume(rdm != address(this));
        vm.prank(rdm);
        vm.expectRevert(IAwakening.OnlyRoleSetter.selector);
        awakening.setPat(makeAddr("newPat"));
    }

    function testSetSettlementSuccess(address settlement) public {
        vm.expectEmit();
        emit EventsLib.SetSettlement(settlement);

        awakening.setSettlement(settlement);
        assertEq(awakening.settlement(), settlement, "settlement set");
    }

    function testSetSettlementOnlyRoleSetter(address rdm) public {
        vm.assume(rdm != address(this));
        vm.prank(rdm);
        vm.expectRevert(IAwakening.OnlyRoleSetter.selector);
        awakening.setSettlement(makeAddr("newSettlement"));
    }

    // Default settlement fee tests

    function testSettlementFeeRevertsWhenNotCreated() public {
        vm.expectRevert(IAwakening.MarketNotCreated.selector);
        awakening.settlementFee(bytes32(0), 0);
    }

    function testSetDefaultSettlementFeeSuccess(address loanToken, uint256[7] memory fees) public {
        for (uint256 i; i < 7; i++) {
            uint256 min = i == 0 ? 0 : fees[i - 1];
            fees[i] = bound(fees[i], min, maxSettlementFee(i)) / 1e12 * 1e12;
        }

        for (uint256 i; i < 7; i++) {
            vm.expectEmit();
            emit EventsLib.SetDefaultSettlementFee(loanToken, i, fees[i]);
            awakening.setDefaultSettlementFee(loanToken, i, fees[i]);
        }

        // touch market with this loan token
        bytes32 id = _touchSingleCollateralMarket(loanToken, vm.getBlockTimestamp() + 1 days);

        assertEq(awakening.settlementFee(id, 0), fees[0], "0 days default fee");
        assertEq(awakening.settlementFee(id, 1 days), fees[1], "1 day default fee");
        assertEq(awakening.settlementFee(id, 7 days), fees[2], "7 days default fee");
        assertEq(awakening.settlementFee(id, 30 days), fees[3], "30 days default fee");
        assertEq(awakening.settlementFee(id, 90 days), fees[4], "90 days default fee");
        assertEq(awakening.settlementFee(id, 180 days), fees[5], "180 days default fee");
        assertEq(awakening.settlementFee(id, 360 days), fees[6], "360 days default fee");
        assertEq(awakening.settlementFee(id, 365 days), fees[6], "365 days default fee");
        assertEq(awakening.settlementFee(id, 1000 days), fees[6], "1000 days default fee");
    }

    function testSetDefaultSettlementFeeOnlyFeeSetter(address rdm, address loanToken) public {
        vm.assume(rdm != address(this));
        vm.prank(rdm);
        vm.expectRevert(IAwakening.OnlyFeeSetter.selector);
        awakening.setDefaultSettlementFee(loanToken, 0, 0);
    }

    function testSetDefaultSettlementFeeValidation(address loanToken, uint256 feeTooHigh, uint256 index) public {
        index = bound(index, 0, 6);
        feeTooHigh = bound(feeTooHigh, maxSettlementFee(index) + 1, 1e18);
        vm.expectRevert(IAwakening.SettlementFeeTooHigh.selector);
        awakening.setDefaultSettlementFee(loanToken, index, feeTooHigh);
    }

    function testSettlementFeeLinearInterpolation(uint256[7] memory fees) public {
        for (uint256 i; i < 7; i++) {
            fees[i] = bound(fees[i], 0, maxSettlementFee(i)) / 1e12 * 1e12;
        }

        bytes32 id = _touchSingleCollateralMarket(address(0), vm.getBlockTimestamp() + 1 days);

        for (uint256 i; i < 7; i++) {
            awakening.setMarketSettlementFee(id, i, fees[i]);
        }

        // Test exact breakpoints
        assertEq(awakening.settlementFee(id, 0), fees[0], "0 days");
        assertEq(awakening.settlementFee(id, 1 days), fees[1], "1 day");
        assertEq(awakening.settlementFee(id, 7 days), fees[2], "7 days");
        assertEq(awakening.settlementFee(id, 30 days), fees[3], "30 days");
        assertEq(awakening.settlementFee(id, 90 days), fees[4], "90 days");
        assertEq(awakening.settlementFee(id, 180 days), fees[5], "180 days");
        assertEq(awakening.settlementFee(id, 360 days), fees[6], "360 days");

        // Test interpolation midpoint (0.5 days is between index 0 and 1)
        uint256 expectedMidpoint = (fees[0] * (1 days - 0.5 days) + fees[1] * (0.5 days)) / 1 days;
        assertEq(awakening.settlementFee(id, 0.5 days), expectedMidpoint, "Midpoint 0-1d");

        // Test interpolation midpoint (4 days is between index 1 and 2)
        uint256 expectedMid4d = (fees[1] * (7 days - 4 days) + fees[2] * (4 days - 1 days)) / (7 days - 1 days);
        assertEq(awakening.settlementFee(id, 4 days), expectedMid4d, "Midpoint 1-7d");

        // Test interpolation midpoint (270 days is between index 5 [180d] and index 6 [360d])
        uint256 expectedMid270d = (fees[5] * (360 days - 270 days) + fees[6] * (270 days - 180 days)) / (360 days - 180 days);
        assertEq(awakening.settlementFee(id, 270 days), expectedMid270d, "Midpoint 180-360d");

        // Test beyond 360 days
        assertEq(awakening.settlementFee(id, 365 days), fees[6], "365 days");
        assertEq(awakening.settlementFee(id, 1000 days), fees[6], "1000 days");
    }

    function testSetContinuousFeeOnlyFeeSetter(address rdm) public {
        vm.assume(rdm != address(this));

        CollateralParams[] memory collateralParams = new CollateralParams[](1);
        collateralParams[0] = CollateralParams({
            token: address(collateralToken1), oracle: address(oracle1)
        });
        Market memory market = Market({
            loanToken: address(loanToken),
            maturity: vm.getBlockTimestamp() + 100 days,
            collateralParams: collateralParams,
            
            maxStrike: type(uint256).max,
            penaltyPct: 5e16,
            enterGate: address(0)
        });
        awakening.touchMarket(market);
        bytes32 id = toId(market);

        vm.prank(rdm);
        vm.expectRevert(IAwakening.OnlyFeeSetter.selector);
        awakening.setMarketContinuousFee(id, 100);

        vm.prank(rdm);
        vm.expectRevert(IAwakening.OnlyFeeSetter.selector);
        awakening.setDefaultContinuousFee(address(loanToken), 100);
    }

    function testSetContinuousFeeTooHigh(uint256 fee) public {
        fee = bound(fee, MAX_CONTINUOUS_FEE + 1, type(uint256).max);

        CollateralParams[] memory collateralParams = new CollateralParams[](1);
        collateralParams[0] = CollateralParams({
            token: address(collateralToken1), oracle: address(oracle1)
        });
        Market memory market = Market({
            loanToken: address(loanToken),
            maturity: vm.getBlockTimestamp() + 100 days,
            collateralParams: collateralParams,
            
            maxStrike: type(uint256).max,
            penaltyPct: 5e16,
            enterGate: address(0)
        });
        awakening.touchMarket(market);
        bytes32 id = toId(market);

        vm.expectRevert(IAwakening.ContinuousFeeTooHigh.selector);
        awakening.setMarketContinuousFee(id, fee);

        vm.expectRevert(IAwakening.ContinuousFeeTooHigh.selector);
        awakening.setDefaultContinuousFee(address(loanToken), fee);
    }

    function testSetContinuousFeeSuccess(uint256 fee, uint256 fee2) public {
        fee = bound(fee, 0, MAX_CONTINUOUS_FEE);
        fee2 = bound(fee2, 0, MAX_CONTINUOUS_FEE);
        vm.assume(fee != fee2);

        vm.expectEmit();
        emit EventsLib.SetDefaultContinuousFee(address(loanToken), fee);

        awakening.setDefaultContinuousFee(address(loanToken), fee);
        assertEq(awakening.defaultContinuousFee(address(loanToken)), fee, "default fee updated");

        CollateralParams[] memory collateralParams = new CollateralParams[](1);
        collateralParams[0] = CollateralParams({
            token: address(collateralToken1), oracle: address(oracle1)
        });
        Market memory market = Market({
            loanToken: address(loanToken),
            maturity: vm.getBlockTimestamp() + 100 days,
            collateralParams: collateralParams,
            
            maxStrike: type(uint256).max,
            penaltyPct: 5e16,
            enterGate: address(0)
        });
        awakening.touchMarket(market);
        bytes32 id = toId(market);

        assertEq(awakening.continuousFee(id), fee, "market inherits default fee");

        vm.expectEmit();
        emit EventsLib.SetMarketContinuousFee(id, fee2);

        awakening.setMarketContinuousFee(id, fee2);
        assertEq(awakening.continuousFee(id), fee2, "market fee updated");
    }
}
