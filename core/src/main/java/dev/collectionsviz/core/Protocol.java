package dev.collectionsviz.core;

import java.util.List;
import java.util.Map;

/** Version 1 transport-neutral records. No Spring, JSON, or drawing dependencies. */
public final class Protocol {
    private Protocol() {}
    public enum OperationType { PUT, GET, REMOVE, CLEAR, RESET, SCENARIO, ADD, ADD_AT, GET_AT, SET_AT, REMOVE_AT, INDEX_OF, ENSURE_CAPACITY, TRIM_TO_SIZE }
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
    public enum CollectionType { HASH_MAP, ARRAY_LIST }
    public enum ElementType { STRING, INTEGER, NULL }
    public record Element(ElementType type, String value) {
        public static Element of(Object value) { return new Element(value == null ? ElementType.NULL : value instanceof Integer ? ElementType.INTEGER : ElementType.STRING, value == null ? null : value.toString()); }
    }
    public record Operation(OperationType type, KeySpec key, String value, Integer index, Element element, Integer minCapacity) {
        public Operation(OperationType type, KeySpec key, String value) { this(type,key,value,null,null,null); }
        public static Operation array(OperationType type, Integer index, Element element, Integer minCapacity) { return new Operation(type,null,null,index,element,minCapacity); }
    }
    public record Result(boolean found, String previousValue, String value, String kind, Element element, Boolean booleanValue, Integer intValue) {
        public Result(boolean found, String previousValue, String value) { this(found,previousValue,value,null,null,null,null); }
        public static Result array(String kind, Element element, Boolean bool, Integer integer) { return new Result(element != null || (integer != null && integer >= 0),null,null,kind,element,bool,integer); }
    }
    public interface Snapshot { String phase(); int size(); int capacity(); }
    /** IDs identify teaching occurrences, never Java object addresses. */
    public record Cell(long id, Element element) {}
    public record Buffer(long id, int capacity, List<Cell> cells) {}
    public record ArrayListSnapshot(String collection, String phase, int size, int capacity,
        String emptyMode, Integer initialCapacity, Buffer buffer, Buffer pendingBuffer) implements Snapshot {}
    public record Step<S>(int index, Operation operation, String event, String stage,
                          String message, Map<String,Object> details, S snapshot) {}
    public record Trace<S>(int schemaVersion, String collection, Operation operation, Result result,
                           S before, List<Step<S>> steps, S committed) {}
    public record HashMapSnapshot(String phase, int size, int capacity, int threshold, float loadFactor,
                                  int pendingCapacity, List<Bucket> buckets, List<Bucket> pendingBuckets) implements Snapshot {}
    /** Only occupied buckets are serialized. All remaining indices are empty. */
    public record Bucket(int index, String kind, long headId, Long rootId, List<NodeView> nodes) {}
    public record NodeView(long id, KeySpec key, String value, int rawHashCode, int hash, Long next,
                           Long parent, Long left, Long right, Long prev, Boolean red, boolean linked) {}
    public record Scenario(String id, String title, String description) {}
}
