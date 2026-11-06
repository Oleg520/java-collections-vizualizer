package dev.collectionsviz.core;

import java.util.List;
import java.util.Map;

/** Version 1 transport-neutral records. No Spring, JSON, or drawing dependencies. */
public final class Protocol {
    private Protocol() {}
    public enum OperationType { PUT, GET, REMOVE, CLEAR, RESET, SCENARIO }
    public enum KeyType { STRING, INTEGER, COLLISION, NULL }
    public record KeySpec(KeyType type, String value, Integer hashCodeOverride) {
        public static KeySpec string(String value) { return new KeySpec(KeyType.STRING, value, null); }
        public static KeySpec collision(String value, int hash) { return new KeySpec(KeyType.COLLISION, value, hash); }
        public static KeySpec from(Object key) {
            if (key == null) return new KeySpec(KeyType.NULL, null, null);
            if (key instanceof TeachingKey k) return collision(k.id(), k.hashCode());
            return new KeySpec(key instanceof Integer ? KeyType.INTEGER : KeyType.STRING, key.toString(), null);
        }
    }
    public record Operation(OperationType type, KeySpec key, String value) {}
    public record Result(boolean found, String previousValue, String value) {}
    public record Step<S>(int index, Operation operation, String event, String stage,
                          String message, Map<String,Object> details, S snapshot) {}
    public record Trace<S>(int schemaVersion, String collection, Operation operation, Result result,
                           S before, List<Step<S>> steps, S committed) {}
    public record HashMapSnapshot(String phase, int size, int capacity, int threshold, float loadFactor,
                                  int pendingCapacity, List<Bucket> buckets, List<Bucket> pendingBuckets) {}
    /** Only occupied buckets are serialized. All remaining indices are empty. */
    public record Bucket(int index, String kind, long headId, Long rootId, List<NodeView> nodes) {}
    public record NodeView(long id, KeySpec key, String value, int rawHashCode, int hash, Long next,
                           Long parent, Long left, Long right, Long prev, Boolean red, boolean linked) {}
    public record Scenario(String id, String title, String description) {}
}
