package xyz.hyperloop.awakening.chain;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigInteger;
import java.util.List;

/** Signed-order relay; signatures are revalidated against the ratifier for every quote. */
public class ChainOrderService {
    private final ChainGateway rpc;
    private final ChainReadRepository repo;
    private final OfferTreeVerifier verifier;
    private final DeploymentManifest manifest;
    private final ObjectMapper json=new ObjectMapper();
    public ChainOrderService(ChainGateway rpc,ChainReadRepository repo,OfferTreeVerifier verifier,DeploymentManifest manifest) {
        this.rpc=rpc;this.repo=repo;this.verifier=verifier;this.manifest=manifest;
    }
    public ObjectNode create(JsonNode body) {
        var checked=verifier.verify(body,rpc.blockNumber());
        repo.saveOrder(checked.path("root").asText(),checked.path("offer").path("maker").asText().toLowerCase(java.util.Locale.ROOT),checked.toString());
        return checked;
    }
    public ObjectNode list(String maker) {
        if(maker!=null)OfferCodec.address(maker);
        var result=json.createObjectNode().put("chainId",manifest.chainId()).put("dataSource","SIGNED_ORDER_RELAY");var data=result.putArray("orders");
        for(var row:repo.orders()) {
            JsonNode order=parse((String)row.get("payload"));
            if(maker==null || maker.equalsIgnoreCase(order.path("offer").path("maker").asText())) data.add(order);
            if(data.size()>=100)break;
        }
        // Stored signatures are not assertions of current executability. quote() rechecks chain state.
        return result;
    }
    private JsonNode parse(String value) {
        try {return json.readTree(value);}catch(Exception e){throw new IllegalStateException("Invalid stored order",e);}
    }
    private BigInteger call(String target,String signature,String arguments,long block) {
        return ChainGateway.integer(rpc.call(target,ChainProjectionService.selector(signature)+arguments,block));
    }
    private static void require(boolean ok,String reason){if(!ok)throw new IllegalArgumentException(reason);}
    public ObjectNode quote(String root,String unitsValue,String collateralValue,String taker) {
        OfferCodec.address(taker);OfferCodec.uint(unitsValue);OfferCodec.uint(collateralValue);
        BigInteger units=new BigInteger(unitsValue),collateral=new BigInteger(collateralValue);
        require(units.signum()>0&&units.bitLength()<=128&&collateral.signum()>0,"Invalid take amount");
        var stored=repo.orders().stream().filter(row->root.equalsIgnoreCase((String)row.get("id"))).findFirst()
            .orElseThrow(()->new IllegalArgumentException("Order not found"));
        long block=rpc.blockNumber();
        ObjectNode order=verifier.verify(parse((String)stored.get("payload")),block);
        JsonNode o=order.path("offer"),m=o.path("market");
        String maker=o.path("maker").asText(),core=manifest.address("Awakening"),id=order.path("marketId").asText();
        require(!maker.equalsIgnoreCase(taker),"Cannot take your own order");
        BigInteger consumed=call(core,"consumed(address,bytes32)",OfferCodec.address(maker)+OfferCodec.bytes32(o.path("group").asText()),block);
        require(consumed.add(units).compareTo(new BigInteger(o.path("maxUnits").asText()))<=0,"Order amount already consumed");
        BigInteger maxStrike=new BigInteger(m.path("maxStrike").asText());
        require(units.multiply(BigInteger.TEN.pow(36)).compareTo(collateral.multiply(maxStrike))<=0,"Insufficient collateral");
        int tick=new BigInteger(o.path("tick").asText()).intValueExact();
        String marketState=rpc.call(core,ChainProjectionService.selector("marketState(bytes32)")+OfferCodec.bytes32(id),block);
        int spacing=new BigInteger(ChainProjectionService.number(marketState,11)).intValueExact();
        require(spacing>0&&tick%spacing==0,"Tick is not executable in this market");
        long now=ChainGateway.integer(rpc.request("eth_getBlockByNumber",List.of(ChainGateway.hex(block),false)).path("timestamp").asText()).longValueExact();
        long maturity=new BigInteger(m.path("maturity").asText()).longValueExact();
        require(now<maturity,"Market matured");
        BigInteger fee=call(core,"settlementFee(bytes32,uint256)",OfferCodec.bytes32(id)+OfferCodec.uint(maturity-now),block);
        boolean buy=o.path("buy").asBoolean();
        BigInteger price=TickMath.price(tick),sellerPrice=buy?price.subtract(fee):price;
        require(sellerPrice.signum()>0,"Fee exceeds offer price");
        BigInteger buyerPrice=sellerPrice.add(fee),round=buy?BigInteger.ZERO:TickMath.WAD.subtract(BigInteger.ONE);
        BigInteger buyerAssets=units.multiply(buyerPrice).add(round).divide(TickMath.WAD);
        BigInteger sellerAssets=units.multiply(sellerPrice).add(round).divide(TickMath.WAD);
        String makerToken=buy?m.path("loanToken").asText():m.path("collateralParams").get(0).path("token").asText();
        BigInteger needed=buy?buyerAssets:collateral;
        BigInteger balance=call(makerToken,"balanceOf(address)",OfferCodec.address(maker),block);
        BigInteger allowance=call(makerToken,"allowance(address,address)",OfferCodec.address(maker)+OfferCodec.address(core),block);
        require(balance.compareTo(needed)>=0&&allowance.compareTo(needed)>=0,"Maker balance or approval is insufficient");
        var result=json.createObjectNode().put("chainId",manifest.chainId()).put("dataSource",manifest.dataSource()).put("observedBlock",block)
            .put("taker",taker).put("units",unitsValue).put("collateral",collateralValue).put("buyerAssets",buyerAssets.toString())
            .put("sellerAssetsBeforeProtection",sellerAssets.toString()).put("settlementFee",buyerAssets.subtract(sellerAssets).toString())
            .put("price",price.toString()).put("expiresAt",Long.toString(Math.min(now+30,new BigInteger(o.path("expiry").asText()).longValueExact())))
            .put("protectionSource","SIMULATED_TEST_PROTECTION");
        result.set("order",order);return result;
    }
}
