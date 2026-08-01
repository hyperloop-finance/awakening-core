// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (c) 2025 Morpho Association
pragma solidity ^0.8.0;

import {IRatifier} from "../../src/interfaces/IRatifier.sol";
import {Offer} from "../../src/interfaces/IAwakening.sol";
import {CALLBACK_SUCCESS} from "../../src/libraries/ConstantsLib.sol";

/// @dev Test-only ratifier that unconditionally accepts every offer.
/// Use this in Awakening integration tests that don't care about ratification details.
contract DummyRatifier is IRatifier {
    function isRatified(Offer memory, bytes memory) external pure returns (bytes32) {
        return CALLBACK_SUCCESS;
    }
}
