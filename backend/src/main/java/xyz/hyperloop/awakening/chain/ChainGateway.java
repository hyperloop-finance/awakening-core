package xyz.hyperloop.awakening.chain;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.math.BigInteger;
import java.util.*;
import org.web3j.crypto.Hash;

/** Read-only JSON RPC boundary. Never has signing keys or sends transactions. */
public class ChainGateway {
    private final URI uri;
    private final HttpClient client;
    private final ObjectMapper json = new ObjectMapper();
    public ChainGateway(String url) {
        uri = URI.create(url);
        client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4)).build();
    }
    public JsonNode request(String method, Object params) {
        try {
            var body = json.writeValueAsString(Map.of("jsonrpc","2.0","id",1,"method",method,"params",params));
            var req = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(8)).header("Content-Type","application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body)).build();
            var res = client.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() != 200) throw new IllegalStateException("RPC HTTP failure");
            var parsed = json.readTree(res.body());
            if (parsed.has("error")) throw new IllegalStateException("RPC "+method+" error "+parsed.path("error").path("code").asText()+": "+parsed.path("error").path("message").asText());
            if (!parsed.has("result") || parsed.get("result").isNull()) throw new IllegalStateException("RPC result unavailable");
            return parsed.get("result");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt(); throw new IllegalStateException("RPC interrupted",e);
        } catch (Exception e) { throw new IllegalStateException("RPC unavailable ("+e.getClass().getSimpleName()+"): "+e.getMessage(),e); }
    }
    public static String hex(long value) { return "0x" + Long.toHexString(value); }
    public static BigInteger integer(String hex) { return new BigInteger(hex.substring(2),16); }
    public long chainId() { return integer(request("eth_chainId",List.of()).asText()).longValueExact(); }
    public long blockNumber() { return integer(request("eth_blockNumber",List.of()).asText()).longValueExact(); }
    public String code(String address, long block) { return request("eth_getCode",List.of(address,hex(block))).asText(); }
    public String call(String address, String data, long block) {
        return request("eth_call", List.of(Map.of("to",address,"data",data),hex(block))).asText();
    }
    public BigInteger uintCall(String address, String signature, long block) {
        return integer(call(address, Hash.sha3String(signature).substring(0,10), block));
    }
    public String addressCall(String address, String signature, long block) {
        var result = call(address, Hash.sha3String(signature).substring(0,10), block);
        if (!result.matches("0x[0-9a-fA-F]{64}")) throw new IllegalStateException("Malformed address result");
        return "0x" + result.substring(26);
    }
}
