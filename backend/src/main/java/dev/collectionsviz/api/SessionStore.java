package dev.collectionsviz.api;

import java.time.Clock;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import dev.collectionsviz.core.HashMapEngine;
import dev.collectionsviz.core.Protocol.*;

@Service
public class SessionStore {
    public record SessionState(int schemaVersion, UUID id, String collection, long revision, long expiresInSeconds, HashMapSnapshot state) {}
    public record SessionTrace(int schemaVersion, UUID sessionId, long revision, Trace<HashMapSnapshot> trace) {}
    public static class ApiException extends RuntimeException {
        public final int status;
        public final String code;
        public ApiException(int status, String code, String message) { super(message); this.status=status; this.code=code; }
    }
    private static class Session {
        final UUID id=UUID.randomUUID();
        final HashMapEngine engine;
        long revision, touched;
        Session(int capacity, long now) { engine=new HashMapEngine(capacity); touched=now; }
    }
    private final ConcurrentHashMap<UUID,Session> sessions=new ConcurrentHashMap<>();
    private final long ttlMillis;
    private final int maximum;
    private final Clock clock;
    @Autowired public SessionStore(@Value("${visualizer.session-ttl-seconds:1800}") long ttlSeconds,
                                  @Value("${visualizer.max-sessions:128}") int maximum) {
        this(ttlSeconds,maximum,Clock.systemUTC());
    }
    SessionStore(long ttlSeconds,int maximum,Clock clock) { this.ttlMillis=ttlSeconds*1000; this.maximum=maximum; this.clock=clock; }
    public synchronized SessionState create(int capacity) {
        cleanup();
        if(sessions.size()>=maximum) throw new ApiException(503,"SESSION_LIMIT","Демо занято. Попробуйте позже: достигнут лимит активных сессий.");
        var s=new Session(capacity,clock.millis());
        sessions.put(s.id,s);
        return state(s);
    }
    public SessionState get(UUID id) { return access(id, this::state); }
    public SessionTrace execute(UUID id,long expectedRevision,Operation operation) {
        return mutate(id,expectedRevision,engine -> engine.execute(operation));
    }
    public SessionTrace scenario(UUID id,long expectedRevision,String name) {
        return mutate(id,expectedRevision,engine -> engine.scenario(name));
    }
    private SessionTrace mutate(UUID id,long expectedRevision,Function<HashMapEngine,Trace<HashMapSnapshot>> action) {
        return access(id,s -> {
            if(s.revision!=expectedRevision) throw new ApiException(409,"REVISION_CONFLICT","Состояние изменилось. Текущая версия: " + s.revision + ". Обновите сессию.");
            var trace=action.apply(s.engine);
            s.revision++;
            return new SessionTrace(1,id,s.revision,trace);
        });
    }
    private <T> T access(UUID id,Function<Session,T> action) {
        var s=sessions.get(id);
        if(s==null) throw missing();
        synchronized(s) {
            if(sessions.get(id)!=s || clock.millis()-s.touched>=ttlMillis) {
                sessions.remove(id,s); throw missing();
            }
            s.touched=clock.millis();
            return action.apply(s);
        }
    }
    private SessionState state(Session s) { return new SessionState(1,s.id,"HASH_MAP",s.revision,ttlMillis/1000,s.engine.snapshot()); }
    private ApiException missing() { return new ApiException(404,"SESSION_NOT_FOUND","Сессия не найдена или истекла. Создайте новую сессию."); }
    @Scheduled(fixedDelay=60000)
    public void cleanup() {
        sessions.forEach((id,s) -> { synchronized(s) { if(clock.millis()-s.touched>=ttlMillis) sessions.remove(id,s); } });
    }
}
