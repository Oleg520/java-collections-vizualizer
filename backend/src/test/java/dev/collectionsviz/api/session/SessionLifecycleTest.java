package dev.collectionsviz.api.session;

import dev.collectionsviz.api.error.ApiException;
import dev.collectionsviz.api.support.MutableClock;
import dev.collectionsviz.core.protocol.CollectionType;
import dev.collectionsviz.core.protocol.command.KeySpec;
import dev.collectionsviz.core.protocol.command.Operation;
import dev.collectionsviz.core.protocol.command.OperationType;
import dev.collectionsviz.core.protocol.command.Element;

import java.util.*;
import java.util.concurrent.*;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class SessionLifecycleTest {
    @Test
    void repeatedSwitchesAndConstructorsUseOneQuotaSlot() {
        var store = SessionFixtures.store(60, 32, 2, new MutableClock());
        var session = store.create(CollectionType.HASH_MAP, null, "a");
        for (int i = 0; i < 100; i++) {
            var collection = i % 2 == 0 ? CollectionType.ARRAY_LIST : CollectionType.HASH_MAP;
            session = store.reset(session.id(), session.revision(), collection, i % 2 == 0 ? 5 : null, "a");
            assertEquals(i + 1, session.revision());
            assertEquals(collection.name(), session.collection());
            assertEquals(0, session.state().size());
        }
        var other = store.create(CollectionType.ARRAY_LIST, 0, "a");
        assertNotEquals(session.id(), other.id());
        assertEquals(429, assertThrows(ApiException.class, () -> store.create(0, "a")).status);
        assertNotNull(store.create(0, "b"));
    }

    @Test
    void resetIsOwnedValidatedAndDoesNotExtendForeignSessionTtl() {
        var clock = new MutableClock();
        var store = SessionFixtures.store(10, 32, 2, clock);
        var s = store.create(CollectionType.ARRAY_LIST, 5, "a");
        store.execute(s.id(), 0, Operation.array(OperationType.ADD, null, Element.of("keep"), null));
        var before = store.get(s.id());
        assertThrows(IllegalArgumentException.class, () -> store.reset(s.id(), 1, CollectionType.ARRAY_LIST, -1, "a"));
        assertEquals(before, store.get(s.id()));
        clock.millis = 9000;
        assertEquals(404, assertThrows(ApiException.class,
                () -> store.reset(s.id(), 1, CollectionType.HASH_MAP, null, "b")).status);
        clock.millis = 10000;
        assertEquals(404, assertThrows(ApiException.class,
                () -> store.reset(s.id(), 1, CollectionType.HASH_MAP, null, "a")).status);
        assertNotNull(store.create(0, "a"));
    }

    @Test
    void competingResetAndCommandCommitOnceAndReplayCannotResetNewState() throws Exception {
        var store = SessionFixtures.store(60, 32, 2, java.time.Clock.systemUTC());
        var s = store.create(0, "a");
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Callable<Integer> reset = () -> {
                start.await();
                try {
                    store.reset(s.id(), 0, CollectionType.ARRAY_LIST, 0, "a");
                    return 200;
                } catch (ApiException e) {
                    return e.status;
                }
            };
            Callable<Integer> command = () -> {
                start.await();
                try {
                    store.execute(s.id(), 0, new Operation(OperationType.PUT, KeySpec.string("A"), "value"));
                    return 200;
                } catch (ApiException e) {
                    return e.status;
                }
            };
            var a = executor.submit(reset);
            var b = executor.submit(command);
            start.countDown();
            assertEquals(Set.of(200, 409), Set.of(a.get(5, TimeUnit.SECONDS), b.get(5, TimeUnit.SECONDS)));
        }
        var before = store.get(s.id());
        assertEquals(409, assertThrows(ApiException.class,
                () -> store.reset(s.id(), 0, CollectionType.ARRAY_LIST, 0, "a")).status);
        assertEquals(before, store.get(s.id()));
        // Switching back also preserves reset constructor semantics and UUID.
        var list = store.reset(s.id(), 1, CollectionType.ARRAY_LIST, 0, "a");
        assertEquals(s.id(), list.id());
        assertEquals(2, list.revision());
        assertEquals(1, store.execute(s.id(), 2, Operation.array(OperationType.ADD, null, Element.of(42), null)).trace()
                .committed().capacity());
    }
}
