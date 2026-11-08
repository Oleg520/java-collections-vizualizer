package dev.collectionsviz.core;

import java.util.*;
import dev.collectionsviz.core.Protocol.*;

/** Immutable, explicit registration of the built-in collection engines. */
public final class CollectionRegistry {
    public static final CollectionDefinition<HashMapSnapshot> HASH_MAP = new CollectionDefinition<>(
        CollectionType.HASH_MAP, HashMapSnapshot.class,
        capacity -> new HashMapEngine(capacity == null ? 0 : capacity), HashMapEngine.SCENARIOS);
    public static final CollectionDefinition<ArrayListSnapshot> ARRAY_LIST = new CollectionDefinition<>(
        CollectionType.ARRAY_LIST, ArrayListSnapshot.class, ArrayListEngine::new, ArrayListEngine.SCENARIOS);
    public static final CollectionRegistry STANDARD = new CollectionRegistry(List.of(HASH_MAP, ARRAY_LIST));

    private final Map<CollectionType, CollectionDefinition<?>> definitions;

    public CollectionRegistry(List<CollectionDefinition<?>> definitions) {
        var entries = new EnumMap<CollectionType, CollectionDefinition<?>>(CollectionType.class);
        for (var definition : definitions) {
            if (entries.putIfAbsent(definition.type(), definition) != null)
                throw new IllegalArgumentException("Duplicate collection: " + definition.type());
        }
        this.definitions = Map.copyOf(entries);
    }

    public CollectionDefinition<?> require(CollectionType type) {
        var definition = type == null ? null : definitions.get(type);
        if (definition == null) throw new IllegalArgumentException("Unsupported collection: " + type);
        return definition;
    }
}
