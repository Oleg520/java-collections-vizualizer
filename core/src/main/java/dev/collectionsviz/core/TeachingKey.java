package dev.collectionsviz.core;

/** Immutable collision key. Registry in the engine prevents changing an ID's hash. */
public record TeachingKey(String id, int forcedHash) implements Comparable<TeachingKey> {
    @Override public int hashCode() { return forcedHash; }
    @Override public boolean equals(Object other) {
        return other instanceof TeachingKey key && id.equals(key.id) && forcedHash == key.forcedHash;
    }
    @Override public int compareTo(TeachingKey other) {
        int order = id.compareTo(other.id);
        return order != 0 ? order : Integer.compare(forcedHash, other.forcedHash);
    }
    @Override public String toString() { return id; }
}
