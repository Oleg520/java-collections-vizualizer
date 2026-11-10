package dev.collectionsviz.core.registry;

import dev.collectionsviz.core.protocol.CollectionType;
import dev.collectionsviz.core.collections.hashmap.HashMapEngine;
import dev.collectionsviz.core.collections.hashmap.HashMapSnapshot;
import dev.collectionsviz.core.collections.arraylist.ArrayListEngine;
import dev.collectionsviz.core.collections.arraylist.ArrayListSnapshot;
import dev.collectionsviz.core.engine.CollectionDefinition;

import java.util.*;

/**
 * Immutable, explicit registration of the built-in collection engines.
 */
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
