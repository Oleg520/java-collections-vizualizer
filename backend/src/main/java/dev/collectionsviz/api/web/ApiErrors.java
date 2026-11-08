package dev.collectionsviz.api.web;

import dev.collectionsviz.api.dto.ErrorResponse;
import dev.collectionsviz.api.error.ApiException;
import dev.collectionsviz.api.observability.ApiMetrics;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class ApiErrors {
    private final ApiMetrics metrics;
    public ApiErrors(ApiMetrics metrics) { this.metrics=metrics; }
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> session(ApiException e) {
        metrics.rejected(e.status,e.code);
        var response=ResponseEntity.status(e.status);
        if(e.retryAfter>0) response.header("Retry-After",Integer.toString(e.retryAfter));
        return response.body(new ErrorResponse(1,e.code,e.getMessage()));
    }
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> invalid(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(new ErrorResponse(1,"INVALID_INPUT",e.getMessage()));
    }
    @ExceptionHandler({MethodArgumentNotValidException.class,HttpMessageNotReadableException.class,MethodArgumentTypeMismatchException.class})
    public ResponseEntity<ErrorResponse> malformed(Exception e) {
        return ResponseEntity.badRequest().body(new ErrorResponse(1,"INVALID_REQUEST","Проверьте JSON, типы полей, UUID и expectedRevision ≥ 0."));
    }
}
