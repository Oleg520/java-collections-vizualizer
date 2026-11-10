package dev.collectionsviz.api.web;

import dev.collectionsviz.api.admission.ClientAddress;
import dev.collectionsviz.api.observability.ApiMetrics;
import dev.collectionsviz.api.session.SessionFixtures;
import dev.collectionsviz.api.admission.AdmissionFixtures;
import dev.collectionsviz.api.support.MutableClock;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.*;

import static org.junit.jupiter.api.Assertions.*;

class ApiLimitFilterTest {
    @Test
    void permitCoversResponseWritingAndIsReleasedOnSerializationFailure() throws Exception {
        for (boolean fail : new boolean[]{false, true}) {
            var admission = AdmissionFixtures.admission(60, 20, 20, 10, 1, 1, new MutableClock());
            var mapper = new ObjectMapper();
            var filter = new ApiLimitFilter(admission, new ClientAddress(""), mapper,
                    new String[]{"http://localhost:5173"},
                    new ApiMetrics(new io.micrometer.core.instrument.simple.SimpleMeterRegistry(),
                            SessionFixtures.store(60, 4, new MutableClock()), admission));
            var writing = new CountDownLatch(1);
            var finish = new CountDownLatch(1);
            try (var executor = Executors.newSingleThreadExecutor()) {
                var first = executor.submit(() -> {
                    try {
                        filter.doFilter(request("198.51.100.1"), new MockHttpServletResponse(), (req, res) -> {
                            // Simulates MVC's response writer after a command has returned its result.
                            mapper.writeValue(res.getOutputStream(), Map.of("revision", 1));
                            writing.countDown();
                            try {
                                if (!finish.await(5, TimeUnit.SECONDS)) throw new IOException("test timeout");
                            } catch (InterruptedException e) {
                                Thread.currentThread().interrupt();
                                throw new IOException(e);
                            }
                            if (fail) throw new IOException("serialization disconnected");
                        });
                        return true;
                    } catch (IOException expected) {
                        return false;
                    }
                });
                try {
                    assertTrue(writing.await(5, TimeUnit.SECONDS));
                    var rejected = new MockHttpServletResponse();
                    filter.doFilter(request("198.51.100.2"), rejected,
                            (req, res) -> fail("Must not execute while response is being written"));
                    assertEquals(429, rejected.getStatus());
                } finally {
                    finish.countDown();
                }
                assertEquals(!fail, first.get(5, TimeUnit.SECONDS));
                var response = new MockHttpServletResponse();
                filter.doFilter(request("198.51.100.2"), response, (req, res) -> res.getWriter().write("admitted"));
                assertEquals("admitted", response.getContentAsString());
            }
        }
    }

    private MockHttpServletRequest request(String ip) {
        var request = new MockHttpServletRequest("POST", "/api/v1/sessions/id/commands");
        request.setRemoteAddr(ip);
        return request;
    }
}
