package dev.collectionsviz.api;

import java.util.*;
import java.util.function.Function;
import dev.collectionsviz.core.CollectionDefinition;
import dev.collectionsviz.core.CollectionRegistry;
import dev.collectionsviz.core.Protocol.*;

/** Backend bindings keep transport encoding separate from domain registration. */
public final class CompactTraceRegistry {
    public static final CompactTraceRegistry STANDARD = new CompactTraceRegistry(List.of(
        new Registration<>(CollectionRegistry.HASH_MAP, CompactTrace::encode),
        new Registration<>(CollectionRegistry.ARRAY_LIST, CompactArrayTrace::encode)));

    public record Registration<S extends Snapshot>(CollectionDefinition<S> definition,
            Function<SessionStore.SessionTrace<S>, ?> encoder) {
        public Registration {
            Objects.requireNonNull(definition);
            Objects.requireNonNull(encoder);
        }

        private Object encode(SessionStore.SessionTrace<?> response) {
            var source = response.trace();
            var snapshotType = definition.snapshotType();
            // Check the heterogeneous transport boundary, including every intermediate frame.
            var steps = source.steps().stream().map(step -> new Step<>(step.index(), step.operation(),
                step.event(), step.stage(), step.message(), step.details(), snapshotType.cast(step.snapshot()))).toList();
            var trace = new Trace<>(source.schemaVersion(), source.collection(), source.operation(), source.result(),
                snapshotType.cast(source.before()), steps, snapshotType.cast(source.committed()));
            return encoder.apply(new SessionStore.SessionTrace<>(response.schemaVersion(), response.sessionId(), response.revision(), trace));
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
    public Object encode(SessionStore.SessionTrace<?> response) {
        var id = response.trace().collection();
        var registration = registrations.get(id);
        if (registration == null) throw new IllegalArgumentException("Unsupported compact collection: " + id);
        return registration.encode(response);
    }
}
