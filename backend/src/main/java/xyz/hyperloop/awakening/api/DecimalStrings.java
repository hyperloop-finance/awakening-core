package xyz.hyperloop.awakening.api;

import java.math.BigDecimal;

import org.springframework.http.HttpStatus;

public final class DecimalStrings {
	public static final int MAX_SCALE = 8;
	public static final BigDecimal MAX_VALUE = new BigDecimal("1000000");

	private DecimalStrings() { }

	public static BigDecimal parse(String value, String field) {
		if (value == null || !value.matches("\\d+(\\.\\d+)?")) {
			throw invalid(field + " must be a plain decimal string without scientific notation.");
		}
		BigDecimal decimal = new BigDecimal(value);
		if (decimal.scale() > MAX_SCALE) {
			throw invalid(field + " must have at most " + MAX_SCALE + " decimal places.");
		}
		if (decimal.compareTo(MAX_VALUE) > 0) {
			throw invalid(field + " must not exceed " + MAX_VALUE.toPlainString() + ".");
		}
		return decimal;
	}

	public static String normalize(BigDecimal value) {
		return value.stripTrailingZeros().toPlainString();
	}

	private static ApiException invalid(String detail) {
		return new ApiException(HttpStatus.BAD_REQUEST, "Validation failed", detail);
	}
}
