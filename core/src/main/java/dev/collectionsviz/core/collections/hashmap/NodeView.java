package dev.collectionsviz.core.collections.hashmap;

import dev.collectionsviz.core.protocol.command.KeySpec;

/**
 * V2: id tracks a logical entry; objectId and every pointer address physical Java objects.
 */
public record NodeView(long id, long objectId, KeySpec key, String value, int rawHashCode, int hash, Long next,
                       Long parent, Long left, Long right, Long prev, Boolean red, boolean linked) {
}
