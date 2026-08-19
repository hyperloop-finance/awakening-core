// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (c) 2025 Morpho Association
pragma solidity ^0.8.0;

import {Test} from "../lib/forge-std/src/Test.sol";
import {AttestedPAT} from "../src/pat/AttestedPAT.sol";
import {IPAT, OptionTerms} from "../src/interfaces/IPAT.sol";

contract AttestedPATTest is Test {
    AttestedPAT internal pat;
    address internal custodian;
    uint256 internal custodianPk;
    address internal alice;

    function setUp() public {
        (custodian, custodianPk) = makeAddrAndKey("custodian");
        pat = new AttestedPAT(custodian);
        alice = makeAddr("alice");
    }

    function _terms() internal returns (OptionTerms memory) {
        return OptionTerms({
            underlying: makeAddr("btc"),
            quoteToken: makeAddr("usdc"),
            strike: 1e36,
            notional: 1e18,
            expiry: block.timestamp + 100 days,
            isPut: true
        });
    }

    function _attestation(OptionTerms memory terms) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(
                pat.OPTION_TERMS_TYPEHASH(),
                terms.underlying,
                terms.quoteToken,
                terms.strike,
                terms.notional,
                terms.expiry,
                terms.isPut
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", pat.CUSTODIAN_DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(custodianPk, digest);
        return abi.encode(v, r, s);
    }

    function testMintWithValidAttestation() public {
        OptionTerms memory terms = _terms();
        uint256 tokenId = pat.mint(terms, _attestation(terms), alice);

        assertEq(tokenId, 1, "first token id");
        assertEq(pat.ownerOf(tokenId), alice, "owner");

        OptionTerms memory stored = pat.terms(tokenId);
        assertEq(stored.underlying, terms.underlying, "underlying");
        assertEq(stored.quoteToken, terms.quoteToken, "quoteToken");
        assertEq(stored.strike, terms.strike, "strike");
        assertEq(stored.notional, terms.notional, "notional");
        assertEq(stored.expiry, terms.expiry, "expiry");
        assertEq(stored.isPut, terms.isPut, "isPut");
    }

    function testMintWithWrongSigner() public {
        OptionTerms memory terms = _terms();
        (, uint256 wrongPk) = makeAddrAndKey("wrong");
        bytes32 structHash = keccak256(
            abi.encode(
                pat.OPTION_TERMS_TYPEHASH(),
                terms.underlying,
                terms.quoteToken,
                terms.strike,
                terms.notional,
                terms.expiry,
                terms.isPut
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", pat.CUSTODIAN_DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongPk, digest);

        vm.expectRevert(IPAT.InvalidAttestation.selector);
        pat.mint(terms, abi.encode(v, r, s), alice);
    }

    function testMintWithTamperedTerms() public {
        OptionTerms memory terms = _terms();
        bytes memory attestation = _attestation(terms);

        terms.strike = 999; // tamper: no longer matches the signed terms
        vm.expectRevert(IPAT.InvalidAttestation.selector);
        pat.mint(terms, attestation, alice);
    }

    function testAttribute() public {
        OptionTerms memory terms = _terms();
        uint256 tokenId = pat.mint(terms, _attestation(terms), alice);

        address bob = makeAddr("bob");
        vm.prank(alice);
        pat.attribute(tokenId, bob);

        assertEq(pat.ownerOf(tokenId), bob, "new owner");
    }

    function testAttributeOnlyOwner() public {
        OptionTerms memory terms = _terms();
        uint256 tokenId = pat.mint(terms, _attestation(terms), alice);

        vm.prank(makeAddr("notOwner"));
        vm.expectRevert(IPAT.NotOwner.selector);
        pat.attribute(tokenId, makeAddr("bob"));
    }

    function testSettle() public {
        OptionTerms memory terms = _terms();
        uint256 tokenId = pat.mint(terms, _attestation(terms), alice);

        vm.prank(alice);
        pat.settle(tokenId, alice, 100);

        assertEq(pat.payout(tokenId), 100, "payout");
        assertTrue(pat.settled(tokenId), "settled");

        vm.prank(alice);
        vm.expectRevert(IPAT.AlreadySettled.selector);
        pat.settle(tokenId, alice, 200);
    }

    function testSettleOnlyOwner() public {
        OptionTerms memory terms = _terms();
        uint256 tokenId = pat.mint(terms, _attestation(terms), alice);

        vm.prank(makeAddr("notOwner"));
        vm.expectRevert(IPAT.NotOwner.selector);
        pat.settle(tokenId, alice, 100);
    }
}
