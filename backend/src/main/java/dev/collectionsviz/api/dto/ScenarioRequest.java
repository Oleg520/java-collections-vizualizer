package dev.collectionsviz.api.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record ScenarioRequest(@NotNull @PositiveOrZero Long expectedRevision) {
}
