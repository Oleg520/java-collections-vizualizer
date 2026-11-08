package dev.collectionsviz.api;

import dev.collectionsviz.core.protocol.Trace;
import dev.collectionsviz.core.protocol.command.Operation;
import dev.collectionsviz.core.protocol.command.OperationType;
import dev.collectionsviz.core.protocol.command.KeySpec;
import dev.collectionsviz.core.collections.hashmap.HashMapEngine;
import dev.collectionsviz.core.collections.hashmap.HashMapSnapshot;
import dev.collectionsviz.core.collections.hashmap.Bucket;
import dev.collectionsviz.core.collections.hashmap.NodeView;

import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class CompactTraceTest {
    static HashMapSnapshot decode(CompactTrace.Frame frame, List<NodeView> pool) {
        return new HashMapSnapshot(frame.phase(),frame.size(),frame.capacity(),frame.threshold(),frame.loadFactor(),
            frame.pendingCapacity(),decodeBuckets(frame.buckets(),pool),decodeBuckets(frame.pendingBuckets(),pool));
    }
    static List<Bucket> decodeBuckets(List<CompactTrace.BucketRefs> buckets, List<NodeView> pool) {
        return buckets.stream().map(b -> new Bucket(b.index(),b.kind(),b.headId(),b.rootId(),b.nodeRefs().stream().map(pool::get).toList())).toList();
    }
    @Test void encodingIsLosslessForEveryFrameIncludingLargeTreeSplit() throws Exception {
        var engine=new HashMapEngine(64);
        Trace<HashMapSnapshot> source=null;
        for(int i=0;i<97;i++) source=engine.execute(new Operation(OperationType.PUT,
            KeySpec.collision(String.format("%03d",i)+"\0".repeat(61),i%2==0?1:129),"\0".repeat(128)));
        var response=new SessionStore.SessionTrace<>(1,UUID.randomUUID(),97,source);
        var compact=CompactTrace.encode(response);
        assertEquals(source.before(),decode(compact.trace().before(),compact.nodePool()));
        assertEquals(source.committed(),decode(compact.trace().committed(),compact.nodePool()));
        assertEquals(source.steps().size(),compact.trace().steps().size());
        for(int i=0;i<source.steps().size();i++) {
            var expected=source.steps().get(i); var actual=compact.trace().steps().get(i);
            assertEquals(expected.snapshot(),decode(actual.snapshot(),compact.nodePool()));
            assertEquals(expected.event(),actual.event()); assertEquals(expected.details(),actual.details());
            assertEquals(expected.index(),actual.index()); assertEquals(expected.message(),actual.message());
        }
        // Guard the measured worst case; the old full format required ~129 MB.
        int bytes=new ObjectMapper().writeValueAsBytes(compact).length;
        assertTrue(bytes<8*1024*1024,"compact response budget: "+bytes);
        assertTrue(compact.nodePool().size()<5000);
    }
}
