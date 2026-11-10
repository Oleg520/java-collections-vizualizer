package dev.collectionsviz.core.collections.hashmap;

import java.util.List;

/** Occupied buckets and temporary areas. headId/rootId address physical objectId, possibly in another area. */
public record Bucket(int index, String kind, long headId, Long rootId, List<NodeView> nodes) {}
