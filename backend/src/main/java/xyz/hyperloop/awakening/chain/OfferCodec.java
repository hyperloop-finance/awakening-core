package xyz.hyperloop.awakening.chain;
import com.fasterxml.jackson.databind.JsonNode;
import org.web3j.crypto.Hash;
import java.math.BigInteger;
import java.util.Locale;

/** Canonical encoding of the deployed Market/Offer. Hex helpers return unprefixed ABI words. */
public final class OfferCodec {
    private OfferCodec() {}
    public static String uint(String value) {
        if(value==null || !value.matches("0|[1-9][0-9]{0,77}")) throw new IllegalArgumentException("Invalid uint256");
        var n=new BigInteger(value); if(n.bitLength()>256) throw new IllegalArgumentException("uint256 overflow");
        return "0".repeat(64-n.toString(16).length())+n.toString(16);
    }
    public static String uint(long value) { return uint(Long.toString(value)); }
    public static String address(String value) {
        if(!value.matches("0x[0-9a-fA-F]{40}")) throw new IllegalArgumentException("Invalid address");
        return "0".repeat(24)+value.substring(2).toLowerCase(Locale.ROOT);
    }
    public static String bytes32(String value) {
        if(!value.matches("0x[0-9a-fA-F]{64}")) throw new IllegalArgumentException("Invalid bytes32");
        return value.substring(2).toLowerCase(Locale.ROOT);
    }
    private static String bool(JsonNode value) {
        if(!value.isBoolean())throw new IllegalArgumentException("Invalid boolean");
        return uint(value.asBoolean()?1:0);
    }
    private static String field(JsonNode value,String key) { return value.path(key).asText(); }
    private static String hash(String value) { return Hash.sha3("0x"+value).substring(2); }
    public static String market(JsonNode m) {
        var cp=m.path("collateralParams");
        if(!cp.isArray()||cp.isEmpty()||cp.size()>128)throw new IllegalArgumentException("Invalid collateral parameters");
        StringBuilder tail=new StringBuilder(uint(cp.size()));
        for(var c:cp)tail.append(address(field(c,"token"))).append(address(field(c,"oracle")));
        return address(field(m,"loanToken"))+uint(192)+uint(field(m,"maturity"))+uint(field(m,"maxStrike"))
            +uint(field(m,"penaltyPct"))+address(field(m,"enterGate"))+tail;
    }
    public static String hashMarket(JsonNode m) {
        market(m); // validate all fields before hashing
        StringBuilder cp=new StringBuilder();
        for(var c:m.path("collateralParams")) cp.append(hash("0c4f2c279b10d8346c4943fffb51f100eab965e879d825d0f6ee977f53052237"+address(field(c,"token"))+address(field(c,"oracle"))));
        return hash("d20ff88e618f8d7b28c077e547d16b643d52cecbf8c5377b6ed3efbb986b0dfc"+address(field(m,"loanToken"))+hash(cp.toString())
            +uint(field(m,"maturity"))+uint(field(m,"maxStrike"))+uint(field(m,"penaltyPct"))+address(field(m,"enterGate")));
    }
    private static String bytes(String value) {
        if(!value.matches("0x(?:[0-9a-fA-F]{2}){0,4096}")) throw new IllegalArgumentException("Invalid bytes");
        return value.substring(2).toLowerCase(Locale.ROOT);
    }
    private static String suffix(JsonNode o) {
        return address(field(o,"receiverIfMakerIsSeller"))+address(field(o,"ratifier"))+bool(o.path("reduceOnly"))+uint(field(o,"maxUnits"))+uint(field(o,"maxAssets"));
    }
    private static String middle(JsonNode o) {
        return bool(o.path("buy"))+address(field(o,"maker"))+uint(field(o,"start"))+uint(field(o,"expiry"))+uint(field(o,"tick"))+bytes32(field(o,"group"))+address(field(o,"callback"));
    }
    public static String hashOffer(JsonNode o) {
        return "0x"+hash("fc56d4468f9f9c5f6d59c1a5c946e46df77cbdf82f78d16092ed2dcceba4fbf7"+hashMarket(o.path("market"))+middle(o)+hash(bytes(field(o,"callbackData")))+suffix(o));
    }
    public static String dynamicBytes(String data) {
        String raw=bytes(data); return uint(raw.length()/2)+raw+"0".repeat((64-raw.length()%64)%64);
    }
    public static String offer(JsonNode o) {
        String m=market(o.path("market"));
        return uint(448)+middle(o)+uint(448+m.length()/2)+suffix(o)+m+dynamicBytes(field(o,"callbackData"));
    }
    public static String ratifierData(JsonNode o,String signature) {
        if(!signature.matches("0x[0-9a-fA-F]{130}"))throw new IllegalArgumentException("Expected 65-byte signature");
        int v=Integer.parseInt(signature.substring(130),16);if(v<2)v+=27;
        if(v!=27&&v!=28)throw new IllegalArgumentException("Invalid signature v");
        return "0x"+uint(v)+signature.substring(2,130)+bytes32(hashOffer(o))+uint(0)+uint(192)+uint(0);
    }
    public static String ratifyCall(JsonNode o,String data) {
        String encoded=offer(o);
        return ChainProjectionService.selector("isRatified(((address,(address,address)[],uint256,uint256,uint256,address),bool,address,uint256,uint256,uint256,bytes32,address,bytes,address,address,bool,uint256,uint256),bytes)")
            +uint(64)+uint(64+encoded.length()/2)+encoded+dynamicBytes(data);
    }
}
