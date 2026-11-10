package dev.collectionsviz.core.registry;

import dev.collectionsviz.core.protocol.CollectionType;
import dev.collectionsviz.core.protocol.command.Operation;
import dev.collectionsviz.core.protocol.command.OperationType;
import dev.collectionsviz.core.protocol.command.Element;
import dev.collectionsviz.core.collections.hashmap.HashMapEngine;
import dev.collectionsviz.core.collections.arraylist.ArrayListEngine;
import dev.collectionsviz.core.engine.CollectionDefinition;

import java.util.List;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class CollectionRegistryTest {
    @Test
    void registersBothFactoriesAndImmutableScenarioCatalogues() {
        var registry = CollectionRegistry.STANDARD;
        assertSame(CollectionRegistry.HASH_MAP, registry.require(CollectionType.HASH_MAP));
        assertSame(CollectionRegistry.ARRAY_LIST, registry.require(CollectionType.ARRAY_LIST));
        assertEquals(HashMapEngine.SCENARIOS, registry.require(CollectionType.HASH_MAP).scenarios());
        assertEquals(ArrayListEngine.SCENARIOS, registry.require(CollectionType.ARRAY_LIST).scenarios());
        assertThrows(UnsupportedOperationException.class, () -> CollectionRegistry.HASH_MAP.scenarios().clear());
        for (var type : CollectionType.values()) {
            var definition = registry.require(type);
            for (var scenario : definition.scenarios()) {
                var trace = definition.create(null).scenario(scenario.id());
                assertEquals(type.name(), trace.collection());
                assertInstanceOf(definition.snapshotType(), trace.before());
                assertInstanceOf(definition.snapshotType(), trace.committed());
                trace.steps().forEach(step -> assertInstanceOf(definition.snapshotType(), step.snapshot()));
            }
        }
    }

    @Test
    void preservesConstructorSemanticsAndIndependentEngines() {
        var maps = CollectionRegistry.HASH_MAP;
        assertEquals(new HashMapEngine().snapshot(), maps.create(null).snapshot());
        for (int capacity : List.of(0, 16, 32, 64))
            assertEquals(new HashMapEngine(capacity).snapshot(), maps.create(capacity).snapshot());
        var lists = CollectionRegistry.ARRAY_LIST;
        assertEquals("DEFAULT_EMPTY", lists.create(null).snapshot().emptyMode());
        assertEquals("EXPLICIT_EMPTY", lists.create(0).snapshot().emptyMode());
        for (int capacity : List.of(0, 1, 16, 256))
            assertEquals(new ArrayListEngine(capacity).snapshot(), lists.create(capacity).snapshot());
        assertThrows(IllegalArgumentException.class, () -> maps.create(1));
        assertThrows(IllegalArgumentException.class, () -> lists.create(257));
        var first = lists.create(null);
        var second = lists.create(null);
        first.execute(Operation.array(OperationType.ADD, null, Element.of("A"), null));
        assertEquals(0, second.snapshot().size());
    }

    @Test
    void rejectsDuplicateAndUnsupportedTypesAndCopiesRegistration() {
        assertThrows(IllegalArgumentException.class, () -> new CollectionRegistry(
                List.of(CollectionRegistry.HASH_MAP, CollectionRegistry.HASH_MAP)));
        var entries = new java.util.ArrayList<CollectionDefinition<?>>();
        entries.add(CollectionRegistry.HASH_MAP);
        var registry = new CollectionRegistry(entries);
        entries.clear();
        assertNotNull(registry.require(CollectionType.HASH_MAP));
        assertEquals("Unsupported collection: ARRAY_LIST", assertThrows(IllegalArgumentException.class,
                () -> registry.require(CollectionType.ARRAY_LIST)).getMessage());
        assertThrows(IllegalArgumentException.class, () -> registry.require(null));
    }
}
