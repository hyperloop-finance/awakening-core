package xyz.hyperloop.awakening.api;

import org.springframework.http.HttpStatus;

public final class ApiException extends RuntimeException {
	private final HttpStatus status;
	private final String title;

	public ApiException(HttpStatus status, String title, String detail) {
		super(detail);
		this.status = status;
		this.title = title;
	}

	public HttpStatus status() {
		return status;
	}

	public String title() {
		return title;
	}
}
