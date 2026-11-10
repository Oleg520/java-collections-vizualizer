package dev.collectionsviz.api.dto;

import dev.collectionsviz.api.error.ApiException;
import dev.collectionsviz.core.collections.hashmap.HashMapSnapshot;
import dev.collectionsviz.core.collections.arraylist.ArrayListSnapshot;
import dev.collectionsviz.core.protocol.CollectionType;

/**
 * Required on HashMap writes/reads. Old open tabs must reload before any mutation.
 */
public final class SnapshotProtocol {
    /**
     * Missing/empty query parameter: no protocol negotiated, never a HashMap legacy mode.
     */
    public static final int UNSPECIFIED = 0;
    public static final String DEFAULT_REQUEST_VERSION = "" + UNSPECIFIED;

    private SnapshotProtocol() {
    }

    public static int schemaVersion(CollectionType collection) {
        return switch (collection) {
            case HASH_MAP -> HashMapSnapshot.SCHEMA_VERSION;
            case ARRAY_LIST -> ArrayListSnapshot.SCHEMA_VERSION;
        };
    }

    public static void require(int version, String collection) {
        // ArrayList retains its existing 0/1/2 acceptance; it does not enable HashMap V1.
        boolean hashMap = collection.equals(CollectionType.HASH_MAP.name());
        if ((hashMap && version != HashMapSnapshot.SCHEMA_VERSION) ||
                (!hashMap && version != UNSPECIFIED && version != ArrayListSnapshot.SCHEMA_VERSION &&
                        version != HashMapSnapshot.SCHEMA_VERSION))
            throw new ApiException(426, "API_VERSION_MISMATCH",
                    "Версия HashMap API несовместима. Обновите страницу после обновления backend. Команда не выполнена.");
    }
}
