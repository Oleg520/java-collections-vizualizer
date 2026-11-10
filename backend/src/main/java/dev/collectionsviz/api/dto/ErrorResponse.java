package dev.collectionsviz.api.dto;

public record ErrorResponse(int schemaVersion, String code, String message) {
    /**
     * Error envelopes evolve independently of collection snapshots.
     */
    public static final int SCHEMA_VERSION = 1;
}
