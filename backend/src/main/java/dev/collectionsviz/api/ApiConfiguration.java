package dev.collectionsviz.api;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Bean;
import org.springframework.web.servlet.config.annotation.*;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import com.fasterxml.jackson.core.StreamReadConstraints;

@Configuration
public class ApiConfiguration implements WebMvcConfigurer {
    private final String[] origins;
    public ApiConfiguration(@Value("${visualizer.allowed-origins}") String[] origins) { this.origins=origins; }
    @Override public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**").allowedOrigins(origins).allowedMethods("GET","POST","OPTIONS")
            .allowedHeaders("Content-Type").maxAge(3600);
    }
    @Bean Jackson2ObjectMapperBuilderCustomizer jsonLimits() {
        return builder -> builder.featuresToDisable(com.fasterxml.jackson.databind.DeserializationFeature.ACCEPT_FLOAT_AS_INT).postConfigurer(mapper -> mapper.getFactory().setStreamReadConstraints(
            StreamReadConstraints.builder().maxNestingDepth(12).maxStringLength(4096).maxDocumentLength(32768).build()));
    }
}
