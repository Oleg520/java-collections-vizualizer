package dev.collectionsviz.api.trace.hashmap;

import dev.collectionsviz.api.dto.SessionTrace;
import dev.collectionsviz.api.dto.CompactTraceResponse;
import dev.collectionsviz.core.protocol.Step;
import dev.collectionsviz.core.protocol.Trace;
import dev.collectionsviz.core.collections.hashmap.NodeView;
import dev.collectionsviz.core.collections.hashmap.HashMapSnapshot;
import dev.collectionsviz.core.collections.hashmap.Bucket;

import java.util.*;

/** Lossless transport encoding. Events and algorithm snapshots are never recomputed. */
public record CompactTrace(int schemaVersion, UUID sessionId, long revision, String encoding,
                           Trace<Frame> trace, List<NodeView> nodePool) implements CompactTraceResponse {
    public record BucketRefs(int index, String kind, long headId, Long rootId, List<Integer> nodeRefs) {}
    public record Frame(String phase, int size, int capacity, int threshold, float loadFactor,
                        int pendingCapacity, List<BucketRefs> buckets, List<BucketRefs> pendingBuckets) {}

    public static CompactTrace encode(SessionTrace<HashMapSnapshot> response) {
        var encoder = new Encoder();
        var source = response.trace();
        var before = encoder.frame(source.before());
        var steps = source.steps().stream().map(s -> new Step<>(s.index(), s.operation(), s.event(),
            s.stage(), s.message(), s.details(), encoder.frame(s.snapshot()))).toList();
        var trace = new Trace<>(source.schemaVersion(), source.collection(), source.operation(), source.result(),
            before, steps, encoder.frame(source.committed()));
        return new CompactTrace(1, response.sessionId(), response.revision(), "node-table-v1", trace,
            List.copyOf(encoder.nodeIndices.keySet()));
    }
    private static class Encoder {
        final Map<NodeView,Integer> nodeIndices = new LinkedHashMap<>();
        Frame frame(HashMapSnapshot snapshot) {
            return new Frame(snapshot.phase(), snapshot.size(), snapshot.capacity(), snapshot.threshold(),
                snapshot.loadFactor(), snapshot.pendingCapacity(), buckets(snapshot.buckets()), buckets(snapshot.pendingBuckets()));
        }
        List<BucketRefs> buckets(List<Bucket> buckets) {
            return buckets.stream().map(b -> new BucketRefs(b.index(), b.kind(), b.headId(), b.rootId(),
                b.nodes().stream().map(n -> nodeIndices.computeIfAbsent(n, ignored -> nodeIndices.size())).toList())).toList();
        }
    }
}
