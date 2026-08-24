// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (c) 2025 Morpho Association
pragma solidity ^0.8.0;

import {Offer, Market, CollateralParams} from "../../interfaces/IAwakening.sol";

/// @dev keccak256("CollateralParams(address token,address oracle)").
bytes32 constant COLLATERAL_PARAMS_TYPEHASH = 0x0c4f2c279b10d8346c4943fffb51f100eab965e879d825d0f6ee977f53052237;
/// @dev keccak256(bytes.concat(MARKET_TYPE, COLLATERAL_PARAMS_TYPE)).
bytes32 constant MARKET_TYPEHASH = 0xd20ff88e618f8d7b28c077e547d16b643d52cecbf8c5377b6ed3efbb986b0dfc;
/// @dev keccak256(bytes.concat(OFFER_TYPE, COLLATERAL_PARAMS_TYPE, MARKET_TYPE)).
bytes32 constant OFFER_TYPEHASH = 0xfc56d4468f9f9c5f6d59c1a5c946e46df77cbdf82f78d16092ed2dcceba4fbf7;

library HashLib {
    error LeafIndexOutOfRange();
    error TreeTooHigh();

    /// @dev Returns the EIP-712 typehash of OfferTree(Offer[2]...[2] offerTree) with height levels.
    /// @dev Same as keccak256(bytes.concat("OfferTree(Offer[2]...[2] offerTree)", COLLATERAL_PARAMS_TYPE,
    /// MARKET_TYPE, OFFER_TYPE)).
    /// @dev Reverts if height is greater than 20.
    function offerTreeTypeHash(uint256 height) internal pure returns (bytes32) {
        if (height <= 10) {
            if (height == 0) return 0x221cca8da39c5f3292415508771fc00aa95c4b501266eeaed6e95d95db4e34ea;
            if (height == 1) return 0x091a7d2bbbf3e132b02bb002bf26ad764a1df9bb08e085cd573f096ed3f42ac5;
            if (height == 2) return 0xcb9bbfc6b325c48a8d93f0c1595f2ba4ec716835b82aa5ee2993d3b0aee3992d;
            if (height == 3) return 0xaf25aab2f90cea305d7ea1dfce1ebab397c2e3e52a6f13d7f4bd9a049013c277;
            if (height == 4) return 0x7bdaba57ea303e0f7b6efcb80557ea9317e5597f3ddbf12005b9cdd60adeb986;
            if (height == 5) return 0xa7d3b1a94c401df0a97de7c135f61edffb385e14b90118fd30e11f9fd3b14c13;
            if (height == 6) return 0xfb7dfeb2dee6becfb02a8ea0f853df6a0ddb4e6443b9ef02042a18fbc423eb07;
            if (height == 7) return 0x52d67bc755c2d0a9a5aadb2eb1b8a75597c583617c47899bba9e6d6f87abfbd0;
            if (height == 8) return 0x72e738ca024b687dedec7dcbe6304d64e3f58641354185d2183a65ecafb322c5;
            if (height == 9) return 0xc1acc272de3a9db50ffb9922072c45e883a7257b47a3a2a502c3b76a7cc226f6;
            return 0xb2c31a35f373a7377c6c822b703522eca6f183c260fb8d9cb1cd7eb3467c589f;
        } else {
            if (height == 11) return 0xe69fc448ba7fbe5a4c4b7f0dcf3398502d8f8e280e9c4183468b3109bf226a19;
            if (height == 12) return 0x12aa829ab18be623d01f5ab0e2f186d8027a59ad44ab5e108a71e6fd09c0179b;
            if (height == 13) return 0x992c93835372c4f9f933ce4b0debeae437068c923141e2caa446d84240f7c4cd;
            if (height == 14) return 0xc8ea7277af8900834471e78248baae9fcae200b40c04eb5dcb20bd8ea0190d5a;
            if (height == 15) return 0x270af30e1094d52b7a448bb369e02073452e6b7717ca5eb42232d28e32e2377f;
            if (height == 16) return 0x3042dfda0a0d5d6f57b18c71c8f50a3aec7553b4a3a3b8220813c831e699f6dc;
            if (height == 17) return 0x309c51984975919224f39e55a90fd40703f49dc7f403c839270fa08b4cbca512;
            if (height == 18) return 0xa22a12ee8abd0e1ef436d576d7e9953144217cc6682a59d1d64f26b0a3564e3e;
            if (height == 19) return 0x1f89d2a6830ee3d2a1dd558f9914614a6d98948dfcf166a285a0fa764c5c88f7;
            if (height == 20) return 0xfb95c6a49f9a0801511fc867554150f1c0de13e3e355354a8bb5b679305d22c5;
            revert TreeTooHigh();
        }
    }

    /// @dev Verifies a Merkle proof using the leaf index to determine the left/right position of each sibling.
    /// @dev Works for offer-tree heights up to 256, the bit-width of leafIndex.
    function isLeaf(bytes32 root, bytes32 leafHash, uint256 leafIndex, bytes32[] memory proof)
        internal
        pure
        returns (bool)
    {
        require(leafIndex >> proof.length == 0, LeafIndexOutOfRange());
        bytes32 currentHash = leafHash;
        for (uint256 i = 0; i < proof.length; i++) {
            currentHash = (leafIndex >> i) & 1 == 0 ? hashNode(currentHash, proof[i]) : hashNode(proof[i], currentHash);
        }
        return currentHash == root;
    }

    /// @dev Returns the keccak256 hash of the concatenation of left and right.
    function hashNode(bytes32 left, bytes32 right) internal pure returns (bytes32 value) {
        assembly ("memory-safe") {
            mstore(0x00, left)
            mstore(0x20, right)
            value := keccak256(0x00, 0x40)
        }
    }

    /// @dev Computes the EIP-712 hash struct of a CollateralParams.
    function hashCollateralParams(CollateralParams memory collateralParams) internal pure returns (bytes32) {
        return keccak256(abi.encode(COLLATERAL_PARAMS_TYPEHASH, collateralParams.token, collateralParams.oracle));
    }

    /// @dev Computes the EIP-712 hash struct of a Market.
    function hashMarket(Market memory market) internal pure returns (bytes32) {
        bytes32[] memory collateralParamsHashes = new bytes32[](market.collateralParams.length);
        for (uint256 i = 0; i < market.collateralParams.length; i++) {
            collateralParamsHashes[i] = hashCollateralParams(market.collateralParams[i]);
        }

        bytes32 collateralParamsHash;
        // same as keccak256(abi.encodePacked(collateralParamsHashes));
        assembly ("memory-safe") {
            collateralParamsHash := keccak256(
                add(collateralParamsHashes, 0x20),
                mul(mload(collateralParamsHashes), 0x20)
            )
        }

        return keccak256(
            abi.encode(
                MARKET_TYPEHASH,
                market.loanToken,
                collateralParamsHash,
                market.maturity,
                market.maxStrike,
                market.penaltyPct,
                market.enterGate
            )
        );
    }

    /// @dev Computes the EIP-712 hash struct of an Offer.
    function hashOffer(Offer memory offer) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                OFFER_TYPEHASH,
                hashMarket(offer.market),
                offer.buy,
                offer.maker,
                offer.start,
                offer.expiry,
                offer.tick,
                offer.group,
                offer.callback,
                keccak256(offer.callbackData),
                offer.receiverIfMakerIsSeller,
                offer.ratifier,
                offer.reduceOnly,
                offer.maxUnits,
                offer.maxAssets
            )
        );
    }
}
