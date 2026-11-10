package dev.collectionsviz.api.session;

import dev.collectionsviz.api.dto.SessionState;
import dev.collectionsviz.api.dto.SnapshotProtocol;
import dev.collectionsviz.api.dto.SessionTrace;
import dev.collectionsviz.api.error.ApiException;
import dev.collectionsviz.core.engine.CollectionEngine;
import dev.collectionsviz.core.registry.CollectionRegistry;
import dev.collectionsviz.core.protocol.Snapshot;
import dev.collectionsviz.core.protocol.CollectionType;
import dev.collectionsviz.core.protocol.Trace;
import dev.collectionsviz.core.protocol.command.Operation;

import java.time.Clock;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class SessionStore {
    private static class Session {
        final UUID id=UUID.randomUUID();
        CollectionEngine<? extends Snapshot> engine;
        CollectionType collection;
        final String owner;
        long revision, touched;
        Session(CollectionType collection,Integer capacity,long now,String owner) {
            this.collection=collection;
            engine=CollectionRegistry.STANDARD.require(collection).create(capacity);
            touched=now; this.owner=owner;
        }
    }
    private final ConcurrentHashMap<UUID,Session> sessions=new ConcurrentHashMap<>();
    private final long ttlMillis;
    private final int maximum;
    private final int maximumPerClient;
    private final Clock clock;
    @Autowired public SessionStore(@Value("${visualizer.session-ttl-seconds:1800}") long ttlSeconds,
                                  @Value("${visualizer.max-sessions:128}") int maximum,
                                  @Value("${visualizer.max-sessions-per-client:0}") int maximumPerClient) {
        this(ttlSeconds,maximum,maximumPerClient,Clock.systemUTC());
    }
    SessionStore(long ttlSeconds,int maximum,Clock clock) { this(ttlSeconds,maximum,0,clock); }
    SessionStore(long ttlSeconds,int maximum,int maximumPerClient,Clock clock) {
        if(ttlSeconds<1 || ttlSeconds>Integer.MAX_VALUE || maximum<1 || maximumPerClient<0)
            throw new IllegalArgumentException("Invalid session limits");
        this.ttlMillis=ttlSeconds*1000; this.maximum=maximum; this.clock=clock;
        this.maximumPerClient=maximumPerClient==0?Math.min(32,Math.max(1,maximum/4)):maximumPerClient;
    }
    public SessionState create(int capacity) { return create(capacity,"internal"); }
    public SessionState create(int capacity,String owner) { return create(CollectionType.HASH_MAP,capacity,owner); }
    public synchronized SessionState create(CollectionType collection,Integer capacity,String owner) {
        if(collection==null) collection=CollectionType.HASH_MAP;
        if(owner==null) throw new IllegalArgumentException("Client identity required");
        cleanup();
        if(sessions.size()>=maximum) throw new ApiException(503,"SESSION_LIMIT","Демо занято. Попробуйте позже: достигнут лимит активных сессий.");
        if(sessions.values().stream().filter(s -> s.owner.equals(owner)).count()>=maximumPerClient)
            throw new ApiException(429,"CLIENT_SESSION_LIMIT","Достигнут лимит активных сессий клиента. Дождитесь истечения TTL.",
                (int)Math.min(Integer.MAX_VALUE,ttlMillis/1000));
        var s=new Session(collection,capacity,clock.millis(),owner);
        sessions.put(s.id,s);
        return state(s);
    }
    public SessionState get(UUID id) { return access(id,this::state); }
    public SessionState get(UUID id,int version) { return access(id,s -> { SnapshotProtocol.require(version,s.collection.name()); return state(s); }); }
    /** Reconfigure one tab's slot atomically, without allocating another quota entry. */
    public SessionState reset(UUID id,long expectedRevision,CollectionType collection,Integer capacity,String owner) {
        return reset(id,expectedRevision,collection,capacity,owner,2);
    }
    public SessionState reset(UUID id,long expectedRevision,CollectionType collection,Integer capacity,String owner,int version) {
        if(owner==null || collection==null) throw new IllegalArgumentException("Client identity and collection required");
        return access(id,owner,s -> {
            SnapshotProtocol.require(version,s.collection.name());
            SnapshotProtocol.require(version,collection.name());
            if(s.revision!=expectedRevision) throw new ApiException(409,"REVISION_CONFLICT","Состояние изменилось. Обновите сессию.");
            CollectionEngine<? extends Snapshot> replacement=CollectionRegistry.STANDARD.require(collection).create(capacity);
            s.engine=replacement;
            s.collection=collection;
            s.revision++;
            return state(s);
        });
    }
    public SessionTrace<?> execute(UUID id,long expectedRevision,Operation operation) {
        return execute(id,expectedRevision,operation,2);
    }
    public SessionTrace<?> scenario(UUID id,long expectedRevision,String name) {
        return scenario(id,expectedRevision,name,2);
    }
    public SessionTrace<?> execute(UUID id,long revision,Operation operation,int version) {
        return mutate(id,revision,version,engine -> engine.execute(operation));
    }
    public SessionTrace<?> scenario(UUID id,long revision,String name,int version) {
        return mutate(id,revision,version,engine -> engine.scenario(name));
    }
    private SessionTrace<?> mutate(UUID id,long expectedRevision,int version,Function<CollectionEngine<? extends Snapshot>,Trace<? extends Snapshot>> action) {
        return access(id,s -> {
            SnapshotProtocol.require(version,s.collection.name());
            if(s.revision!=expectedRevision) throw new ApiException(409,"REVISION_CONFLICT","Состояние изменилось. Текущая версия: " + s.revision + ". Обновите сессию.");
            var trace=action.apply(s.engine);
            s.revision++;
            return new SessionTrace<>(s.collection==CollectionType.HASH_MAP?2:1,id,s.revision,trace);
        });
    }
    private <T> T access(UUID id,Function<Session,T> action) {
        return access(id,null,action);
    }
    private <T> T access(UUID id,String owner,Function<Session,T> action) {
        var s=sessions.get(id);
        if(s==null) throw missing();
        synchronized(s) {
            if(owner!=null && !s.owner.equals(owner)) throw missing();
            if(sessions.get(id)!=s || clock.millis()-s.touched>=ttlMillis) {
                sessions.remove(id,s); throw missing();
            }
            s.touched=clock.millis();
            return action.apply(s);
        }
    }
    private SessionState state(Session s) { return new SessionState(s.collection==CollectionType.HASH_MAP?2:1,s.id,s.collection.name(),s.revision,ttlMillis/1000,s.engine.snapshot()); }
    private ApiException missing() { return new ApiException(404,"SESSION_NOT_FOUND","Сессия не найдена или истекла. Создайте новую сессию."); }
    // Occupied slots, including expired entries until normal access/cleanup removes them.
    public int storedSessions() { return sessions.size(); }
    @Scheduled(fixedDelay=60000)
    public void cleanup() {
        sessions.forEach((id,s) -> { synchronized(s) { if(clock.millis()-s.touched>=ttlMillis) sessions.remove(id,s); } });
    }
}
