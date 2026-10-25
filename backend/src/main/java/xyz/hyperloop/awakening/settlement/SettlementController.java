package xyz.hyperloop.awakening.settlement;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@org.springframework.context.annotation.Profile("!bsc-testnet & !arbitrum-sepolia & !robinhood-testnet")
@RequestMapping("/api/v1/settlements")
public class SettlementController {
	private final SettlementService settlements;
	public SettlementController(SettlementService settlements) { this.settlements = settlements; }
	@GetMapping("/{wallet}") public List<SettlementItem> list(@PathVariable String wallet) { return settlements.list(wallet); }
	@PostMapping("/{positionId}/actions") public SettlementItem act(@PathVariable String positionId, @RequestBody SettlementActionRequest request) { return settlements.act(positionId, request); }
}
