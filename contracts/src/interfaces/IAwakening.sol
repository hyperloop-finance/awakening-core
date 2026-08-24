// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (c) 2025 Morpho Association
pragma solidity >=0.5.0;

struct Market {
    address loanToken;
    CollateralParams[] collateralParams;
    uint256 maturity;
    /// @dev Max borrow value per unit collateral (loan-per-collateral, scaled by ORACLE_PRICE_SCALE = 1e36).
    uint256 maxStrike;
    /// @dev Default penalty on defaulted liquidation (WAD); e.g. 5e16 = 5%.
    uint256 penaltyPct;
    address enterGate;
}

struct CollateralParams {
    address token;
    address oracle;
}

struct Offer {
    Market market;
    bool buy;
    address maker;
    uint256 start;
    uint256 expiry;
    uint256 tick;
    bytes32 group;
    address callback;
    bytes callbackData;
    address receiverIfMakerIsSeller;
    address ratifier;
    bool reduceOnly;
    uint256 maxUnits;
    uint256 maxAssets; // buyerAssets if offer.buy else sellerAssets
}

/// @dev Settlement fee cbp values and the continuous fee are 0 until the market is created, then set to the default
/// values.
struct MarketState {
    uint128 totalUnits;
    uint128 withdrawable;
    uint128 continuousFeeCredit;
    uint16 settlementFeeCbp0;
    uint16 settlementFeeCbp1;
    uint16 settlementFeeCbp2;
    uint16 settlementFeeCbp3;
    uint16 settlementFeeCbp4;
    uint16 settlementFeeCbp5;
    uint16 settlementFeeCbp6;
    uint32 continuousFee;
    uint8 tickSpacing;
}

struct Position {
    uint128 credit;
    uint128 pendingFee;
    uint128 lastAccrual;
    uint128 debt;
    uint128 collateralBitmap;
    uint128[128] collateral;
}

/// @dev Escrow record left by phase 1 of a two-step take.
struct PendingTake {
    bytes32 id;
    Offer offer;
    uint256 units;
    address borrower;
    address lender;
    uint256 collateral;
    /// @dev Loan tokens locked in the option vault (= buyerAssets).
    uint256 escrowed;
    /// @dev Settlement fee frozen at phase 1 (buyerAssets - sellerAssets).
    uint256 settlementFee;
    uint256 premiumQuote;
    uint256 deadline;
}

/// @dev A completed loan with its put option attribution.
struct Loan {
    bytes32 id;
    address borrower;
    uint256 principal;
    uint256 collateral;
    uint256 strike;
    uint256 premium;
    uint256 expiry;
    address pat;
    uint256 patTokenId;
    uint256 lastRepaid;
    uint256 claimablePutProceeds;
}

enum SettlementState { PRE_MATURITY, ORACLE_READ, PAT_REDEEMED, REPAY_WINDOW_OPEN, REPAY_WINDOW_CLOSED, FINAL }

interface IAwakening {
    /// ERRORS ///
    error AlreadyConsumed();
    error BuyerGatedFromIncreasingCredit();
    error CannotIncreaseDebtPostMaturity();
    error ConsumedAssets();
    error ConsumedUnits();
    error ContinuousFeeTooHigh();
    error FeeNotMultipleOfFeeCbp();
    error InconsistentInput();
    error InvalidMaxStrike();
    error InvalidPenaltyPct();
    error WrongBuyCallbackReturnValue();
    error WrongSellCallbackReturnValue();
    error WrongRepayCallbackReturnValue();
    error WrongFlashLoanCallbackReturnValue();
    error InvalidCollateralParams();
    error InvalidFeeIndex();
    error InvalidOfferCaps();
    error InvalidTickSpacing();
    error MakerCreditOrDebtIncreased();
    error MaturityTooFar();
    error MarketNotCreated();
    error OfferExpired();
    error OfferNotStarted();
    error OnlyFeeClaimer();
    error OnlyFeeSetter();
    error OnlyRoleSetter();
    error OnlyTickSpacingSetter();
    error NotOptionKeeper();
    error PendingTakeExpired();
    error PendingTakeNotFound();
    error PremiumTooHigh();
    error StrikeExceedsMax();
    error HasOutstandingDebt();
    error ZeroCollateral();
    error ZeroOptionVault();
    error ZeroPat();
    error LoanAlreadyExists();
    error LoanNotFound();
    error LoanNotFullyRepaid();
    error NothingToClaim();
    error OnlyBorrower();
    error OnlySettlement();
    error RepayExceedsRemaining();
    error RatifierFail();
    error RatifierUnauthorized();
    error SelfTake();
    error SellerGatedFromIncreasingDebt();
    error TakerUnauthorized();
    error TickNotAccessible();
    error TooManyActivatedCollaterals();
    error SettlementFeeTooHigh();
    error Unauthorized();
    error UnusedReceiverMustBeZero();

    // forgefmt: disable-start
    /// IMMUTABLES ///
    function INITIAL_CHAIN_ID() external view returns (uint256);

    /// STORAGE GETTERS ///
    function position(bytes32 id, address user) external view returns (uint128 credit, uint128 pendingFee, uint128 lastAccrual, uint128 debt, uint128 collateralBitmap);
    function marketState(bytes32 id) external view returns (uint128 totalUnits, uint128 withdrawable, uint128 continuousFeeCredit, uint16 settlementFeeCbp0, uint16 settlementFeeCbp1, uint16 settlementFeeCbp2, uint16 settlementFeeCbp3, uint16 settlementFeeCbp4, uint16 settlementFeeCbp5, uint16 settlementFeeCbp6, uint32 continuousFee, uint8 tickSpacing);
    function consumed(address user, bytes32 group) external view returns (uint256);
    function isAuthorized(address authorizer, address authorized) external view returns (bool);
    function defaultSettlementFeeCbp(address loanToken, uint256 index) external view returns (uint16);
    function defaultContinuousFee(address loanToken) external view returns (uint32);
    function claimableSettlementFee(address token) external view returns (uint256);
    function roleSetter() external view returns (address);
    function feeSetter() external view returns (address);
    function feeClaimer() external view returns (address);
    function tickSpacingSetter() external view returns (address);
    function optionKeeper() external view returns (address);
    function optionVault() external view returns (address);
    function pat() external view returns (address);
    function settlement() external view returns (address);
    function borrowerLoan(bytes32 id, address borrower) external view returns (bytes32);
    function marketLoanCount(bytes32 id) external view returns (uint256);
    function marketLoanIds(bytes32 id, uint256 index) external view returns (bytes32);
    function pendingTakes(bytes32 pendingId) external view returns (PendingTake memory);
    function loans(bytes32 loanId) external view returns (Loan memory);
    function pendingNonce() external view returns (uint256);

    /// MULTICALL ///
    function multicall(bytes[] memory calls) external;

    /// ADMIN FUNCTIONS ///
    function setRoleSetter(address newRoleSetter) external;
    function setFeeSetter(address newFeeSetter) external;
    function setFeeClaimer(address newFeeClaimer) external;
    function setTickSpacingSetter(address newTickSpacingSetter) external;
    function setOptionKeeper(address newOptionKeeper) external;
    function setOptionVault(address newOptionVault) external;
    function setPat(address newPat) external;
    function setSettlement(address newSettlement) external;
    function setMarketTickSpacing(bytes32 id, uint256 newTickSpacing) external;
    function setMarketSettlementFee(bytes32 id, uint256 index, uint256 newSettlementFee) external;
    function setDefaultSettlementFee(address loanToken, uint256 index, uint256 newSettlementFee) external;
    function setMarketContinuousFee(bytes32 id, uint256 newContinuousFee) external;
    function setDefaultContinuousFee(address loanToken, uint256 newContinuousFee) external;
    function claimSettlementFee(address token, uint256 amount, address receiver) external;
    function claimContinuousFee(Market memory market, uint256 amount, address receiver) external;

    /// ENTRY-POINTS ///
    function take(Offer memory offer, bytes memory ratifierData, uint256 units, address taker, address receiverIfTakerIsSeller, address takerCallback, bytes memory takerCallbackData) external returns (uint256, uint256);
    function takeInit(Offer memory offer, bytes memory ratifierData, uint256 units, uint256 collateral, address taker) external returns (bytes32 pendingId);
    function completeTake(bytes32 pendingId, uint256 premium, bytes32 tradeId, bytes memory attestation) external;
    function cancelTake(bytes32 pendingId) external;
    function repayLoan(bytes32 loanId, uint256 units, address payer) external;
    function settleLoan(bytes32 loanId, address collateralReceiver) external;
    function accrueSettlementFee(address loanToken, uint256 amount) external;
    function reportPutResale(bytes32 loanId, uint256 proceeds) external;
    function claimPutProceeds(bytes32 loanId, address receiver) external;
    function withdraw(Market memory market, uint256 units, address onBehalf, address receiver) external;
    function repay(Market memory market, uint256 units, address onBehalf, address callback, bytes memory data) external;
    function supplyCollateral(Market memory market, uint256 collateralIndex, uint256 assets, address onBehalf) external;
    function withdrawCollateral(Market memory market, uint256 collateralIndex, uint256 assets, address onBehalf, address receiver) external;
    function setConsumed(bytes32 group, uint256 amount, address onBehalf) external;
    function setIsAuthorized(address authorized, bool newIsAuthorized, address onBehalf) external;
    function flashLoan(address[] memory tokens, uint256[] memory assets, address callback, bytes memory data) external;
    function touchMarket(Market memory market) external returns (bytes32);

    /// CONTINUOUS FEE ACCRUAL ///
    function updatePositionView(Market memory market, bytes32 id, address user) external view returns (uint128, uint128, uint128);
    function updatePosition(Market memory market, address user) external returns (uint128, uint128, uint128);

    /// OTHER VIEW FUNCTIONS ///
    function collateralBitmap(bytes32 id, address user) external view returns (uint128);
    function collateral(bytes32 id, address user, uint256 index) external view returns (uint128);
    function toId(Market memory market) external view returns (bytes32);
    function toMarket(bytes32 id) external view returns (Market memory);
    function creditOf(bytes32 id, address user) external view returns (uint128);
    function debtOf(bytes32 id, address user) external view returns (uint128);
    function totalUnits(bytes32 id) external view returns (uint128);
    function tickSpacing(bytes32 id) external view returns (uint8);
    function withdrawable(bytes32 id) external view returns (uint128);
    function settlementFeeCbps(bytes32 id) external view returns (uint16[7] memory);
    function continuousFee(bytes32 id) external view returns (uint32);
    function continuousFeeCredit(bytes32 id) external view returns (uint128);
    function pendingFee(bytes32 id, address user) external view returns (uint128);
    function lastAccrual(bytes32 id, address user) external view returns (uint128);
    function settlementFee(bytes32 id, uint256 timeToMaturity) external view returns (uint256);
    // forgefmt: disable-end
}
