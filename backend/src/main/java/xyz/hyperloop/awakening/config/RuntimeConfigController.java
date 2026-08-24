package xyz.hyperloop.awakening.config;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/config")
public class RuntimeConfigController {
	private final RuntimeConfigService runtimeConfigService;

	public RuntimeConfigController(RuntimeConfigService runtimeConfigService) {
		this.runtimeConfigService = runtimeConfigService;
	}

	@GetMapping
	public RuntimeConfig getConfig() {
		return runtimeConfigService.getConfig();
	}
}
