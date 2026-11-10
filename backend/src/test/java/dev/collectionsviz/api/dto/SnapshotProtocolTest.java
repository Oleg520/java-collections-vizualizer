package dev.collectionsviz.api.dto;

import dev.collectionsviz.api.error.ApiException;
import dev.collectionsviz.core.protocol.CollectionType;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class SnapshotProtocolTest {
    @Test
    void unspecifiedIsNotAHashMapLegacyProtocol() {
        assertEquals(0, SnapshotProtocol.UNSPECIFIED);
        assertEquals("0", SnapshotProtocol.DEFAULT_REQUEST_VERSION);
        assertEquals(2, SnapshotProtocol.schemaVersion(CollectionType.HASH_MAP));
        assertEquals(1, SnapshotProtocol.schemaVersion(CollectionType.ARRAY_LIST));
        for (int version : new int[]{Integer.MIN_VALUE, -1, 0, 1, 2, 3, Integer.MAX_VALUE}) {
            for (var collection : CollectionType.values()) {
                boolean accepted = collection == CollectionType.HASH_MAP ? version == 2
                        : version == 0 || version == 1 || version == 2;
                if (accepted) assertDoesNotThrow(() -> SnapshotProtocol.require(version, collection.name()));
                else {
                    var error = assertThrows(ApiException.class,
                            () -> SnapshotProtocol.require(version, collection.name()));
                    assertEquals(426, error.status);
                    assertEquals("API_VERSION_MISMATCH", error.code);
                }
            }
        }
    }
}
