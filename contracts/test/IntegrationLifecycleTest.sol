// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;
import {SettlementTest} from "./SettlementTest.sol";
import {Signature,EIP712_DOMAIN_TYPEHASH} from "../src/ratifiers/interfaces/IEcrecoverRatifier.sol";
import {HashLib} from "../src/ratifiers/libraries/HashLib.sol";
import {Offer} from "../src/interfaces/IAwakening.sol";

/// Exercises the real single-leaf EcrecoverRatifier with the two-step loan lifecycle.
contract IntegrationLifecycleTest is SettlementTest {
    function testSignedLendOfferPartialFullRepayAndClaim() public {
        offer.buy=true; offer.maker=lender; offer.receiverIfMakerIsSeller=lender;
        offer.ratifier=address(ecrecoverRatifier);offer.maxUnits=1000e6;offer.tick=4000;
        bytes32 root=HashLib.hashOffer(offer);
        bytes32 domain=keccak256(abi.encode(EIP712_DOMAIN_TYPEHASH,block.chainid,address(ecrecoverRatifier)));
        bytes32 digest=keccak256(abi.encodePacked("\x19\x01",domain,keccak256(abi.encode(HashLib.offerTreeTypeHash(0),root))));
        (uint8 v,bytes32 r,bytes32 s)=vm.sign(privateKey[lender],digest);
        bytes memory data=abi.encode(Signature(v,r,s),root,uint256(0),new bytes32[](0));
        deal(address(loanToken),lender,1000e6);deal(address(collateralToken1),borrower,2500000);
        vm.prank(borrower);bytes32 loanId=awakening.takeInit(offer,data,1000e6,2500000,borrower);
        assertEq(awakening.debtOf(id,borrower),0,"pending is not a loan");
        bytes32 tradeId=keccak256("SIMULATED_TEST_PROTECTION");
        bytes memory attestation=_attestation(1000e6,2500000,tradeId);
        vm.prank(keeper);awakening.completeTake(loanId,0,tradeId,attestation);
        deal(address(loanToken),borrower,1000e6);
        vm.prank(borrower);settlement.repay(id,250e6);
        assertEq(awakening.debtOf(id,borrower),750e6);
        vm.prank(borrower);settlement.repay(id,750e6);
        assertEq(collateralToken1.balanceOf(borrower),2500000);
        vm.prank(lender);awakening.withdraw(market,1000e6,lender,lender);
        assertEq(awakening.creditOf(id,lender),0);
        deal(address(loanToken),keeper,20e6);
        vm.prank(keeper);loanToken.approve(address(settlement),20e6);
        vm.prank(keeper);settlement.reportPutResale(id,loanId,20e6);
        vm.prank(borrower);awakening.claimPutProceeds(loanId,borrower);
        assertEq(loanToken.balanceOf(borrower),20e6);
    }
}
