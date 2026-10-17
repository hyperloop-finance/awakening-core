// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;
import {Test} from "forge-std/Test.sol";
import {Offer,Market,CollateralParams} from "../src/interfaces/IAwakening.sol";
import {HashLib} from "../src/ratifiers/libraries/HashLib.sol";
import {TickLib} from "../src/libraries/TickLib.sol";
contract IntegrationOfferVectorTest is Test {
    function testSingleLeafFrontendVector() public pure {
        CollateralParams[] memory cp=new CollateralParams[](1);
        cp[0]=CollateralParams(address(0x22),address(0x33));
        Market memory m=Market(address(0x11),cp,1793534400,400e36,5e16,address(0));
        Offer memory offer=Offer(m,true,address(0x44),1790900000,1791000000,4000,bytes32(uint256(1)),address(0),"",address(0x44),address(0x55),false,1000e6,0);
        assertEq(HashLib.hashOffer(offer),0xba59009c7191768c5729d78dfcee90a25d9c5cdc7c93aa3d1e71a114b21964cd);
    }
    function testTickVector() public pure {
        assertEq(TickLib.tickToPrice(2910),500000000000000000);
        assertEq(TickLib.tickToPrice(4000),995664000000000000);
    }
}
