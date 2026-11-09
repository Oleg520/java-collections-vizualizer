package dev.collectionsviz.api.observability;

import dev.collectionsviz.api.session.SessionStore;
import dev.collectionsviz.api.admission.ApiAdmission;

import java.util.Map;
import io.micrometer.core.instrument.*;
import org.springframework.stereotype.Component;

/** Only fixed, server-owned dimensions; never use request data as meter tags. */
@Component
public class ApiMetrics {
    private final Map<String,Counter> rejections;
    private record TraceMeters(DistributionSummary bytes,Counter failures) {}
    private final Map<String,TraceMeters> traces;
    private final Counter creations,work;

    public ApiMetrics(MeterRegistry registry,SessionStore sessions,ApiAdmission admission) {
        creations=registry.counter("visualizer.api.admissions","kind","creation");
        work=registry.counter("visualizer.api.admissions","kind","work");
        traces=Map.of(
            "HASH_MAP:compact",traceMeters(registry,"HASH_MAP","compact"),
            "HASH_MAP:full",traceMeters(registry,"HASH_MAP","full"),
            "ARRAY_LIST:compact",traceMeters(registry,"ARRAY_LIST","compact"),
            "ARRAY_LIST:full",traceMeters(registry,"ARRAY_LIST","full"));
        Gauge.builder("visualizer.sessions.active",sessions,SessionStore::storedSessions)
            .description("Occupied session slots; expired entries remain until ordinary cleanup/access")
            .register(registry);
        Gauge.builder("visualizer.work.active",admission,ApiAdmission::activeWork)
            .description("Admitted requests, including response serialization")
            .register(registry);
        rejections=Map.of(
            "RATE_LIMITED",rejection(registry,429,"RATE_LIMITED"),
            "WORK_LIMIT",rejection(registry,429,"WORK_LIMIT"),
            "CLIENT_TRACKING_LIMIT",rejection(registry,429,"CLIENT_TRACKING_LIMIT"),
            "CLIENT_SESSION_LIMIT",rejection(registry,429,"CLIENT_SESSION_LIMIT"),
            "REVISION_CONFLICT",rejection(registry,409,"REVISION_CONFLICT"),
            "SESSION_LIMIT",rejection(registry,503,"SESSION_LIMIT"));
    }
    private Counter rejection(MeterRegistry registry,int status,String code) {
        return Counter.builder("visualizer.api.rejections").tags("status",Integer.toString(status),"code",code)
            .description("Expected protection and revision rejections, by stable API code").register(registry);
    }
    public void rejected(int status,String code) {
        var counter=rejections.get(code);
        if(counter!=null && counter.getId().getTag("status").equals(Integer.toString(status))) counter.increment();
    }
    public void admitted(boolean creation) { (creation?creations:work).increment(); }
    private TraceMeters traceMeters(MeterRegistry registry,String collection,String encoding) {
        var bytes=DistributionSummary.builder("visualizer.trace.response.bytes").baseUnit("bytes")
            .description("Complete trace JSON response bytes before HTTP compression; includes envelope")
            .tags("collection",collection,"encoding",encoding).register(registry);
        return new TraceMeters(bytes,registry.counter("visualizer.trace.write.failures","collection",collection,"encoding",encoding));
    }
    void trace(String collection,String encoding,long bytes,boolean completed) {
        var meters=traces.get(collection+":"+encoding);
        if(meters==null) return;
        if(completed) meters.bytes().record(bytes);
        else meters.failures().increment();
    }
}
