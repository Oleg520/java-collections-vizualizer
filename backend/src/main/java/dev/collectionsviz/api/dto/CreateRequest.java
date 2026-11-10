package dev.collectionsviz.api.dto;

import dev.collectionsviz.core.protocol.CollectionType;

public record CreateRequest(CollectionType collection, Integer initialCapacity) {
}
