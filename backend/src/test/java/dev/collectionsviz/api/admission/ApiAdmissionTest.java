package dev.collectionsviz.api.admission;

import dev.collectionsviz.api.error.ApiException;
import dev.collectionsviz.api.session.SessionFixtures;
import dev.collectionsviz.api.support.MutableClock;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ApiAdmissionTest {
    @Test
    void independentWindowsRecoverAndBookkeepingIsBounded() {
        var clock = new MutableClock();
        var gate = AdmissionFixtures.admission(10, 1, 2, 2, 2, 1, clock);
        gate.enter("A", true).close();
        var limited = assertThrows(ApiAdmission.Limited.class, () -> gate.enter("A", true));
        assertEquals("RATE_LIMITED", limited.code);
        assertEquals(10, limited.retryAfter);
        gate.enter("A", false).close();
        gate.enter("A", false).close();
        assertThrows(ApiAdmission.Limited.class, () -> gate.enter("A", false));
        gate.enter("B", true).close();
        assertEquals("CLIENT_TRACKING_LIMIT",
                assertThrows(ApiAdmission.Limited.class, () -> gate.enter("C", true)).code);
        assertEquals(2, gate.trackedClients());
        clock.millis = 10000;
        gate.enter("C", true).close();
        gate.enter("A", true).close();
        assertEquals(2, gate.trackedClients());
    }

    @Test
    void globalAndPerClientPermitsAreReleasedExactlyOnceIncludingOldWindows() {
        var clock = new MutableClock();
        var gate = AdmissionFixtures.admission(10, 20, 20, 5, 2, 1, clock);
        var a = gate.enter("A", false);
        assertEquals("WORK_LIMIT", assertThrows(ApiAdmission.Limited.class, () -> gate.enter("A", false)).code);
        var b = gate.enter("B", false);
        assertEquals("WORK_LIMIT", assertThrows(ApiAdmission.Limited.class, () -> gate.enter("C", false)).code);
        clock.millis = 20000;
        assertThrows(ApiAdmission.Limited.class, () -> gate.enter("A", false));
        a.close();
        a.close();
        try (var c = gate.enter("C", false)) {
            assertThrows(ApiAdmission.Limited.class, () -> gate.enter("D", false));
        }
        b.close();
        gate.enter("D", false).close();
    }

    @Test
    void sessionCapReservesRoomForOtherClientsAndExpiresWithoutOwnerLeaks() {
        var clock = new MutableClock();
        var store = SessionFixtures.store(10, 32,
                clock); // Auto per-client cap = 8, including existing MAX_SESSIONS=32 deployments.
        for (int i = 0; i < 8; i++) store.create(0, "A");
        assertEquals("CLIENT_SESSION_LIMIT", assertThrows(ApiException.class, () -> store.create(0, "A")).code);
        assertNotNull(store.create(0, "B"));
        clock.millis = 10000;
        assertNotNull(store.create(0, "A"));
        var strict = SessionFixtures.store(10, 8, 1, clock);
        assertThrows(IllegalArgumentException.class, () -> strict.create(1000000, "C"));
        assertNotNull(strict.create(0, "C"));
        assertEquals(429, assertThrows(ApiException.class, () -> strict.create(0, "C")).status);
    }
}
