// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 Morpho Association
pragma solidity 0.8.34;

import {IAwakening, Offer, MarketState, Position, PendingTake, Loan} from "../interfaces/IAwakening.sol";
import {IOptionVault} from "../interfaces/IOptionVault.sol";
import {IPAT, OptionTerms} from "../interfaces/IPAT.sol";
import {IRatifier} from "../interfaces/IRatifier.sol";
import {IEnterGate} from "../interfaces/IGate.sol";
import {UtilsLib} from "./UtilsLib.sol";
import {TickLib} from "./TickLib.sol";
import {SafeTransferLib} from "./SafeTransferLib.sol";
import {EventsLib} from "./EventsLib.sol";
import "./ConstantsLib.sol"; // forge-lint: disable-line(unaliased-plain-import)

/// @dev Delegatecall target holding the loan lifecycle: the two-step take and the settlement hooks.
///      It accesses Awakening's storage via explicit slot numbers, which MUST mirror Awakening.sol's declaration order.
///      `INITIAL_CHAIN_ID` is immutable (no slot), so the storage slots start at 0 for `position`.
///      It is deployed by Awakening's constructor and only ever called via delegatecall.
contract AwakeningLoans {
    using UtilsLib for uint256;
    using UtilsLib for uint128;

    /// @dev Bundles the values a completed take needs for finalization (kept here, not in Awakening).
    struct CompletedTake {
        bytes32 id;
        address borrower;
        address lender;
        uint256 units;
        uint256 collateral;
        uint256 settlementFee;
        uint256 maturity;
        address loanToken;
        uint256 strike;
        uint256 premium;
        uint256 net;
        uint256 patTokenId;
    }

    /// @dev Loan lifecycle storage, stored at slot 15 to mirror Awakening.sol's `_pendingTakes` .. `pendingNonce`.
    struct LoanStorage {
        mapping(bytes32 => PendingTake) pendingTakes;
        mapping(bytes32 => Loan) loans;
        mapping(bytes32 => mapping(address => bytes32)) borrowerLoan;
        mapping(bytes32 => bytes32[]) marketLoanIds;
        uint256 pendingNonce;
    }

    /// STORAGE SLOTS (mirror of Awakening.sol) ///

    uint256 internal constant POSITION_SLOT = 0;
    uint256 internal constant MARKET_STATE_SLOT = 1;
    uint256 internal constant CONSUMED_SLOT = 2;
    uint256 internal constant IS_AUTHORIZED_SLOT = 3;
    uint256 internal constant CLAIMABLE_SETTLEMENT_FEE_SLOT = 6;
    uint256 internal constant OPTION_KEEPER_SLOT = 11;
    uint256 internal constant OPTION_VAULT_SLOT = 12;
    uint256 internal constant PAT_SLOT = 13;
    uint256 internal constant SETTLEMENT_SLOT = 14;
    uint256 internal constant LOAN_STORAGE_SLOT = 15;

    /// STORAGE ACCESSORS ///

    function _position(bytes32 id, address user) internal pure returns (Position storage pos) {
        bytes32 slot = keccak256(abi.encode(user, keccak256(abi.encode(id, POSITION_SLOT))));
        assembly ("memory-safe") {
            pos.slot := slot
        }
    }

    function _marketState(bytes32 id) internal pure returns (MarketState storage ms) {
        bytes32 slot = keccak256(abi.encode(id, MARKET_STATE_SLOT));
        assembly ("memory-safe") {
            ms.slot := slot
        }
    }

    function _consumed(address user, bytes32 group) internal view returns (uint256 value) {
        bytes32 slot = keccak256(abi.encode(group, keccak256(abi.encode(user, CONSUMED_SLOT))));
        assembly ("memory-safe") {
            value := sload(slot)
        }
    }

    function _setConsumed(address user, bytes32 group, uint256 value) internal {
        bytes32 slot = keccak256(abi.encode(group, keccak256(abi.encode(user, CONSUMED_SLOT))));
        assembly ("memory-safe") {
            sstore(slot, value)
        }
    }

    function _isAuthorized(address authorizer, address authorized) internal view returns (bool) {
        bytes32 slot = keccak256(abi.encode(authorized, keccak256(abi.encode(authorizer, IS_AUTHORIZED_SLOT))));
        uint256 value;
        assembly ("memory-safe") {
            value := sload(slot)
        }
        return value != 0;
    }

    function _claimableSettlementFee(address token) internal view returns (uint256 value) {
        bytes32 slot = keccak256(abi.encode(token, CLAIMABLE_SETTLEMENT_FEE_SLOT));
        assembly ("memory-safe") {
            value := sload(slot)
        }
    }

    function _addClaimableSettlementFee(address token, uint256 amount) internal {
        bytes32 slot = keccak256(abi.encode(token, CLAIMABLE_SETTLEMENT_FEE_SLOT));
        assembly ("memory-safe") {
            sstore(slot, add(sload(slot), amount))
        }
    }

    function _optionKeeper() internal view returns (address a) {
        assembly ("memory-safe") {
            a := sload(OPTION_KEEPER_SLOT)
        }
    }

    function _optionVault() internal view returns (address a) {
        assembly ("memory-safe") {
            a := sload(OPTION_VAULT_SLOT)
        }
    }

    function _pat() internal view returns (address a) {
        assembly ("memory-safe") {
            a := sload(PAT_SLOT)
        }
    }

    function _settlement() internal view returns (address a) {
        assembly ("memory-safe") {
            a := sload(SETTLEMENT_SLOT)
        }
    }

    function _loanStorage() internal pure returns (LoanStorage storage s) {
        assembly ("memory-safe") {
            s.slot := LOAN_STORAGE_SLOT
        }
    }

    /// TWO-STEP TAKE ///
    /// @dev The borrower is always the seller; the lender is always the buyer.

    function takeInit(Offer memory offer, bytes memory ratifierData, uint256 units, uint256 collateral, address taker)
        external
        returns (bytes32 pendingId)
    {
        require(taker == msg.sender || _isAuthorized(taker, msg.sender), IAwakening.TakerUnauthorized());
        require(collateral > 0, IAwakening.ZeroCollateral());
        require(units <= type(uint128).max, UtilsLib.CastOverflow());

        bytes32 id = IAwakening(address(this)).touchMarket(offer.market);
        MarketState storage _marketState = _marketState(id);

        require((offer.maxAssets == 0) != (offer.maxUnits == 0), IAwakening.InvalidOfferCaps());
        require(offer.tick % _marketState.tickSpacing == 0, IAwakening.TickNotAccessible());
        require(block.timestamp >= offer.start, IAwakening.OfferNotStarted());
        require(block.timestamp <= offer.expiry, IAwakening.OfferExpired());
        require(offer.maker != taker, IAwakening.SelfTake());
        require(_isAuthorized(offer.maker, offer.ratifier), IAwakening.RatifierUnauthorized());
        require(IRatifier(offer.ratifier).isRatified(offer, ratifierData) == CALLBACK_SUCCESS, IAwakening.RatifierFail());

        uint256 offerPrice = TickLib.tickToPrice(offer.tick);
        uint256 timeToMaturity = UtilsLib.zeroFloorSub(offer.market.maturity, block.timestamp);
        uint256 _settlementFee = IAwakening(address(this)).settlementFee(id, timeToMaturity);
        uint256 sellerPrice = offer.buy ? offerPrice - _settlementFee : offerPrice;
        uint256 buyerPrice = sellerPrice + _settlementFee;
        uint256 buyerAssets = offer.buy ? units.mulDivDown(buyerPrice, WAD) : units.mulDivUp(buyerPrice, WAD);
        uint256 sellerAssets = offer.buy ? units.mulDivDown(sellerPrice, WAD) : units.mulDivUp(sellerPrice, WAD);

        uint256 newConsumed;
        if (offer.maxAssets > 0) {
            newConsumed = _consumed(offer.maker, offer.group) + (offer.buy ? buyerAssets : sellerAssets);
            require(newConsumed <= offer.maxAssets, IAwakening.ConsumedAssets());
        } else {
            newConsumed = _consumed(offer.maker, offer.group) + units;
            require(newConsumed <= offer.maxUnits, IAwakening.ConsumedUnits());
        }
        _setConsumed(offer.maker, offer.group, newConsumed);

        (address buyer, address seller) = offer.buy ? (offer.maker, taker) : (taker, offer.maker);

        require(block.timestamp <= offer.market.maturity, IAwakening.CannotIncreaseDebtPostMaturity());
        require(
            offer.market.enterGate == address(0) || IEnterGate(offer.market.enterGate).canIncreaseCredit(buyer),
            IAwakening.BuyerGatedFromIncreasingCredit()
        );
        require(
            offer.market.enterGate == address(0) || IEnterGate(offer.market.enterGate).canIncreaseDebt(seller),
            IAwakening.SellerGatedFromIncreasingDebt()
        );

        uint256 strike = units.mulDivUp(ORACLE_PRICE_SCALE, collateral);
        require(strike <= offer.market.maxStrike, IAwakening.StrikeExceedsMax());

        address vault = _optionVault();
        require(vault != address(0), IAwakening.ZeroOptionVault());
        address loanToken = offer.market.loanToken;
        address collateralToken = offer.market.collateralParams[0].token;

        address payer = offer.buy ? buyer : msg.sender;
        SafeTransferLib.safeTransferFrom(loanToken, payer, address(this), buyerAssets);
        SafeTransferLib.safeApprove(loanToken, vault, buyerAssets);
        IOptionVault(vault).deposit(loanToken, buyerAssets);

        SafeTransferLib.safeTransferFrom(collateralToken, seller, address(this), collateral);

        uint256 settlementFeeAmount = buyerAssets - sellerAssets;
        uint256 deadline = block.timestamp + TWO_STEP_TAKE_WINDOW;

        LoanStorage storage ls = _loanStorage();
        pendingId = bytes32(++ls.pendingNonce);
        ls.pendingTakes[pendingId] = PendingTake({
            id: id,
            offer: offer,
            units: units,
            borrower: seller,
            lender: buyer,
            collateral: collateral,
            escrowed: buyerAssets,
            settlementFee: settlementFeeAmount,
            premiumQuote: 0,
            deadline: deadline
        });

        emit EventsLib.TakeInitiated(
            pendingId, id, seller, buyer, units, collateral, buyerAssets, settlementFeeAmount, deadline
        );
    }

    function completeTake(bytes32 pendingId, uint256 premium, bytes32 tradeId, bytes memory attestation) external {
        require(msg.sender == _optionKeeper(), IAwakening.NotOptionKeeper());
        PendingTake storage pending = _loanStorage().pendingTakes[pendingId];
        require(pending.lender != address(0), IAwakening.PendingTakeNotFound());
        require(block.timestamp <= pending.deadline, IAwakening.PendingTakeExpired());

        CompletedTake memory data;
        data.net = pending.escrowed - pending.settlementFee;
        require(premium <= data.net, IAwakening.PremiumTooHigh());
        data.net -= premium;

        data.id = pending.id;
        data.borrower = pending.borrower;
        data.lender = pending.lender;
        data.units = pending.units;
        data.collateral = pending.collateral;
        data.settlementFee = pending.settlementFee;
        data.maturity = pending.offer.market.maturity;
        data.loanToken = pending.offer.market.loanToken;
        data.strike = data.units.mulDivUp(ORACLE_PRICE_SCALE, data.collateral);
        data.premium = premium;

        OptionTerms memory terms = OptionTerms({
            underlying: pending.offer.market.collateralParams[0].token,
            quoteToken: data.loanToken,
            strike: data.strike,
            notional: data.collateral,
            expiry: data.maturity,
            isPut: true,
            tradeId: tradeId
        });

        delete _loanStorage().pendingTakes[pendingId];

        address pat = _pat();
        require(pat != address(0), IAwakening.ZeroPat());
        data.patTokenId = IPAT(pat).mint(terms, attestation, address(this));

        _finalizeLoan(pendingId, data);
    }

    function _finalizeLoan(bytes32 pendingId, CompletedTake memory data) internal {
        Position storage borrowerPos = _position(data.id, data.borrower);
        Position storage lenderPos = _position(data.id, data.lender);
        uint128 units128 = UtilsLib.toUint128(data.units);
        borrowerPos.debt += units128;
        lenderPos.credit += units128;
        _marketState(data.id).totalUnits = UtilsLib.toUint128(_marketState(data.id).totalUnits + data.units);

        uint128 oldCollateral = borrowerPos.collateral[0];
        borrowerPos.collateral[0] = UtilsLib.toUint128(oldCollateral + data.collateral);
        if (oldCollateral == 0) {
            borrowerPos.collateralBitmap = borrowerPos.collateralBitmap.setBit(0);
            require(
                UtilsLib.countBits(borrowerPos.collateralBitmap) <= MAX_COLLATERALS_PER_BORROWER,
                IAwakening.TooManyActivatedCollaterals()
            );
        }

        _addClaimableSettlementFee(data.loanToken, data.settlementFee);

        LoanStorage storage ls = _loanStorage();
        require(ls.borrowerLoan[data.id][data.borrower] == 0, IAwakening.LoanAlreadyExists());

        ls.loans[pendingId] = Loan({
            id: data.id,
            borrower: data.borrower,
            principal: data.units,
            collateral: data.collateral,
            strike: data.strike,
            premium: data.premium,
            expiry: data.maturity,
            pat: _pat(),
            patTokenId: data.patTokenId,
            lastRepaid: 0,
            claimablePutProceeds: 0
        });
        ls.borrowerLoan[data.id][data.borrower] = pendingId;
        ls.marketLoanIds[data.id].push(pendingId);

        emit EventsLib.TakeCompleted(pendingId, data.premium, _pat(), data.patTokenId);
        emit EventsLib.LoanCreated(
            pendingId, data.id, data.borrower, data.units, data.collateral, data.strike, data.premium, data.maturity, _pat(), data.patTokenId
        );

        address vault = _optionVault();
        IOptionVault(vault).refund(data.loanToken, address(this), data.settlementFee);
        IOptionVault(vault).refund(data.loanToken, _optionKeeper(), data.premium);
        IOptionVault(vault).refund(data.loanToken, data.borrower, data.net);
    }

    function cancelTake(bytes32 pendingId) external {
        PendingTake storage pending = _loanStorage().pendingTakes[pendingId];
        require(pending.lender != address(0), IAwakening.PendingTakeNotFound());
        require(msg.sender == _optionKeeper() || block.timestamp >= pending.deadline, IAwakening.NotOptionKeeper());

        Offer memory offer = pending.offer;
        address borrower = pending.borrower;
        address lender = pending.lender;
        uint256 units = pending.units;
        uint256 collateral = pending.collateral;
        uint256 escrowed = pending.escrowed;
        uint256 settlementFeeAmount = pending.settlementFee;

        delete _loanStorage().pendingTakes[pendingId];

        if (offer.maxAssets > 0) {
            uint256 consumedAmount = offer.buy ? escrowed : escrowed - settlementFeeAmount;
            _setConsumed(offer.maker, offer.group, _consumed(offer.maker, offer.group) - consumedAmount);
        } else {
            _setConsumed(offer.maker, offer.group, _consumed(offer.maker, offer.group) - units);
        }

        address vault = _optionVault();
        IOptionVault(vault).refund(offer.market.loanToken, lender, escrowed);
        SafeTransferLib.safeTransfer(offer.market.collateralParams[0].token, borrower, collateral);

        emit EventsLib.TakeCancelled(pendingId);
    }

    /// SETTLEMENT ///

    function _returnLoanCollateral(bytes32 id, address borrower, uint256 collateral, address receiver) internal {
        Position storage _position = _position(id, borrower);
        _position.collateral[0] = UtilsLib.toUint128(uint256(_position.collateral[0]) - collateral);
        if (_position.collateral[0] == 0) _position.collateralBitmap = _position.collateralBitmap.clearBit(0);
        SafeTransferLib.safeTransfer(IAwakening(address(this)).toMarket(id).collateralParams[0].token, receiver, collateral);
    }

    function repayLoan(bytes32 loanId, uint256 units, address payer) external {
        require(msg.sender == _settlement(), IAwakening.OnlySettlement());
        Loan storage loan = _loanStorage().loans[loanId];
        require(loan.borrower != address(0), IAwakening.LoanNotFound());
        require(units <= loan.principal - loan.lastRepaid, IAwakening.RepayExceedsRemaining());

        address loanToken = IAwakening(address(this)).toMarket(loan.id).loanToken;

        _position(loan.id, loan.borrower).debt -= UtilsLib.toUint128(units);
        _marketState(loan.id).withdrawable += UtilsLib.toUint128(units);
        loan.lastRepaid += units;

        uint256 remaining = loan.principal - loan.lastRepaid;
        emit EventsLib.LoanRepaid(loanId, loan.id, loan.borrower, units, remaining);

        SafeTransferLib.safeTransferFrom(loanToken, payer, address(this), units);

        if (remaining == 0) {
            bytes32 id = loan.id;
            address borrower = loan.borrower;
            uint256 collateral = loan.collateral;
            _returnLoanCollateral(id, borrower, collateral, borrower);

            if (block.timestamp >= loan.expiry) {
                LoanStorage storage ls = _loanStorage();
                ls.borrowerLoan[id][borrower] = 0;
                delete ls.loans[loanId];
            }
        }
    }

    function settleLoan(bytes32 loanId, address collateralReceiver) external {
        require(msg.sender == _settlement(), IAwakening.OnlySettlement());
        Loan storage loan = _loanStorage().loans[loanId];
        require(loan.borrower != address(0), IAwakening.LoanNotFound());

        uint256 remaining = loan.principal - loan.lastRepaid;
        bytes32 id = loan.id;
        address borrower = loan.borrower;
        uint256 collateral = loan.collateral;

        _position(id, borrower).debt -= UtilsLib.toUint128(remaining);
        _marketState(id).withdrawable += UtilsLib.toUint128(remaining);

        LoanStorage storage ls = _loanStorage();
        ls.borrowerLoan[id][borrower] = 0;
        delete ls.loans[loanId];

        _returnLoanCollateral(id, borrower, collateral, collateralReceiver);

        emit EventsLib.LoanSettled(loanId, id, borrower, remaining, collateralReceiver);
    }

    function accrueSettlementFee(address loanToken, uint256 amount) external {
        require(msg.sender == _settlement(), IAwakening.OnlySettlement());
        _addClaimableSettlementFee(loanToken, amount);
    }

    function reportPutResale(bytes32 loanId, uint256 proceeds) external {
        require(msg.sender == _settlement(), IAwakening.OnlySettlement());
        Loan storage loan = _loanStorage().loans[loanId];
        require(loan.borrower != address(0), IAwakening.LoanNotFound());
        require(loan.lastRepaid == loan.principal, IAwakening.LoanNotFullyRepaid());

        loan.claimablePutProceeds += proceeds;
        emit EventsLib.PutResaleReported(loanId, loan.id, proceeds);
    }

    function claimPutProceeds(bytes32 loanId, address receiver) external {
        Loan storage loan = _loanStorage().loans[loanId];
        require(loan.borrower != address(0), IAwakening.LoanNotFound());
        require(msg.sender == loan.borrower, IAwakening.OnlyBorrower());

        uint256 proceeds = loan.claimablePutProceeds;
        require(proceeds > 0, IAwakening.NothingToClaim());

        bytes32 id = loan.id;
        address borrower = loan.borrower;
        address loanToken = IAwakening(address(this)).toMarket(id).loanToken;

        LoanStorage storage ls = _loanStorage();
        ls.borrowerLoan[id][borrower] = 0;
        delete ls.loans[loanId];

        emit EventsLib.PutProceedsClaimed(loanId, id, borrower, receiver, proceeds);
        SafeTransferLib.safeTransfer(loanToken, receiver, proceeds);
    }
}
