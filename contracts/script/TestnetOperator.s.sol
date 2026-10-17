// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;
import {Script,console2} from "forge-std/Script.sol";
import {Awakening} from "../src/Awakening.sol";
import {PendingTake} from "../src/interfaces/IAwakening.sol";
import {AttestedPAT} from "../src/pat/AttestedPAT.sol";

/// Manual chain-97 operator only. No HTTP endpoint, stored key, or claim of Deribit execution.
/// PENDING_ID / TEST_PREMIUM / TEST_TRADE_ID must be supplied explicitly.
/// Use --interactive --sender <test operator> so vm.sign uses the unlocked in-memory signer.
contract TestnetOperator is Script {
    function run() external {
        require(block.chainid==97,"BSC testnet only");
        Awakening core=Awakening(0x99Cc7186E22F6d717FF7692d7e09F8cEd223f3C9);
        require(core.INITIAL_CHAIN_ID()==97,"Wrong core");
        require(core.optionKeeper()==msg.sender,"Wrong test operator");
        AttestedPAT pat=AttestedPAT(core.pat());
        require(pat.CUSTODIAN()==msg.sender,"Wrong test custodian");
        bytes32 pendingId=vm.envBytes32("PENDING_ID");
        uint256 premium=vm.envUint("TEST_PREMIUM");
        bytes32 tradeId=vm.envBytes32("TEST_TRADE_ID");
        PendingTake memory p=core.pendingTakes(pendingId);
        require(p.lender!=address(0),"Pending take missing");
        require(block.timestamp<=p.deadline,"Pending take expired");
        require(tradeId!=0&&!pat.usedTradeIds(tradeId),"Trade ID invalid or reused");
        require(premium<=p.escrowed-p.settlementFee,"Premium exceeds proceeds");
        uint256 strike=(p.units*1e36+p.collateral-1)/p.collateral;
        bytes32 terms=keccak256(abi.encode(pat.OPTION_TERMS_TYPEHASH(),p.offer.market.collateralParams[0].token,
            p.offer.market.loanToken,strike,p.collateral,p.offer.market.maturity,true,tradeId));
        bytes32 digest=keccak256(abi.encodePacked("\x19\x01",pat.CUSTODIAN_DOMAIN_SEPARATOR(),terms));
        (uint8 v,bytes32 r,bytes32 s)=vm.sign(msg.sender,digest);
        vm.startBroadcast();core.completeTake(pendingId,premium,tradeId,abi.encode(v,r,s));vm.stopBroadcast();
        console2.log("SIMULATED TEST PROTECTION; no external option was purchased");
        console2.logBytes32(pendingId);
    }
}
