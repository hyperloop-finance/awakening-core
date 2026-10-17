package xyz.hyperloop.awakening.settlement;

import java.time.Clock;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Stream;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import xyz.hyperloop.awakening.api.ApiException;
import xyz.hyperloop.awakening.position.PositionPayload;
import xyz.hyperloop.awakening.position.PositionService;
import xyz.hyperloop.awakening.position.PositionSummary;

@Service
public class SettlementService {
	private final PositionService positions;
	private final Clock clock;
	private final ConcurrentHashMap<String, Integer> progress = new ConcurrentHashMap<>();

	public SettlementService(PositionService positions, Clock clock) { this.positions = positions; this.clock = clock; }

	public List<SettlementItem> list(String wallet) {
		PositionPayload payload = positions.getPositions(wallet);
		return Stream.concat(payload.borrowPositions().stream(), payload.lendPositions().stream()).map(this::item).toList();
	}

	public SettlementItem act(String positionId, SettlementActionRequest request) {
		if (request == null || request.action() == null) throw invalid("wallet and action are required.");
		PositionSummary position = positions.findOwned(request.wallet(), positionId);
		SettlementItem current = item(position);
		if (!current.availableActions().contains(request.action())) throw new ApiException(HttpStatus.CONFLICT, "Invalid settlement transition", "This simulated action is not currently available.");
		progress.compute(positionId, (key, value) -> value == null ? 1 : value + 1);
		return item(position);
	}

	private SettlementItem item(PositionSummary position) {
		boolean matured = !clock.instant().isBefore(position.maturity());
		int step = progress.getOrDefault(position.id(), 0);
		SettlementPhase phase;
		List<SettlementAction> actions;
		if (!matured) { phase = SettlementPhase.PRE_MATURITY; actions = List.of(); }
		else if ("BORROW".equals(position.side()) && step == 0) { phase = SettlementPhase.REPAYMENT_AVAILABLE; actions = List.of(SettlementAction.SIMULATE_REPAY_DEBT); }
		else if ("BORROW".equals(position.side()) && step == 1) { phase = SettlementPhase.READY_TO_CLAIM; actions = List.of(SettlementAction.SIMULATE_RECOVER_COLLATERAL); }
		else if ("LEND".equals(position.side()) && step == 0) { phase = SettlementPhase.READY_TO_CLAIM; actions = List.of(SettlementAction.SIMULATE_CLAIM_LENDER_PAYOUT); }
		else { phase = SettlementPhase.FINALIZED; actions = List.of(); }
		String debt = "BORROW".equals(position.side()) && step == 0 ? position.debtUnits() : "0";
		String collateral = "BORROW".equals(position.side()) && step < 2 ? position.collateral() : "0";
		String payout = "LEND".equals(position.side()) && step == 0 && matured ? position.faceValue() : "0";
		return new SettlementItem(position.id(), position.marketId(), position.side(), position.maturity(), phase, debt,
				collateral, payout, "0", position.patStatus(), actions, step > 0);
	}

	private ApiException invalid(String detail) { return new ApiException(HttpStatus.BAD_REQUEST, "Validation failed", detail); }
}
