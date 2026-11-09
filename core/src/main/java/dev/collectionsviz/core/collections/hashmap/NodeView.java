package dev.collectionsviz.core.collections.hashmap;

import dev.collectionsviz.core.protocol.command.KeySpec;

public record NodeView(long id, KeySpec key, String value, int rawHashCode, int hash, Long next,
                       Long parent, Long left, Long right, Long prev, Boolean red, boolean linked) {}
