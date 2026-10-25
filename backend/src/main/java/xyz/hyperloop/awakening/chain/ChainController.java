package xyz.hyperloop.awakening.chain;

import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.util.function.Supplier;

@RestController
@Profile({"bsc-testnet","arbitrum-sepolia","robinhood-testnet"})
@RequestMapping("/api/v1/chain")
public class ChainController {
    private final ChainRuntime runtime;
    private final ChainProjectionService projection;
    public ChainController(ChainRuntime runtime,ChainProjectionService projection) { this.runtime=runtime;this.projection=projection; }
    private ObjectNode read(Supplier<ObjectNode> action) {
        try { runtime.requireReady(); return action.get(); }
        catch(IllegalArgumentException e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid request"); }
        catch(RuntimeException e) { throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Chain data unavailable; please retry"); }
    }
    @GetMapping("/markets") public ObjectNode markets() { return read(projection::markets); }
    @GetMapping("/accounts/{wallet}") public ObjectNode account(@PathVariable String wallet) { return read(()->projection.account(wallet)); }
}
