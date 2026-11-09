package dev.collectionsviz.api.dto;

import dev.collectionsviz.core.protocol.command.Operation;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record CommandRequest(@NotNull @PositiveOrZero Long expectedRevision, @NotNull Operation operation) {}
