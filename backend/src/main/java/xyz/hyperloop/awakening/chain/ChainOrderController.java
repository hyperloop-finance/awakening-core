package xyz.hyperloop.awakening.chain;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.util.function.Supplier;

@RestController
@Profile("bsc-testnet")
@RequestMapping("/api/v1/chain/orders")
public class ChainOrderController {
    private final ChainRuntime runtime;
    private final ChainOrderService orders;
    public ChainOrderController(ChainRuntime runtime,ChainOrderService orders) {this.runtime=runtime;this.orders=orders;}
    private ObjectNode action(Supplier<ObjectNode> supplier) {
        try {runtime.requireReady();return supplier.get();}
        catch(IllegalArgumentException e){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,e.getMessage());}
        catch(RuntimeException e){throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Unable to verify order against BNB Testnet; retry");}
    }
    @GetMapping public ObjectNode list(@RequestParam(required=false) String maker){return action(()->orders.list(maker));}
    @PostMapping public ObjectNode create(@RequestBody JsonNode body){return action(()->orders.create(body));}
    @GetMapping("/{root}/quote") public ObjectNode quote(@PathVariable String root,@RequestParam String units,@RequestParam String collateral,@RequestParam String taker){
        return action(()->orders.quote(root,units,collateral,taker));
    }
}
