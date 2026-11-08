package dev.collectionsviz.api;

import dev.collectionsviz.core.protocol.CollectionType;
import dev.collectionsviz.core.protocol.command.Operation;
import dev.collectionsviz.core.protocol.command.OperationType;
import dev.collectionsviz.core.protocol.command.KeySpec;
import dev.collectionsviz.core.protocol.command.Element;
import dev.collectionsviz.core.protocol.command.ElementType;
import dev.collectionsviz.core.collections.hashmap.HashMapEngine;
import dev.collectionsviz.core.collections.arraylist.ArrayListEngine;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import com.fasterxml.jackson.databind.json.JsonMapper;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/** Fixed wire examples captured before the package refactor. */
class SerializationContractTest {
    private final JsonMapper json = new JsonMapper();

    @Test void fixedRequestsStatesAndFullAndCompactTracesPreserveWireContract() throws Exception {
        UUID id = UUID.fromString("00000000-0000-0000-0000-000000000025");
        var map = new HashMapEngine();
        var array = new ArrayListEngine(0);
        var mapOperation = new Operation(OperationType.PUT, KeySpec.collision("key\"\\\n", 42), "value\n");
        var arrayOperation = Operation.array(OperationType.ADD, null, new Element(ElementType.STRING, "value\"\n"), null);
        var mapTrace = new SessionStore.SessionTrace<>(1, id, 3, map.execute(mapOperation));
        var arrayTrace = new SessionStore.SessionTrace<>(1, id, 4, array.execute(arrayOperation));
        Map<String,Object> examples = new LinkedHashMap<>();
        examples.put("create", new ApiController.CreateRequest(CollectionType.ARRAY_LIST, 0));
        examples.put("createDefault", new ApiController.CreateRequest(null, null));
        examples.put("reset", new ApiController.ResetRequest(4L, CollectionType.HASH_MAP, 16));
        examples.put("command", new ApiController.CommandRequest(2L, mapOperation));
        examples.put("arrayCommand", new ApiController.CommandRequest(3L, arrayOperation));
        examples.put("scenario", new ApiController.ScenarioRequest(4L));
        examples.put("error", new ApiErrors.Error(1, "REVISION_CONFLICT", "Состояние изменилось"));
        examples.put("mapState", new SessionStore.SessionState(1, id, "HASH_MAP", 3, 1800, map.snapshot()));
        examples.put("arrayState", new SessionStore.SessionState(1, id, "ARRAY_LIST", 4, 1800, array.snapshot()));
        examples.put("mapFull", mapTrace);
        examples.put("arrayFull", arrayTrace);
        examples.put("mapCompact", CompactTraceRegistry.STANDARD.encode(mapTrace));
        examples.put("arrayCompact", CompactTraceRegistry.STANDARD.encode(arrayTrace));
        var actual = json.readTree(json.writeValueAsString(examples));
        try (var fixture = getClass().getResourceAsStream("/contracts/wire-v1.json")) {
            assertNotNull(fixture);
            assertEquals(json.readTree(fixture), actual);
        }
        assertEquals(mapOperation, json.readValue(json.writeValueAsString(mapOperation), Operation.class));
        assertEquals(arrayOperation, json.readValue(json.writeValueAsString(arrayOperation), Operation.class));
    }
}
