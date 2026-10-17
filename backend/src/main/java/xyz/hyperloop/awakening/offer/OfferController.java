package xyz.hyperloop.awakening.offer;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@org.springframework.context.annotation.Profile("!bsc-testnet")
@RequestMapping("/api/v1/offers")
public class OfferController {
	private final OfferService offerService;

	public OfferController(OfferService offerService) {
		this.offerService = offerService;
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public Offer createOffer(@RequestBody SignedOfferRequest request) {
		return offerService.create(request);
	}
}
