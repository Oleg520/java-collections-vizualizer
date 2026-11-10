package dev.collectionsviz.api.config;

import dev.collectionsviz.api.admission.ApiAdmission;
import dev.collectionsviz.api.admission.ClientAddress;
import dev.collectionsviz.api.error.ApiException;
import dev.collectionsviz.api.session.SessionStore;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.*;

class ConfigurationDefaultsTest {
    private final ApplicationContextRunner context = new ApplicationContextRunner()
            .withInitializer(new ConfigDataApplicationContextInitializer())
            .withUserConfiguration(SessionStore.class, ApiAdmission.class, ClientAddress.class);

    @Test
    void applicationYamlPreservesRuntimeDefaultsWithoutJavaFallbacks() {
        context.run(app -> {
            assertNull(app.getStartupFailure());
            assertEquals("false", app.getEnvironment().getProperty("visualizer.allow-full-trace"));
            var sessions = app.getBean(SessionStore.class);
            for (int i = 0; i < 32; i++) assertEquals(1800, sessions.create(0, "client").expiresInSeconds());
            assertEquals("CLIENT_SESSION_LIMIT", assertThrows(ApiException.class,
                    () -> sessions.create(0, "client")).code);
            var admission = app.getBean(ApiAdmission.class);
            for (int i = 0; i < 30; i++) {
                try (var ticket = admission.enter("creation-client", true)) {
                    assertEquals(1, admission.activeWork());
                }
            }
            assertEquals("RATE_LIMITED", assertThrows(ApiAdmission.Limited.class,
                    () -> admission.enter("creation-client", true)).code);
            try (var first = admission.enter("a", false); var second = admission.enter("b", false)) {
                assertEquals("WORK_LIMIT", assertThrows(ApiAdmission.Limited.class,
                        () -> admission.enter("c", false)).code);
            }
            try (var first = admission.enter("a", false)) {
                assertEquals("WORK_LIMIT", assertThrows(ApiAdmission.Limited.class,
                        () -> admission.enter("a", false)).code);
            }
            var request = new MockHttpServletRequest();
            request.setRemoteAddr("127.0.0.1");
            request.addHeader(ClientAddress.HEADER, "203.0.113.7");
            assertEquals("127.0.0.1", app.getBean(ClientAddress.class).resolve(request));
        });
    }

    @Test
    void explicitConfigurationStillOverridesDefaults() {
        context.withPropertyValues("visualizer.session-ttl-seconds=7", "visualizer.max-sessions=8",
                        "visualizer.max-sessions-per-client=2", "visualizer.limits.session-creations=1")
                .run(app -> {
                    assertNull(app.getStartupFailure());
                    var sessions = app.getBean(SessionStore.class);
                    assertEquals(7, sessions.create(0, "client").expiresInSeconds());
                    sessions.create(0, "client");
                    assertEquals("CLIENT_SESSION_LIMIT", assertThrows(ApiException.class,
                            () -> sessions.create(0, "client")).code);
                    var admission = app.getBean(ApiAdmission.class);
                    try (var ticket = admission.enter("client", true)) {
                        assertEquals(1, admission.activeWork());
                    }
                    assertEquals("RATE_LIMITED", assertThrows(ApiAdmission.Limited.class,
                            () -> admission.enter("client", true)).code);
                });
    }
}
