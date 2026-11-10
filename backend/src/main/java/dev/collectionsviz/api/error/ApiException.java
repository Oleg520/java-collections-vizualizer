package dev.collectionsviz.api.error;

public class ApiException extends RuntimeException {
    public final int status;
    public final String code;
    public final int retryAfter;

    public ApiException(int status, String code, String message) {
        this(status, code, message, 0);
    }

    public ApiException(int status, String code, String message, int retryAfter) {
        super(message);
        this.status = status;
        this.code = code;
        this.retryAfter = retryAfter;
    }
}
