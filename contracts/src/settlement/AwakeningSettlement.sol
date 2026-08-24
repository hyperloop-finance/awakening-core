// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (c) 2025 Morpho Association
pragma solidity 0.8.34;

import {IAwakening, Market, Loan, SettlementState} from "../interfaces/IAwakening.sol";
import {IAwakeningSettlement} from "../interfaces/IAwakeningSettlement.sol";
import {IOracle} from "../interfaces/IOracle.sol";
import {SafeTransferLib} from "../libraries/SafeTransferLib.sol";
import {UtilsLib} from "../libraries/UtilsLib.sol";
import {WAD} from "../libraries/ConstantsLib.sol";

/// @dev Maturity settlement state machine, one per Awakening deployment.
/// @dev At maturity the terminal BTC price is read once. Borrowers may then repay (reclaiming collateral) until the
/// option keeper redeems the puts. Afterwards the keeper settles defaulted loans off-chain and reports net proceeds,
/// distributed to lenders (principal), the protocol (penalty) and borrowers (the remainder).
contract AwakeningSettlement is IAwakeningSettlement {
    using UtilsLib for uint256;

    address public immutable AWAKENING;

    mapping(bytes32 id => SettlementState) internal _state;
    mapping(bytes32 id => uint256) internal _terminalPrice;

    event OracleRead(bytes32 indexed id, uint256 terminalPrice);
    event Settled(bytes32 indexed id, uint256 proceeds, uint256 penalty);

    constructor(address awakening) {
        AWAKENING = awakening;
    }

    function state(bytes32 id) external view returns (SettlementState) {
        return _state[id];
    }

    function terminalPrice(bytes32 id) external view returns (uint256) {
        return _terminalPrice[id];
    }

    /// @dev Reads the BTC oracle exactly once at maturity and stores the terminal price (permissionless).
    function readOracleAtMaturity(bytes32 id) external {
        Market memory market = IAwakening(AWAKENING).toMarket(id);
        require(block.timestamp >= market.maturity, NotMature());
        require(_state[id] == SettlementState.PRE_MATURITY, InvalidState());

        uint256 price = IOracle(market.collateralParams[0].oracle).price();
        _terminalPrice[id] = price;
        _state[id] = SettlementState.ORACLE_READ;

        emit OracleRead(id, price);
    }

    /// @dev Borrower repays principal and reclaims collateral once fully repaid. Repayment is allowed before maturity
    /// (early repayment, D8 — the put is kept for resale) and after the oracle read (normal repayment).
    function repay(bytes32 id, uint256 units) external {
        require(
            _state[id] == SettlementState.PRE_MATURITY || _state[id] == SettlementState.ORACLE_READ, InvalidState()
        );

        bytes32 loanId = IAwakening(AWAKENING).borrowerLoan(id, msg.sender);
        IAwakening(AWAKENING).repayLoan(loanId, units, msg.sender);
    }

    /// @dev Option keeper closes the repayment window after redeeming the puts off-chain.
    function redeemPATs(bytes32 id) external {
        require(msg.sender == IAwakening(AWAKENING).optionKeeper(), NotOptionKeeper());
        require(_state[id] == SettlementState.ORACLE_READ, InvalidState());

        _state[id] = SettlementState.PAT_REDEEMED;
    }

    /// @dev Bundles the snapshot of defaulted loans to keep `settle` shallow on the stack under the non-viaIR
    /// (coverage) codegen.
    struct DefaultedLoans {
        bytes32[] loanIds;
        address[] borrowers;
        uint256[] remainings;
        uint256 n;
        uint256 totalRemaining;
    }

    /// @dev Option keeper settles defaulted loans: it sells each put + collateral off-chain and reports net proceeds.
    function settle(bytes32 id, uint256 proceeds) external {
        require(msg.sender == IAwakening(AWAKENING).optionKeeper(), NotOptionKeeper());
        require(_state[id] == SettlementState.PAT_REDEEMED, InvalidState());

        Market memory market = IAwakening(AWAKENING).toMarket(id);
        address loanToken = market.loanToken;

        DefaultedLoans memory loans = _snapshotDefaultedLoans(id);
        require(loans.n > 0, NoDefaultedLoans());
        require(proceeds >= loans.totalRemaining, InsufficientProceeds());

        // Pull proceeds from the keeper.
        SafeTransferLib.safeTransferFrom(loanToken, msg.sender, address(this), proceeds);

        uint256 excess = proceeds - loans.totalRemaining;
        uint256 penalty = UtilsLib.min(loans.totalRemaining.mulDivDown(market.penaltyPct, WAD), excess);
        uint256 remainder = excess - penalty;

        // Principal + penalty back Awakening, then settle each loan (collateral → keeper).
        SafeTransferLib.safeTransfer(loanToken, AWAKENING, loans.totalRemaining + penalty);
        IAwakening(AWAKENING).accrueSettlementFee(loanToken, penalty);
        for (uint256 i; i < loans.n; i++) {
            IAwakening(AWAKENING).settleLoan(loans.loanIds[i], msg.sender);
        }

        // Remainder → borrowers, proportional to each loan's remaining principal.
        _distributeRemainder(loans, loanToken, remainder);

        _state[id] = SettlementState.FINAL;

        emit Settled(id, proceeds, penalty);
    }

    /// @dev Snapshots the defaulted loans (a loan is defaulted if it has not been fully repaid yet).
    function _snapshotDefaultedLoans(bytes32 id) internal view returns (DefaultedLoans memory result) {
        uint256 count = IAwakening(AWAKENING).marketLoanCount(id);
        result.loanIds = new bytes32[](count);
        result.borrowers = new address[](count);
        result.remainings = new uint256[](count);
        for (uint256 i; i < count; i++) {
            bytes32 loanId = IAwakening(AWAKENING).marketLoanIds(id, i);
            Loan memory loan = IAwakening(AWAKENING).loans(loanId);
            if (loan.borrower == address(0)) continue;
            uint256 remaining = loan.principal - loan.lastRepaid;
            if (remaining == 0) continue; // early-repaid loan; its put is handled via reportPutResale
            result.loanIds[result.n] = loanId;
            result.borrowers[result.n] = loan.borrower;
            result.remainings[result.n] = remaining;
            result.totalRemaining += remaining;
            result.n++;
        }
    }

    /// @dev Distributes the remainder to borrowers proportionally; rounding dust goes to the keeper.
    function _distributeRemainder(DefaultedLoans memory loans, address loanToken, uint256 remainder) internal {
        uint256 paidRemainder;
        for (uint256 i; i < loans.n; i++) {
            uint256 share = remainder.mulDivDown(loans.remainings[i], loans.totalRemaining);
            if (share > 0) SafeTransferLib.safeTransfer(loanToken, loans.borrowers[i], share);
            paidRemainder += share;
        }
        if (remainder > paidRemainder) SafeTransferLib.safeTransfer(loanToken, msg.sender, remainder - paidRemainder);
    }

    /// @dev Option keeper reports the resale proceeds of an early-repaid loan's put (D8). The proceeds are pulled
    /// from the keeper into Awakening and credited to the borrower for later claim.
    function reportPutResale(bytes32 id, bytes32 loanId, uint256 proceeds) external {
        require(msg.sender == IAwakening(AWAKENING).optionKeeper(), NotOptionKeeper());

        Market memory market = IAwakening(AWAKENING).toMarket(id);
        address loanToken = market.loanToken;

        SafeTransferLib.safeTransferFrom(loanToken, msg.sender, AWAKENING, proceeds);
        IAwakening(AWAKENING).reportPutResale(loanId, proceeds);
    }
}
