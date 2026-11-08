package dev.collectionsviz.api.trace;

import dev.collectionsviz.api.dto.SessionTrace;
import dev.collectionsviz.api.trace.hashmap.CompactTrace;
import dev.collectionsviz.api.trace.arraylist.CompactArrayTrace;
import dev.collectionsviz.core.engine.CollectionDefinition;
import dev.collectionsviz.core.registry.CollectionRegistry;
import dev.collectionsviz.core.protocol.Snapshot;

import java.util.*;
import java.util.function.Function;

/** Backend bindings keep transport encoding separate from domain registration. */
public final class CompactTraceRegistry {
    public static final CompactTraceRegistry STANDARD = new CompactTraceRegistry(List.of(
        new Registration<>(CollectionRegistry.HASH_MAP, CompactTrace::encode),
        new Registration<>(CollectionRegistry.ARRAY_LIST, CompactArrayTrace::encode)));

    public record Registration<S extends Snapshot>(CollectionDefinition<S> definition,
            Function<SessionTrace<S>, ?> encoder) {
        public Registration {
            Objects.requireNonNull(definition);
            Objects.requireNonNull(encoder);
        }

        @SuppressWarnings("unchecked")
        private Object encode(SessionTrace<?> response) {
            var trace = response.trace();
            var snapshotType = definition.snapshotType();
            // Validate the heterogeneous boundary before passing through the original trace.
            snapshotType.cast(trace.before());
            for (var step : trace.steps()) snapshotType.cast(step.snapshot());
            snapshotType.cast(trace.committed());
            return encoder.apply((SessionTrace<S>) response);
        }
    }

    private final Map<String, Registration<?>> registrations;

    public CompactTraceRegistry(List<Registration<?>> registrations) {
        var entries = new HashMap<String, Registration<?>>();
        for (var registration : registrations) {
            var id = registration.definition().type().name();
            if (entries.putIfAbsent(id, registration) != null)
                throw new IllegalArgumentException("Duplicate compact encoder: " + id);
        }
        this.registrations = Map.copyOf(entries);
    }

    public static boolean requested(String encoding) {
        if (!encoding.equals("full") && !encoding.equals("compact"))
            throw new IllegalArgumentException("encoding: full или compact");
        return encoding.equals("compact");
    }
    public Object encode(SessionTrace<?> response) {
        var id = response.trace().collection();
        var registration = registrations.get(id);
        if (registration == null) throw new IllegalArgumentException("Unsupported compact collection: " + id);
        return registration.encode(response);
    }
}
