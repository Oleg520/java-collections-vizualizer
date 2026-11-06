package dev.collectionsviz.api;

import java.time.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import dev.collectionsviz.core.Protocol.*;

class SessionStoreTest {
    static class MutableClock extends Clock {
        long millis;
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return Instant.ofEpochMilli(millis); }
        @Override public long millis() { return millis; }
    }
    @Test void expiresInactiveSessionsAndEnforcesCapacity() {
        var clock=new MutableClock(); var store=new SessionStore(10,1,clock);
        var first=store.create(0); assertEquals(503,assertThrows(SessionStore.ApiException.class,()->store.create(0)).status);
        clock.millis=9000; store.get(first.id()); clock.millis=18000; store.cleanup(); assertNotNull(store.get(first.id()));
        clock.millis=28000; store.cleanup(); assertEquals(404,assertThrows(SessionStore.ApiException.class,()->store.get(first.id())).status);
        assertNotEquals(first.id(),store.create(0).id());
    }
    @Test void simultaneousCommandsCommitExactlyOnce() throws Exception {
        var store=new SessionStore(1800,4,Clock.systemUTC()); var session=store.create(0); var start=new CountDownLatch(1);
        try(var executor=Executors.newFixedThreadPool(2)) {
            Callable<Integer> action=()-> { start.await(); try { store.execute(session.id(),0,new Operation(OperationType.PUT,KeySpec.string("A"),"value")); return 200; } catch(SessionStore.ApiException e) { return e.status; } };
            var a=executor.submit(action); var b=executor.submit(action); start.countDown();
            assertEquals(java.util.Set.of(200,409),java.util.Set.of(a.get(5,TimeUnit.SECONDS),b.get(5,TimeUnit.SECONDS)));
            assertEquals(1,store.get(session.id()).revision()); assertEquals(1,store.get(session.id()).state().size());
        }
    }
}
