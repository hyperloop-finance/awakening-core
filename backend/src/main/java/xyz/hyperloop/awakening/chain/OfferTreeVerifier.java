package xyz.hyperloop.awakening.chain;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigInteger;
import java.util.List;
import org.web3j.crypto.Hash;

public class OfferTreeVerifier {
    private static final String ZERO="0x"+"0".repeat(40);
    private final ChainGateway rpc;
    private final DeploymentManifest manifest;
    public OfferTreeVerifier(ChainGateway rpc,DeploymentManifest manifest) {this.rpc=rpc;this.manifest=manifest;}
    private static void require(boolean condition,String reason) {if(!condition)throw new IllegalArgumentException(reason);}
    public ObjectNode verify(JsonNode submission,long block) {
        require(submission.isObject() && submission.toString().length()<24000,"Invalid order size");
        require(submission.path("chainId").isIntegralNumber() && submission.path("chainId").asLong()==97,"Wrong order chain");
        require(manifest.address("Awakening").equalsIgnoreCase(submission.path("awakeningAddress").asText()),"Wrong deployment");
        JsonNode o=submission.path("offer");
        require(manifest.address("EcrecoverRatifier").equalsIgnoreCase(o.path("ratifier").asText()),"Wrong ratifier domain");
        require(ZERO.equalsIgnoreCase(o.path("callback").asText()) && "0x".equals(o.path("callbackData").asText()),"Callbacks unsupported");
        require(o.path("reduceOnly").isBoolean()&&!o.path("reduceOnly").asBoolean(),"Reduce-only orders unsupported");
        require(!ZERO.equalsIgnoreCase(o.path("maker").asText()),"Zero maker");
        require(o.path("maker").asText().equalsIgnoreCase(o.path("receiverIfMakerIsSeller").asText()),"Maker must receive its proceeds");
        String marketEncoding=OfferCodec.market(o.path("market")),marketId=null;
        for(var m:manifest.data().path("markets")) if(OfferCodec.market(m.path("market")).equals(marketEncoding))marketId=m.path("id").asText();
        require(marketId!=null,"Unconfigured market");
        String root=OfferCodec.hashOffer(o);
        require(root.equalsIgnoreCase(submission.path("root").asText()),"Offer root mismatch");
        BigInteger units=new BigInteger(o.path("maxUnits").asText()),assets=new BigInteger(o.path("maxAssets").asText());
        require(units.signum()>0 && units.bitLength()<=128 && assets.signum()==0,"Only positive unit-capped orders supported");
        BigInteger tick=new BigInteger(o.path("tick").asText());
        require(tick.signum()>=0 && tick.compareTo(BigInteger.valueOf(5820))<=0,"Invalid tick");
        if(rpc.chainId()!=97)throw new IllegalStateException("Wrong RPC chain");
        var header=rpc.request("eth_getBlockByNumber",List.of(ChainGateway.hex(block),false));
        long now=ChainGateway.integer(header.path("timestamp").asText()).longValueExact();
        long start=new BigInteger(o.path("start").asText()).longValueExact(),expiry=new BigInteger(o.path("expiry").asText()).longValueExact();
        long maturity=new BigInteger(o.path("market").path("maturity").asText()).longValueExact();
        require(start<=now && now<=expiry && expiry<maturity && now<maturity,"Order not active");
        String authorized=rpc.call(manifest.address("Awakening"),ChainProjectionService.selector("isAuthorized(address,address)")
            +OfferCodec.address(o.path("maker").asText())+OfferCodec.address(manifest.address("EcrecoverRatifier")),block);
        require(ChainGateway.integer(authorized).equals(BigInteger.ONE),"Ratifier not authorized by maker");
        String data=OfferCodec.ratifierData(o,submission.path("signature").asText());
        String result=rpc.call(manifest.address("EcrecoverRatifier"),OfferCodec.ratifyCall(o,data),block);
        require(Hash.sha3String("hyperloop.awakening.callbackSuccess").equalsIgnoreCase(result),"Signature not ratified");
        ObjectNode validated=submission.deepCopy();
        validated.put("root",root).put("marketId",marketId).put("ratifierData",data).put("verifiedBlock",block);
        return validated;
    }
}
