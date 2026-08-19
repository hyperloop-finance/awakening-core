// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (c) 2025 Morpho Association
pragma solidity 0.8.34;

import {IPAT, OptionTerms} from "../interfaces/IPAT.sol";

/// @dev A put-attribution token minted only against an ECDSA attestation from a custodian. The custodian signs the
/// option terms off-chain after the option keeper buys the corresponding put on Deribit, proving the put exists and
/// matches the signed terms.
contract AttestedPAT is IPAT {
    bytes32 public constant OPTION_TERMS_TYPEHASH =
        keccak256("OptionTerms(address underlying,address quoteToken,uint256 strike,uint256 notional,uint256 expiry,bool isPut)");

    address public immutable CUSTODIAN;
    bytes32 public immutable CUSTODIAN_DOMAIN_SEPARATOR;

    mapping(uint256 tokenId => OptionTerms) internal _terms;
    mapping(uint256 tokenId => address) public ownerOf;
    mapping(uint256 tokenId => uint256) public payout;
    mapping(uint256 tokenId => bool) public settled;
    uint256 public totalSupply;

    event Minted(uint256 indexed tokenId, address indexed to, OptionTerms terms);
    event Attributed(uint256 indexed tokenId, address indexed oldOwner, address indexed newOwner);
    event Settled(uint256 indexed tokenId, address indexed to, uint256 payout);

    constructor(address custodian) {
        CUSTODIAN = custodian;
        CUSTODIAN_DOMAIN_SEPARATOR =
            keccak256(abi.encode(keccak256("Awakening.AttestedPAT"), block.chainid, address(this)));
    }

    /// @dev Mints a PAT to `to`, gated by the custodian's ECDSA attestation over the exact `terms`.
    function mint(OptionTerms memory terms, bytes memory attestation, address to) external returns (uint256 tokenId) {
        require(_isValidAttestation(terms, attestation), InvalidAttestation());

        tokenId = ++totalSupply;
        _terms[tokenId] = terms;
        ownerOf[tokenId] = to;

        emit Minted(tokenId, to, terms);
    }

    function terms(uint256 tokenId) external view returns (OptionTerms memory) {
        return _terms[tokenId];
    }

    function attribute(uint256 tokenId, address newOwner) external {
        require(msg.sender == ownerOf[tokenId], NotOwner());
        address oldOwner = ownerOf[tokenId];
        ownerOf[tokenId] = newOwner;

        emit Attributed(tokenId, oldOwner, newOwner);
    }

    function settle(uint256 tokenId, address to, uint256 _payout) external {
        require(msg.sender == ownerOf[tokenId], NotOwner());
        require(!settled[tokenId], AlreadySettled());
        settled[tokenId] = true;
        payout[tokenId] = _payout;

        emit Settled(tokenId, to, _payout);
    }

    /// @dev Recovers the attestation signer over `terms` and checks it equals the custodian.
    function _isValidAttestation(OptionTerms memory terms, bytes memory attestation) internal view returns (bool) {
        (uint8 v, bytes32 r, bytes32 s) = abi.decode(attestation, (uint8, bytes32, bytes32));
        bytes32 structHash = keccak256(
            abi.encode(
                OPTION_TERMS_TYPEHASH,
                terms.underlying,
                terms.quoteToken,
                terms.strike,
                terms.notional,
                terms.expiry,
                terms.isPut
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", CUSTODIAN_DOMAIN_SEPARATOR, structHash));
        return ecrecover(digest, v, r, s) == CUSTODIAN;
    }
}
