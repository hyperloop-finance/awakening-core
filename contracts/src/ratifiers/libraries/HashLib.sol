// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (c) 2025 Morpho Association
pragma solidity ^0.8.0;

import {Offer, Market, CollateralParams} from "../../interfaces/IAwakening.sol";

/// @dev keccak256("CollateralParams(address token,address oracle)").
bytes32 constant COLLATERAL_PARAMS_TYPEHASH = 0x0c4f2c279b10d8346c4943fffb51f100eab965e879d825d0f6ee977f53052237;
/// @dev keccak256(bytes.concat(MARKET_TYPE, COLLATERAL_PARAMS_TYPE)).
bytes32 constant MARKET_TYPEHASH = 0x82732e8d16ad47d2257f927cb4b2374a0c6f083117f95e096481e9d615917df0;
/// @dev keccak256(bytes.concat(OFFER_TYPE, COLLATERAL_PARAMS_TYPE, MARKET_TYPE)).
bytes32 constant OFFER_TYPEHASH = 0xf0fe03a0bebd3b83b21a80658db6459d86abcbfb1b2da30c5839d25237bb7191;

library HashLib {
    error LeafIndexOutOfRange();
    error TreeTooHigh();

    /// @dev Returns the EIP-712 typehash of OfferTree(Offer[2]...[2] offerTree) with height levels.
    /// @dev Same as keccak256(bytes.concat("OfferTree(Offer[2]...[2] offerTree)", COLLATERAL_PARAMS_TYPE,
    /// MARKET_TYPE, OFFER_TYPE)).
    /// @dev Reverts if height is greater than 20.
    function offerTreeTypeHash(uint256 height) internal pure returns (bytes32) {
        if (height <= 10) {
            if (height == 0) return 0x0cf4eb833103e1064f5eff067fcd58cf5c5bbb6f91b89e889809e14787e73f1c;
            if (height == 1) return 0x2f92d273e6035b743944a5d066999f54da97f12300ee37c119784d08daad5e62;
            if (height == 2) return 0x66fcc5cda45387f8c243921c8a1d5ad0fbaedce2a10f72f054290cd529eaf5c2;
            if (height == 3) return 0xe0842f7ec02de8f2a2571929d953dfa54edc6363e4f8460e824474ec0f3546dd;
            if (height == 4) return 0xa020fce2fa88dc9c31902ea6028b08fbd89fb293ccb9ea8fd68c3fffdeaec1d4;
            if (height == 5) return 0xedf200246aab5d6e567e659efcad67aaa60cb0442f73f8250bb8bab5c6554ab9;
            if (height == 6) return 0x235d8881404e4599defa00138dab779ea07ec9f15c82a08f0bda4a07c6af90e4;
            if (height == 7) return 0xd3247f80a6fe8904d8cb844894f38ddf77606b773bf9b28d1f79242c4dc39a61;
            if (height == 8) return 0x391e707dcd243a44782d3ae75ffe5ec11261ca231eb962c4b650195e9d7125bb;
            if (height == 9) return 0x1b75c0c19ee40e790d0ca3663ad69e41dd0918b3dcc553ff530858ca0f6b4ffe;
            return 0x52ad7a0be8cbdde5d59d67f9861a968a02675508cb51eb49ab561bdb7945a844;
        } else {
            if (height == 11) return 0x07a120a71c5b0a2b27fb34e57050a3654fdf3f23769b9852360e42bb9c39f18c;
            if (height == 12) return 0x13266a8723b74a3220ec475764d89f9dc2b0404b99d6ceeb11a6b305ad9f6420;
            if (height == 13) return 0x5135f1ec9f02b601e726201aa2feedbafa7c837e0074cee81e472bdd63727a45;
            if (height == 14) return 0xcea8d8861095fe0510cda504f42f9a473449e3204c0f065da06eda5ead68bb5b;
            if (height == 15) return 0x6dcbf5b5e93ecc61ad59fccaecd549f97025da2ccbc3ab4ee1412f86477dee9c;
            if (height == 16) return 0xacb30f314b82918aa108824889d5efd29bef0820b886f00287f1ae815bd27211;
            if (height == 17) return 0x1707316ba99b80b1434553e031b23af1fa0976468e20d8d7fdbe4011397b9496;
            if (height == 18) return 0x3bfec969e3939ecdbe37c3aa19d5784d1340f9875adacd055dc6a8b9198a1245;
            if (height == 19) return 0x385a62e3b66c21a1ba6b9b36c4fdc80ce8b32142289ffc9817aa04ea6fa87353;
            if (height == 20) return 0xa91d94df556a27baa4376a135428f7fbf268b486e1c2df595b2020738913ac2f;
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
            abi.encode(MARKET_TYPEHASH, market.loanToken, collateralParamsHash, market.maturity, market.enterGate)
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
