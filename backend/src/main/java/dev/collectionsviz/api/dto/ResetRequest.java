package dev.collectionsviz.api.dto;

import dev.collectionsviz.core.protocol.CollectionType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record ResetRequest(@NotNull @PositiveOrZero Long expectedRevision, @NotNull CollectionType collection, Integer initialCapacity) {}
