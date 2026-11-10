package dev.collectionsviz.api.observability;

import dev.collectionsviz.api.error.ApiException;
import dev.collectionsviz.api.admission.ApiAdmission;
import dev.collectionsviz.api.session.SessionFixtures;
import dev.collectionsviz.api.admission.AdmissionFixtures;
import dev.collectionsviz.api.support.MutableClock;

import java.io.IOException;
import java.util.concurrent.*;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.*;

class ApiMetricsTest {
    @Test
    void gaugesFollowSlotLifecycleWithoutTriggeringCleanupAndReleaseExactlyOnce() throws Exception {
        var clock = new MutableClock();
        var store = SessionFixtures.store(10, 4, clock);
        var admission = AdmissionFixtures.admission(10, 20, 20, 4, 2, 1, clock);
        var registry = new SimpleMeterRegistry();
        try {
            new ApiMetrics(registry, store, admission);
            var sessions = registry.get("visualizer.sessions.active").gauge();
            var active = registry.get("visualizer.work.active").gauge();
            assertEquals(0, sessions.value());
            var id = store.create(0).id();
            assertEquals(1, sessions.value());
            var ticket = admission.enter("A", false);
            assertEquals(1, active.value());
            assertThrows(ApiAdmission.Limited.class, () -> admission.enter("A", false));
            assertEquals(1, active.value());
            try (var executor = Executors.newSingleThreadExecutor()) {
                executor.submit(() -> {
                    ticket.close();
                    ticket.close();
                }).get(5, TimeUnit.SECONDS);
            }
            assertEquals(0, active.value());
            clock.millis = 10000;
            assertEquals(1, sessions.value()); // A scrape must not mutate TTL/quota behavior.
            assertThrows(ApiException.class, () -> store.get(id));
            assertEquals(0, sessions.value());
            store.create(0);
            clock.millis = 20000;
            store.cleanup();
            assertEquals(0, sessions.value());
        } finally {
            registry.close();
        }
    }

    @Test
    void rejectionDimensionsAreFixedAndStatusMustMatch() {
        var registry = new SimpleMeterRegistry();
        try {
            var metrics = new ApiMetrics(registry, SessionFixtures.store(10, 4, new MutableClock()),
                    AdmissionFixtures.admission(10, 20, 20, 4, 2, 1, new MutableClock()));
            for (String code : new String[]{"RATE_LIMITED", "WORK_LIMIT", "CLIENT_TRACKING_LIMIT", "CLIENT_SESSION_LIMIT"})
                metrics.rejected(429, code);
            metrics.rejected(409, "REVISION_CONFLICT");
            metrics.rejected(503, "SESSION_LIMIT");
            int count = registry.getMeters().size();
            for (int i = 0; i < 1000; i++) metrics.rejected(429, "untrusted-" + i);
            metrics.rejected(503, "RATE_LIMITED");
            assertEquals(count, registry.getMeters().size());
            assertEquals(6, registry.find("visualizer.api.rejections").counters().size());
            registry.find("visualizer.api.rejections").counters().forEach(c -> assertEquals(1, c.count()));
        } finally {
            registry.close();
        }
    }

    @Test
    void failedTraceDoesNotEnterCompletedSizeSummary() throws Exception {
        var clock = new MutableClock();
        var store = SessionFixtures.store(10, 4, clock);
        var registry = new SimpleMeterRegistry();
        try {
            var metrics = new ApiMetrics(registry, store, AdmissionFixtures.admission(10, 20, 20, 4, 2, 1, clock));
            var filter = new TraceResponseMetrics(metrics);
            var trace = store.scenario(store.create(0).id(), 0, "treeify");
            var request = new org.springframework.mock.web.MockHttpServletRequest("POST",
                    "/api/v1/sessions/test/scenarios/treeify");
            assertThrows(IOException.class,
                    () -> filter.doFilter(request, new MockHttpServletResponse(), (req, res) -> {
                        filter.beforeBodyWrite(trace, null, null, null,
                                new org.springframework.http.server.ServletServerHttpRequest(
                                        (jakarta.servlet.http.HttpServletRequest) req),
                                new org.springframework.http.server.ServletServerHttpResponse(
                                        (jakarta.servlet.http.HttpServletResponse) res));
                        res.getOutputStream().write(new byte[1024]);
                        throw new IOException("disconnected");
                    }));
            assertEquals(1,
                    registry.get("visualizer.trace.write.failures").tags("collection", "HASH_MAP", "encoding", "full")
                            .counter().count());
            assertEquals(0,
                    registry.get("visualizer.trace.response.bytes").tags("collection", "HASH_MAP", "encoding", "full")
                            .summary().count());
        } finally {
            registry.close();
        }
    }

    @Test
    void countingStreamDelegatesImmediatelyIncludingFlushCloseAndFailures() throws Exception {
        var response = new MockHttpServletResponse();
        var counted = new TraceResponseMetrics.CountingResponse(response);
        var stream = counted.getOutputStream();
        assertSame(stream, counted.getOutputStream());
        var large = new byte[3 * 1024 * 1024];
        stream.write(large, 0, large.length);
        stream.write(65);
        assertEquals(large.length + 1, counted.bytes);
        assertEquals(counted.bytes, response.getContentAsByteArray().length);
        var reset = new TraceResponseMetrics.CountingResponse(new MockHttpServletResponse());
        reset.getOutputStream().write(65);
        reset.resetBuffer();
        assertEquals(0, reset.bytes);
        reset.getOutputStream().write(65);
        reset.reset();
        assertEquals(0, reset.bytes);
        stream.write(65);
        stream.flush();
        assertTrue(response.isCommitted());
        stream.close();
        var broken = new TraceResponseMetrics.CountingResponse(new MockHttpServletResponse() {
            @Override
            public jakarta.servlet.ServletOutputStream getOutputStream() {
                return new jakarta.servlet.ServletOutputStream() {
                    @Override
                    public boolean isReady() {
                        return true;
                    }

                    @Override
                    public void setWriteListener(jakarta.servlet.WriteListener listener) {
                    }

                    @Override
                    public void write(int value) throws IOException {
                        throw new IOException("disconnected");
                    }
                };
            }
        });
        assertThrows(IOException.class, () -> broken.getOutputStream().write(1));
        assertEquals(0, broken.bytes);
        assertTrue(broken.failed);
    }
}
