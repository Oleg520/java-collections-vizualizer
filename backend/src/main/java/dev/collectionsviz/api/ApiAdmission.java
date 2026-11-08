package dev.collectionsviz.api;

import java.time.Clock;
import java.util.HashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Bounded, process-local admission; no queues of expensive requests. */
@Component
public class ApiAdmission {
    static final class Limited extends RuntimeException {
        final String code;
        final int retryAfter;
        Limited(String code, int retryAfter) { this.code=code; this.retryAfter=retryAfter; }
    }
    private static final class Client {
        long windowStart, lastSeen;
        int creations, work, active;
        Client(long now) { windowStart=lastSeen=now; }
    }
    private final Map<String,Client> clients=new HashMap<>();
    private final Clock clock;
    private final long windowMillis;
    private final int createLimit, workLimit, trackedLimit, globalLimit, clientLimit;
    private long nextCleanup;
    private int active;

    @Autowired public ApiAdmission(
        @Value("${visualizer.limits.window-seconds:60}") int windowSeconds,
        @Value("${visualizer.limits.session-creations:30}") int createLimit,
        @Value("${visualizer.limits.work-requests:600}") int workLimit,
        @Value("${visualizer.limits.tracked-clients:4096}") int trackedLimit,
        @Value("${visualizer.limits.concurrent-work:2}") int globalLimit,
        @Value("${visualizer.limits.concurrent-work-per-client:1}") int clientLimit) {
        this(windowSeconds,createLimit,workLimit,trackedLimit,globalLimit,clientLimit,Clock.systemUTC());
    }
    ApiAdmission(int windowSeconds,int createLimit,int workLimit,int trackedLimit,int globalLimit,int clientLimit,Clock clock) {
        if(windowSeconds<1 || createLimit<1 || workLimit<1 || trackedLimit<1 || globalLimit<1 || clientLimit<1)
            throw new IllegalArgumentException("API limits must be positive");
        this.windowMillis=windowSeconds*1000L; this.createLimit=createLimit; this.workLimit=workLimit;
        this.trackedLimit=trackedLimit; this.globalLimit=globalLimit; this.clientLimit=clientLimit; this.clock=clock;
    }
    public synchronized Ticket enter(String key,boolean creation) {
        long now=clock.millis();
        if(now>=nextCleanup) {
            clients.values().removeIf(c -> c.active==0 && now-c.lastSeen>=windowMillis);
            nextCleanup=now+windowMillis;
        }
        Client client=clients.get(key);
        if(client==null) {
            if(clients.size()>=trackedLimit) throw new Limited("CLIENT_TRACKING_LIMIT",seconds(nextCleanup-now));
            client=new Client(now); clients.put(key,client);
        }
        client.lastSeen=now;
        if(now-client.windowStart>=windowMillis) {
            client.windowStart=now; client.creations=client.work=0;
        }
        if((creation?client.creations:client.work)>=(creation?createLimit:workLimit))
            throw new Limited("RATE_LIMITED",seconds(client.windowStart+windowMillis-now));
        if(active>=globalLimit || client.active>=clientLimit) throw new Limited("WORK_LIMIT",1);
        if(creation) client.creations++; else client.work++;
        active++; client.active++;
        return new Ticket(client);
    }
    private int seconds(long millis) { return (int)Math.max(1,(millis+999)/1000); }
    public final class Ticket implements AutoCloseable {
        private final Client client;
        private boolean closed;
        Ticket(Client client) { this.client=client; }
        @Override public void close() {
            synchronized(ApiAdmission.this) {
                if(!closed) { closed=true; active--; client.active--; }
            }
        }
    }
    synchronized int activeWork() { return active; }
    synchronized int trackedClients() { return clients.size(); }
}
