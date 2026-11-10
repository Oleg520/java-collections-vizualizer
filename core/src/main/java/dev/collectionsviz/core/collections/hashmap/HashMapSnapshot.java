package dev.collectionsviz.core.collections.hashmap;

import dev.collectionsviz.core.protocol.Snapshot;

import java.util.List;

public record HashMapSnapshot(String phase, int size, int capacity, int threshold, float loadFactor,
                              int pendingCapacity, List<Bucket> buckets,
                              List<Bucket> pendingBuckets) implements Snapshot {
    /**
     * Version shared by this collection's snapshots, traces and session envelopes.
     */
    public static final int SCHEMA_VERSION = 2;
}
