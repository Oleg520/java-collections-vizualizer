package dev.collectionsviz.core.protocol.command;

public record KeySpec(KeyType type, String value, Integer hashCodeOverride) {
    public static KeySpec string(String value) { return new KeySpec(KeyType.STRING, value, null); }
    public static KeySpec collision(String value, int hash) { return new KeySpec(KeyType.COLLISION, value, hash); }
}
