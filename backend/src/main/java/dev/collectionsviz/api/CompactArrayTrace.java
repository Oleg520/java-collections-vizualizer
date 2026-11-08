package dev.collectionsviz.api;

import dev.collectionsviz.core.protocol.Step;
import dev.collectionsviz.core.protocol.Trace;
import dev.collectionsviz.core.collections.arraylist.ArrayListSnapshot;
import dev.collectionsviz.core.collections.arraylist.Buffer;
import dev.collectionsviz.core.collections.arraylist.Cell;

import java.util.*;

/** Pools immutable buffer versions and occurrences. Null cell references mean free slots. */
public record CompactArrayTrace(int schemaVersion, UUID sessionId, long revision, String encoding,
                                Trace<Frame> trace, List<BufferRefs> bufferPool, List<Cell> cellPool) implements CompactTraceResponse {
    public record BufferRefs(long id, int capacity, List<Integer> cellRefs) {}
    public record Frame(String collection, String phase, int size, int capacity, String emptyMode,
                        Integer initialCapacity, int bufferRef, Integer pendingBufferRef) {}
    public static CompactArrayTrace encode(SessionStore.SessionTrace<ArrayListSnapshot> response) {
        var encoder = new Encoder();
        var source = response.trace();
        var before = encoder.frame(source.before());
        var steps = source.steps().stream().map(s -> new Step<>(s.index(),s.operation(),s.event(),s.stage(),s.message(),s.details(),encoder.frame(s.snapshot()))).toList();
        var trace = new Trace<>(1,"ARRAY_LIST",source.operation(),source.result(),before,steps,encoder.frame(source.committed()));
        return new CompactArrayTrace(1,response.sessionId(),response.revision(),"array-frames-v1",trace,List.copyOf(encoder.buffers),List.copyOf(encoder.cells.keySet()));
    }
    private static class Encoder {
        final Map<Cell,Integer> cells = new LinkedHashMap<>();
        final Map<Buffer,Integer> indices = new LinkedHashMap<>();
        final List<BufferRefs> buffers = new ArrayList<>();
        int buffer(Buffer buffer) {
            return indices.computeIfAbsent(buffer, b -> {
                var refs = new ArrayList<Integer>();
                for (var cell : b.cells()) refs.add(cell==null ? null : cells.computeIfAbsent(cell,c -> cells.size()));
                buffers.add(new BufferRefs(b.id(),b.capacity(),Collections.unmodifiableList(refs)));
                return buffers.size()-1;
            });
        }
        Frame frame(ArrayListSnapshot s) {
            return new Frame("ARRAY_LIST",s.phase(),s.size(),s.capacity(),s.emptyMode(),s.initialCapacity(),buffer(s.buffer()),s.pendingBuffer()==null?null:buffer(s.pendingBuffer()));
        }
    }
}
