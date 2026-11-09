package dev.collectionsviz.core.protocol.command;

public record Operation(OperationType type, KeySpec key, String value, Integer index, Element element, Integer minCapacity) {
    public Operation(OperationType type, KeySpec key, String value) { this(type,key,value,null,null,null); }
    public static Operation array(OperationType type, Integer index, Element element, Integer minCapacity) { return new Operation(type,null,null,index,element,minCapacity); }
}
