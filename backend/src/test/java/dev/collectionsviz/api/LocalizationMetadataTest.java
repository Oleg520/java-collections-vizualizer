package dev.collectionsviz.api;

import com.fasterxml.jackson.databind.json.JsonMapper;
import dev.collectionsviz.api.dto.ErrorResponse;
import dev.collectionsviz.api.web.ApiErrors;
import dev.collectionsviz.core.collections.arraylist.ArrayListEngine;
import dev.collectionsviz.core.collections.hashmap.HashMapEngine;
import dev.collectionsviz.core.protocol.InputException;
import dev.collectionsviz.core.protocol.command.Operation;
import dev.collectionsviz.core.protocol.command.OperationType;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class LocalizationMetadataTest {
    @Test
    void legacyErrorEnvelopeRemainsIdentical() throws Exception {
        var json = new JsonMapper();
        var value = json.readTree(json.writeValueAsString(new ErrorResponse(1, "INVALID_INPUT", "legacy")));
        assertEquals(json.readTree("{\"schemaVersion\":1,\"code\":\"INVALID_INPUT\",\"message\":\"legacy\"}"), value);
    }

    @Test
    void invalidIndexHasStructuredContextWithoutChangingState() {
        var engine = new ArrayListEngine();
        var before = engine.snapshot();
        var exception = assertThrows(InputException.class,
                () -> engine.execute(Operation.array(OperationType.GET_AT, null, null, null)));
        assertEquals("INDEX_RANGE", exception.reason());
        assertTrue(exception.params().containsKey("index"));
        assertNull(exception.params().get("index"));
        assertEquals(0, exception.params().get("size"));
        assertEquals(before, engine.snapshot());
        var response = new ApiErrors(null).invalid(exception);
        assertEquals(400, response.getStatusCode().value());
        assertEquals("INVALID_INPUT", response.getBody().code());
        assertEquals(exception.getMessage(), response.getBody().message());
        assertEquals(exception.reason(), response.getBody().reason());
    }

    @Test
    void realTreeEventsDescribeTheirAmbiguousVariants() {
        var trace = new HashMapEngine().scenario("treeify");
        for (var step : trace.steps()) {
            if (step.event().equals("TREE_RECOLORED")) assertNotNull(step.details().get("reason"));
            if (step.event().equals("TREE_DIRECTION")) assertNotNull(step.details().get("context"));
        }
        assertTrue(trace.steps().stream().anyMatch(s -> "RED_UNCLE".equals(s.details().get("reason"))));
        assertTrue(trace.steps().stream().anyMatch(s -> "ROOT_BLACK".equals(s.details().get("reason"))));
    }
}
