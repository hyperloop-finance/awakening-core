// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;
import {Script, console2} from "forge-std/Script.sol";
import {Awakening} from "../src/Awakening.sol";
import {Market, CollateralParams} from "../src/interfaces/IAwakening.sol";
import {EcrecoverRatifier} from "../src/ratifiers/EcrecoverRatifier.sol";
import {TestToken} from "../src/testnet/TestToken.sol";
import {TestOracle} from "../src/testnet/TestOracle.sol";

contract BootstrapBscTestnet is Script {
    function run() external {
        require(block.chainid==97,"BSC testnet only");
        Awakening core=Awakening(0x99Cc7186E22F6d717FF7692d7e09F8cEd223f3C9);
        require(core.INITIAL_CHAIN_ID()==97,"Wrong core");
        uint256 maturity=vm.envUint("TEST_MARKET_MATURITY");
        uint256 shortMaturity=vm.envUint("SHORT_MARKET_MATURITY");
        require(shortMaturity>block.timestamp && maturity>shortMaturity,"Expiry");
        vm.startBroadcast();
        EcrecoverRatifier ratifier=new EcrecoverRatifier(address(core));
        TestToken btc=new TestToken("Awakening Test Bitcoin (NO VALUE)","tBTC",8);
        TestToken usdc=new TestToken("Awakening Test USDC (NO VALUE)","tUSDC",6);
        // 60,000 USD/BTC, accounting for 6 vs 8 decimals: 600 * 1e36.
        TestOracle oracle=new TestOracle(msg.sender,600e36);
        CollateralParams[] memory collateral=new CollateralParams[](1);
        collateral[0]=CollateralParams(address(btc),address(oracle));
        Market memory market=Market(address(usdc),collateral,maturity,400e36,5e16,address(0));
        bytes32 normalId=core.touchMarket(market);
        market.maturity=shortMaturity;
        bytes32 shortId=core.touchMarket(market);
        btc.faucet(); usdc.faucet();
        vm.stopBroadcast();
        console2.log("ratifier",address(ratifier)); console2.log("testBTC",address(btc));
        console2.log("testUSDC",address(usdc)); console2.log("testOracle",address(oracle));
        console2.log("normalMarket"); console2.logBytes32(normalId);
        console2.log("shortMarket"); console2.logBytes32(shortId);
    }
}
