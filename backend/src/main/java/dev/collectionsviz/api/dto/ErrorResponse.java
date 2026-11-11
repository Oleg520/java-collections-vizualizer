package dev.collectionsviz.api.dto;

public record ErrorResponse(int schemaVersion, String code, String message,
                            @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
                            String reason,
                            @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
                            java.util.Map<String, Object> params) {
    public ErrorResponse(int schemaVersion, String code, String message) {
        this(schemaVersion, code, message, null, null);
    }

    /**
     * Error envelopes evolve independently of collection snapshots.
     */
    public static final int SCHEMA_VERSION = 1;
}
