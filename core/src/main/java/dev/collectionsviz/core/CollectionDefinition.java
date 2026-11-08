package dev.collectionsviz.core;

import java.util.List;
import java.util.Objects;
import java.util.function.Function;
import dev.collectionsviz.core.Protocol.*;

/** Associates a collection's factory and scenario catalogue with its snapshot type. */
public record CollectionDefinition<S extends Snapshot>(CollectionType type, Class<S> snapshotType,
        Function<Integer, CollectionEngine<S>> factory, List<Scenario> scenarios) {
    public CollectionDefinition {
        Objects.requireNonNull(type);
        Objects.requireNonNull(snapshotType);
        Objects.requireNonNull(factory);
        scenarios = List.copyOf(scenarios);
    }

    public CollectionEngine<S> create(Integer capacity) { return factory.apply(capacity); }
}
