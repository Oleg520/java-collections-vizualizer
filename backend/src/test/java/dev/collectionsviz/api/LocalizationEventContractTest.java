package dev.collectionsviz.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.json.JsonMapper;
import dev.collectionsviz.core.collections.arraylist.ArrayListEngine;
import dev.collectionsviz.core.collections.hashmap.HashMapEngine;
import dev.collectionsviz.core.protocol.Step;
import dev.collectionsviz.core.protocol.command.KeySpec;
import dev.collectionsviz.core.protocol.command.Operation;
import dev.collectionsviz.core.protocol.command.OperationType;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Real Java emission variants shared with frontend localization tests, without snapshots.
 */
class LocalizationEventContractTest {
    private final JsonMapper json = new JsonMapper();
    private final Set<JsonNode> examples = new LinkedHashSet<>();

    private void collect(List<? extends Step<?>> steps) {
        for (var step : steps) {
            var details = new LinkedHashMap<String, Object>();
            for (String field : List.of("reason", "context", "partition", "direction", "found", "equal",
                    "initialCapacity", "constructor", "minimumCapacity")) {
                if (step.details().containsKey(field)) details.put(field, step.details().get(field));
            }
            var row = new LinkedHashMap<String, Object>();
            row.put("event", step.event());
            // Operation type selects semantics; arbitrary user data is tested separately in frontend.
            row.put("operation", new Operation(step.operation().type(), null, null));
            row.put("details", details);
            examples.add(json.valueToTree(row));
        }
    }

    @Test
    void realJavaEventVariantsMatchTheSharedFixture() throws Exception {
        for (var scenario : HashMapEngine.SCENARIOS) collect(new HashMapEngine().scenario(scenario.id()).steps());
        for (var scenario : ArrayListEngine.SCENARIOS) collect(new ArrayListEngine().scenario(scenario.id()).steps());
        var map = new HashMapEngine(16);
        collect(map.execute(new Operation(OperationType.RESET, null, null)).steps());
        collect(map.execute(new Operation(OperationType.GET, KeySpec.string("missing"), null)).steps());
        collect(map.execute(new Operation(OperationType.REMOVE, KeySpec.string("missing"), null)).steps());
        collect(map.execute(new Operation(OperationType.GET,
                new KeySpec(dev.collectionsviz.core.protocol.command.KeyType.NULL, null, null), null)).steps());
        collect(map.execute(new Operation(OperationType.PUT,
                new KeySpec(dev.collectionsviz.core.protocol.command.KeyType.NULL, null, null), "null-key")).steps());
        collect(map.scenario("treeify").steps());
        collect(map.execute(new Operation(OperationType.PUT, KeySpec.collision("K10", 42), "value")).steps());
        // Asymmetric tree split exercises both Java partition reasons and in-flight treeification.
        for (int low : List.of(6, 2)) {
            var split = new HashMapEngine(64);
            for (int i = 0; i < low; i++)
                collect(split.execute(new Operation(OperationType.PUT,
                        KeySpec.collision("L" + i, 1), "low")).steps());
            for (int i = 0; i < 7; i++)
                collect(split.execute(new Operation(OperationType.PUT,
                        KeySpec.collision("H" + i, 65), "high")).steps());
            for (int i = low + 7; i < 49; i++)
                collect(split.execute(new Operation(OperationType.PUT,
                        KeySpec.collision("F" + i, 2 + (i % 30)), "filler")).steps());
        }
        // High partition untreeifies too; it is not interchangeable with the low partition.
        var high = new HashMapEngine(64);
        for (int i = 0; i < 7; i++)
            collect(high.execute(new Operation(OperationType.PUT, KeySpec.collision("L" + i, 1), "L")).steps());
        for (int i = 0; i < 2; i++)
            collect(high.execute(new Operation(OperationType.PUT, KeySpec.collision("H" + i, 65), "H")).steps());
        for (int i = 9; i < 49; i++)
            collect(high.execute(new Operation(OperationType.PUT, KeySpec.collision("F" + i, 2 + i % 30), "F"))
                    .steps());
        var array = new ArrayListEngine();
        collect(array.execute(Operation.array(OperationType.TRIM_TO_SIZE, null, null, null)).steps());
        collect(array.execute(Operation.array(OperationType.ENSURE_CAPACITY, null, null, -1)).steps());
        var actual = json.valueToTree(examples);
        Path fixture = Path.of("src/test/resources/contracts/localization-events.json");
        if (Boolean.getBoolean("updateLocalizationFixtures"))
            Files.writeString(fixture, json.writerWithDefaultPrettyPrinter().writeValueAsString(actual) + "\n");
        try (var source = getClass().getResourceAsStream("/contracts/localization-events.json")) {
            if (Boolean.getBoolean("updateLocalizationFixtures"))
                assertEquals(actual, json.readTree(Files.readString(fixture)));
            else {
                assertNotNull(source);
                assertEquals(json.readTree(source), actual);
            }
        }
    }
}
