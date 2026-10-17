package xyz.hyperloop.awakening.config;

import java.util.Arrays;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
class CorsConfiguration implements WebMvcConfigurer {
	private final AwakeningProperties properties;

	CorsConfiguration(AwakeningProperties properties) {
		this.properties = properties;
	}

	@Override
	public void addCorsMappings(CorsRegistry registry) {
		String[] origins = Arrays.stream(properties.cors().allowedOrigins().split(","))
				.map(String::trim).filter(origin -> !origin.isEmpty()).toArray(String[]::new);
		registry.addMapping("/api/**").allowedOrigins(origins).allowedMethods("GET", "POST", "OPTIONS").allowedHeaders("*");
	}
}
