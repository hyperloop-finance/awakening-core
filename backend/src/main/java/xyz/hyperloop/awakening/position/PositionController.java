package xyz.hyperloop.awakening.position;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@org.springframework.context.annotation.Profile("!bsc-testnet")
@RequestMapping("/api/v1/positions")
public class PositionController {
	private final PositionService positions;
	public PositionController(PositionService positions) { this.positions = positions; }
	@GetMapping("/{wallet}")
	public PositionPayload get(@PathVariable String wallet) { return positions.getPositions(wallet); }
}
