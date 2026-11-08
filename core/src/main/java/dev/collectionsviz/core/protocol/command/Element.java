package dev.collectionsviz.core.protocol.command;

public record Element(ElementType type, String value) {
    public static Element of(Object value) { return new Element(value == null ? ElementType.NULL : value instanceof Integer ? ElementType.INTEGER : ElementType.STRING, value == null ? null : value.toString()); }
}
