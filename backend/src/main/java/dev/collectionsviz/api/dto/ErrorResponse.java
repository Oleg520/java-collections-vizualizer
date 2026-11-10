package dev.collectionsviz.api.dto;

public record ErrorResponse(int schemaVersion, String code, String message) {
}
