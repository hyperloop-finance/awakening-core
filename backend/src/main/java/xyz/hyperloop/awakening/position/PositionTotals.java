package xyz.hyperloop.awakening.position;

public record PositionTotals(String borrowedPrincipal, String lentPrincipal, String collateralLocked,
		String creditFaceValue, String debtOutstanding) {
}
