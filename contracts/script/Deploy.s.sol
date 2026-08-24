// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 Morpho Association
pragma solidity ^0.8.0;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {Awakening} from "../src/Awakening.sol";
import {OptionVault} from "../src/vault/OptionVault.sol";
import {AttestedPAT} from "../src/pat/AttestedPAT.sol";
import {AwakeningSettlement} from "../src/settlement/AwakeningSettlement.sol";

/// @dev Deploys the Awakening protocol and wires the roles.
///      The option keeper is the off-chain party that buys the put on Deribit and reports the outcome on-chain.
///      The custodian is the off-chain party that attests to the put purchase with an ECDSA signature.
///
///      Usage:
///        forge script script/Deploy.s.sol:Deploy --rpc-url <RPC_URL> --broadcast
///
///      NOTE: `Awakening` currently exceeds the EIP-170 runtime size limit (~29.4 KB vs 24.6 KB) because it keeps
///      the single-step `take` alongside the two-step borrow flow. It deploys fine on anvil, but before a real
///      testnet/mainnet deployment the contract must be split (extract libraries) or the redundant single-step `take`
///      slimmed down — this is tracked as follow-up work.
///
///      Optional env vars:
///        CUSTODIAN      - the custodian address signing option attestations (default: msg.sender)
///        OPTION_KEEPER  - the option keeper address (default: msg.sender)
///        FEE_SETTER     - the fee setter address (default: msg.sender)
contract Deploy is Script {
    function run()
        public
        returns (Awakening awakening, OptionVault vault, AttestedPAT pat, AwakeningSettlement settlement)
    {
        address custodian = vm.envOr("CUSTODIAN", msg.sender);
        address optionKeeper = vm.envOr("OPTION_KEEPER", msg.sender);
        address feeSetter = vm.envOr("FEE_SETTER", msg.sender);

        vm.startBroadcast();

        awakening = new Awakening();
        vault = new OptionVault(address(awakening));
        pat = new AttestedPAT(custodian);
        settlement = new AwakeningSettlement(address(awakening));

        awakening.setOptionKeeper(optionKeeper);
        awakening.setOptionVault(address(vault));
        awakening.setPat(address(pat));
        awakening.setSettlement(address(settlement));
        awakening.setFeeSetter(feeSetter);

        vm.stopBroadcast();

        console2.log("Awakening          ", address(awakening));
        console2.log("OptionVault        ", address(vault));
        console2.log("AttestedPAT        ", address(pat));
        console2.log("AwakeningSettlement", address(settlement));
        console2.log("optionKeeper       ", optionKeeper);
        console2.log("custodian          ", custodian);
    }
}
