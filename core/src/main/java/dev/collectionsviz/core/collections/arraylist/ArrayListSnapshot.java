package dev.collectionsviz.core.collections.arraylist;

import dev.collectionsviz.core.protocol.Snapshot;

public record ArrayListSnapshot(String collection, String phase, int size, int capacity,
                                String emptyMode, Integer initialCapacity, Buffer buffer,
                                Buffer pendingBuffer) implements Snapshot {
    /**
     * Version shared by this collection's snapshots, traces and session envelopes.
     */
    public static final int SCHEMA_VERSION = 1;
}
