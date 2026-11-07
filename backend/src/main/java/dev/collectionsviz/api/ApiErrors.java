package dev.collectionsviz.api;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class ApiErrors {
    public record Error(int schemaVersion,String code,String message) {}
    @ExceptionHandler(SessionStore.ApiException.class)
    public ResponseEntity<Error> session(SessionStore.ApiException e) {
        var response=ResponseEntity.status(e.status);
        if(e.retryAfter>0) response.header("Retry-After",Integer.toString(e.retryAfter));
        return response.body(new Error(1,e.code,e.getMessage()));
    }
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Error> invalid(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(new Error(1,"INVALID_INPUT",e.getMessage()));
    }
    @ExceptionHandler({MethodArgumentNotValidException.class,HttpMessageNotReadableException.class,MethodArgumentTypeMismatchException.class})
    public ResponseEntity<Error> malformed(Exception e) {
        return ResponseEntity.badRequest().body(new Error(1,"INVALID_REQUEST","Проверьте JSON, типы полей, UUID и expectedRevision ≥ 0."));
    }
}
