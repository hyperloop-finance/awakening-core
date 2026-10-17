package xyz.hyperloop.awakening.portfolio;

import java.util.List;
import org.springframework.stereotype.Service;
import xyz.hyperloop.awakening.position.PositionPayload;
import xyz.hyperloop.awakening.position.PositionService;

@Service
public class PortfolioService {
	private final PositionService positions;

	public PortfolioService(PositionService positions) {
		this.positions = positions;
	}

	public Portfolio getPortfolio(String wallet) {
		PositionPayload payload = positions.getPositions(wallet);
		List<Position> borrow = payload.borrowPositions().stream().map(item -> new Position(item.id(), item.marketId(), item.side(), item.principal(), item.collateral(), item.maturity(), item.settlementState())).toList();
		List<Position> lend = payload.lendPositions().stream().map(item -> new Position(item.id(), item.marketId(), item.side(), item.principal(), item.collateral(), item.maturity(), item.settlementState())).toList();
		return new Portfolio(payload.wallet(), new PortfolioTotals(payload.totals().borrowedPrincipal(), payload.totals().lentPrincipal(), payload.totals().collateralLocked()),
				borrow, lend, new PortfolioMeta(payload.profile(), payload.asOf(), payload.source()));
	}
}
