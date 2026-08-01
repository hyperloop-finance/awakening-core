// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (c) 2025 Morpho Association
pragma solidity ^0.8.0;

import {IAwakening, Offer} from "../interfaces/IAwakening.sol";
import {UtilsLib} from "../libraries/UtilsLib.sol";
import {TakeAmountsLib} from "./TakeAmountsLib.sol";

library ConsumableUnitsLib {
    using UtilsLib for uint256;

    /// @dev Returns a number of units such that it fully consumes the offer.
    /// @dev Assumes that `id` matches `offer.market`.
    function consumableUnits(address awakening, bytes32 id, Offer memory offer) internal view returns (uint256) {
        uint256 consumed = IAwakening(awakening).consumed(offer.maker, offer.group);
        if (offer.maxUnits > 0) {
            return offer.maxUnits.zeroFloorSub(consumed);
        } else if (offer.buy) {
            return TakeAmountsLib.buyerAssetsToUnits(awakening, id, offer, offer.maxAssets.zeroFloorSub(consumed));
        } else {
            return TakeAmountsLib.sellerAssetsToUnits(awakening, id, offer, offer.maxAssets.zeroFloorSub(consumed));
        }
    }
}
