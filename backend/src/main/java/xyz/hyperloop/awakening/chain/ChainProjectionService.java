package xyz.hyperloop.awakening.chain;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.web3j.crypto.Hash;
import java.math.BigInteger;
import java.util.*;

/** Reads account balances at exactly the indexed block. No synthetic positions or APR. */
public class ChainProjectionService {
    private final ChainGateway rpc;
    private final ChainReadRepository repo;
    private final DeploymentManifest manifest;
    private final ObjectMapper json=new ObjectMapper();
    public ChainProjectionService(ChainGateway rpc, ChainReadRepository repo, DeploymentManifest manifest) {
        this.rpc=rpc; this.repo=repo; this.manifest=manifest;
    }
    public static String selector(String signature) { return Hash.sha3String(signature).substring(0,10); }
    public static String word(String encoded,int index) {
        if (!encoded.matches("0x(?:[0-9a-fA-F]{64})+") || encoded.length()<2+(index+1)*64)
            throw new IllegalStateException("Malformed contract response");
        return encoded.substring(2+index*64,2+(index+1)*64);
    }
    public static String number(String encoded,int index) { return new BigInteger(word(encoded,index),16).toString(); }
    private long block() {
        var cursor=repo.cursor();
        if(cursor==null) throw new IllegalStateException("Chain index is initializing");
        return cursor.block();
    }
    private ObjectNode envelope(long block) {
        return json.createObjectNode().put("chainId",manifest.chainId()).put("dataSource",manifest.dataSource()).put("observedBlock",block);
    }
    public ObjectNode markets() {
        long block=block();
        var result=envelope(block); var rows=result.putArray("markets");
        for(var configured:manifest.data().path("markets")) {
            String id=configured.path("id").asText();
            String state=rpc.call(manifest.address("Awakening"),selector("marketState(bytes32)")+id.substring(2),block);
            if(new BigInteger(number(state,11)).signum()==0) continue; // not created at this indexed block
            ObjectNode row=configured.deepCopy();
            row.put("totalUnits",number(state,0)); row.put("withdrawable",number(state,1));
            row.put("tickSpacing",number(state,11)); row.put("continuousFee",number(state,10));
            var fees=row.putArray("settlementFeeCbp"); for(int i=3;i<10;i++) fees.add(number(state,i));
            row.put("protectionSource","SIMULATED_TEST_PROTECTION");
            rows.add(row);
        }
        result.set("testAssets",manifest.data().path("testAssets"));
        return result;
    }
    public ObjectNode account(String address) {
        if(!address.matches("0x[0-9a-fA-F]{40}")) throw new IllegalArgumentException("Invalid wallet address");
        address=address.toLowerCase(Locale.ROOT);
        long block=block();
        var result=envelope(block).put("account",address);
        var positions=result.putArray("positions"); var loans=result.putArray("loans");
        var pending=result.putArray("pendingTakes");
        String core=manifest.address("Awakening"), addrWord="0".repeat(24)+address.substring(2);
        Set<String> loanIds=new LinkedHashSet<>(),closedPending=new HashSet<>();
        List<JsonNode> events=new ArrayList<>();
        for(var row:repo.logs()) {
            if(((Number)row.get("block_number")).longValue()>block) continue;
            try { events.add(json.readTree((String)row.get("payload"))); }
            catch(Exception e) { throw new IllegalStateException("Corrupt chain event",e); }
        }
        String loanTopic=Hash.sha3String("LoanCreated(bytes32,bytes32,address,uint256,uint256,uint256,uint256,uint256,address,uint256)");
        String startTopic=Hash.sha3String("TakeInitiated(bytes32,bytes32,address,address,uint256,uint256,uint256,uint256,uint256)");
        String cancelTopic=Hash.sha3String("TakeCancelled(bytes32)");
        String completeTopic=Hash.sha3String("TakeCompleted(bytes32,uint256,address,uint256)");
        for(var event:events) {
            if(!core.equalsIgnoreCase(event.path("address").asText())) continue;
            var topics=event.path("topics"); String topic=topics.path(0).asText();
            if(topic.equals(cancelTopic)||topic.equals(completeTopic)) closedPending.add(topics.path(1).asText());
            if(topic.equals(loanTopic) && topics.path(3).asText().equalsIgnoreCase("0x"+addrWord)) loanIds.add(topics.path(1).asText());
        }
        for(var configured:manifest.data().path("markets")) {
            String id=configured.path("id").asText(), args=id.substring(2)+addrWord;
            String state=rpc.call(core,selector("position(bytes32,address)")+args,block);
            String collateral=rpc.call(core,selector("collateral(bytes32,address,uint256)")+args+"0".repeat(64),block);
            if(new BigInteger(number(state,0)).signum()>0 || new BigInteger(number(state,3)).signum()>0 || new BigInteger(number(collateral,0)).signum()>0) {
                positions.addObject().put("marketId",id).put("credit",number(state,0)).put("pendingFee",number(state,1))
                    .put("lastAccrual",number(state,2)).put("debt",number(state,3)).put("collateral",number(collateral,0));
            }
        }
        for(String id:loanIds) {
            String state=rpc.call(core,selector("loans(bytes32)")+id.substring(2),block);
            loans.addObject().put("loanId",id).put("marketId","0x"+word(state,0)).put("borrower","0x"+word(state,1).substring(24))
                .put("principal",number(state,2)).put("collateral",number(state,3)).put("strike",number(state,4))
                .put("premium",number(state,5)).put("expiry",number(state,6)).put("pat","0x"+word(state,7).substring(24))
                .put("patTokenId",number(state,8)).put("lastRepaid",number(state,9)).put("claimablePutProceeds",number(state,10))
                .put("protectionSource","SIMULATED_TEST_PROTECTION");
        }
        for(var event:events) {
            var topics=event.path("topics");
            if(!core.equalsIgnoreCase(event.path("address").asText()) || !startTopic.equals(topics.path(0).asText()) || closedPending.contains(topics.path(1).asText())) continue;
            String data=event.path("data").asText(), borrower="0x"+topics.path(3).asText().substring(26), lender="0x"+word(data,0).substring(24);
            if(!address.equalsIgnoreCase(borrower)&&!address.equalsIgnoreCase(lender)) continue;
            pending.addObject().put("pendingId",topics.path(1).asText()).put("marketId",topics.path(2).asText())
                .put("borrower",borrower).put("lender",lender).put("units",number(data,1)).put("collateral",number(data,2))
                .put("escrowed",number(data,3)).put("settlementFee",number(data,4)).put("deadline",number(data,5));
        }
        return result;
    }
}
