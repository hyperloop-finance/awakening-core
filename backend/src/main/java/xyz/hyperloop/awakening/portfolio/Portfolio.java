package xyz.hyperloop.awakening.portfolio;

import java.util.List;

public record Portfolio(String wallet, PortfolioTotals totals, List<Position> borrowPositions, List<Position> lendPositions, PortfolioMeta meta) { }
