package dev.collectionsviz.api.trace;

import dev.collectionsviz.api.dto.SessionTrace;
import dev.collectionsviz.api.trace.hashmap.CompactTrace;
import dev.collectionsviz.api.trace.arraylist.CompactArrayTrace;
import dev.collectionsviz.core.registry.CollectionRegistry;
import dev.collectionsviz.core.protocol.Snapshot;
import dev.collectionsviz.core.protocol.Step;
import dev.collectionsviz.core.protocol.Trace;

import java.util.*;
import com.fasterxml.jackson.databind.json.JsonMapper;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class CompactTraceRegistryTest {
    private final JsonMapper json = new JsonMapper();

    @Test void registeredEncodersPreserveJsonForEveryScenario() throws Exception {
        for (var scenario : CollectionRegistry.HASH_MAP.scenarios()) {
            var source = new SessionTrace<>(1, UUID.randomUUID(), 7,
                CollectionRegistry.HASH_MAP.create(null).scenario(scenario.id()));
            var expected = CompactTrace.encode(source);
            var actual = CompactTraceRegistry.STANDARD.encode(source);
            assertEquals(expected, actual);
            assertEquals(json.writeValueAsString(expected), json.writeValueAsString(actual));
            assertEquals("node-table-v1", ((CompactTrace)actual).encoding());
        }
        for (var scenario : CollectionRegistry.ARRAY_LIST.scenarios()) {
            var source = new SessionTrace<>(1, UUID.randomUUID(), 7,
                CollectionRegistry.ARRAY_LIST.create(null).scenario(scenario.id()));
            var expected = CompactArrayTrace.encode(source);
            var actual = CompactTraceRegistry.STANDARD.encode(source);
            assertEquals(expected, actual);
            assertEquals(json.writeValueAsString(expected), json.writeValueAsString(actual));
            assertEquals("array-frames-v1", ((CompactArrayTrace)actual).encoding());
        }
    }

    @Test void passesValidatedTraceDirectlyToEncoder() {
        var source = new SessionTrace<>(1, UUID.randomUUID(), 7,
            CollectionRegistry.HASH_MAP.create(null).scenario("treeify"));
        var registry = new CompactTraceRegistry(List.of(
            new CompactTraceRegistry.Registration<>(CollectionRegistry.HASH_MAP, response -> {
                assertSame(source, response);
                assertSame(source.trace(), response.trace());
                return response;
            })));
        assertSame(source, registry.encode(source));
    }

    @Test void rejectsDuplicatesMissingEncodersAndUnknownTraceIds() {
        var binding = new CompactTraceRegistry.Registration<>(CollectionRegistry.HASH_MAP, CompactTrace::encode);
        assertThrows(IllegalArgumentException.class, () -> new CompactTraceRegistry(List.of(binding, binding)));
        var source = new SessionTrace<>(1, UUID.randomUUID(), 1,
            CollectionRegistry.ARRAY_LIST.create(null).scenario("growth"));
        assertThrows(IllegalArgumentException.class, () -> new CompactTraceRegistry(List.of(binding)).encode(source));
        var trace = source.trace();
        var unknown = new Trace<>(trace.schemaVersion(), "BOGUS", trace.operation(), trace.result(),
            trace.before(), trace.steps(), trace.committed());
        assertEquals("Unsupported compact collection: BOGUS", assertThrows(IllegalArgumentException.class,
            () -> CompactTraceRegistry.STANDARD.encode(new SessionTrace<>(1, source.sessionId(), 1, unknown))).getMessage());
    }

    @Test void checksAllSnapshotTypesAtTheEncodingBoundary() {
        var trace = CollectionRegistry.ARRAY_LIST.create(null).scenario("growth");
        var map = CollectionRegistry.HASH_MAP.create(null).snapshot();
        assertWrongSnapshots(map, trace.steps(), trace.committed(), trace);
        assertWrongSnapshots(trace.before(), trace.steps(), map, trace);
        var step = trace.steps().getFirst();
        List<Step<Snapshot>> wrongSteps = List.of(new Step<>(step.index(), step.operation(), step.event(),
            step.stage(), step.message(), step.details(), map));
        assertWrongSnapshots(trace.before(), wrongSteps, trace.committed(), trace);
    }

    private void assertWrongSnapshots(Snapshot before, List<? extends Step<? extends Snapshot>> steps,
            Snapshot committed, Trace<?> original) {
        List<Step<Snapshot>> frames = steps.stream().map(step -> new Step<Snapshot>(step.index(), step.operation(),
            step.event(), step.stage(), step.message(), step.details(), step.snapshot())).toList();
        var wrong = new Trace<>(1, "ARRAY_LIST", original.operation(), original.result(), before, frames, committed);
        assertThrows(ClassCastException.class, () -> CompactTraceRegistry.STANDARD.encode(
            new SessionTrace<>(1, UUID.randomUUID(), 1, wrong)));
    }
}
