package dev.collectionsviz.core.protocol.command;

public record Result(boolean found, String previousValue, String value, String kind, Element element,
                     Boolean booleanValue, Integer intValue) {
    public Result(boolean found, String previousValue, String value) {
        this(found, previousValue, value, null, null, null, null);
    }

    public static Result array(String kind, Element element, Boolean bool, Integer integer) {
        return new Result(element != null || (integer != null && integer >= 0), null, null, kind, element, bool,
                integer);
    }
}
