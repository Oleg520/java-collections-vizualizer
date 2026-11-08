package dev.collectionsviz.core.collections.hashmap;

import java.util.List;

/** Only occupied buckets are serialized. All remaining indices are empty. */
public record Bucket(int index, String kind, long headId, Long rootId, List<NodeView> nodes) {}
