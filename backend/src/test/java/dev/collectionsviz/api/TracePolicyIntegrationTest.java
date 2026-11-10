package dev.collectionsviz.api;

import dev.collectionsviz.api.dto.CommandRequest;
import dev.collectionsviz.api.session.SessionStore;
import dev.collectionsviz.core.protocol.command.KeySpec;
import dev.collectionsviz.core.protocol.command.Operation;
import dev.collectionsviz.core.protocol.command.OperationType;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class TracePolicyIntegrationTest {
    @Autowired
    MockMvc mvc;
    @Autowired
    ObjectMapper json;
    @Autowired
    SessionStore sessions;

    String state(String id) throws Exception {
        return mvc.perform(get("/api/v1/sessions/" + id).param("snapshotVersion", "2"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    }

    void forbidden(String path, String body) throws Exception {
        mvc.perform(post(path).param("snapshotVersion", "2").contentType("application/json").content(body))
                .andExpect(status().isForbidden()).andExpect(jsonPath("schemaVersion").value(1))
                .andExpect(jsonPath("code").value("FULL_TRACE_DISABLED"))
                .andExpect(jsonPath("message").value("Полный trace отключён. Используйте encoding=compact."))
                .andExpect(jsonPath("trace").doesNotExist());
    }

    @Test
    void fullAndImplicitFullNeverExecuteCommandsOrScenariosByDefault() throws Exception {
        var session = sessions.create(0);
        sessions.execute(session.id(), 0, new Operation(OperationType.PUT, KeySpec.string("A"), "keep"));
        String id = session.id().toString(), base = "/api/v1/sessions/" + id;
        var before = state(id);
        for (String query : new String[]{"", "?encoding=full"}) {
            for (String type : new String[]{"PUT", "GET", "REMOVE", "CLEAR", "RESET"}) {
                forbidden(base + "/commands" + query, ApiIntegrationTest.command(1, type, "A", "\"replace\""));
                assertEquals(before, state(id));
            }
            forbidden(base + "/scenarios/treeify" + query, "{\"expectedRevision\":1}");
            assertEquals(before, state(id));
        }
        for (String endpoint : new String[]{"/commands", "/scenarios/treeify"}) {
            String body = endpoint.equals("/commands") ? ApiIntegrationTest.command(1, "PUT", "A", "null") :
                    "{\"expectedRevision\":1}";
            mvc.perform(post(base + endpoint + "?encoding=bad").param("snapshotVersion", "2")
                            .contentType("application/json").content(body))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("code").value("INVALID_INPUT"));
            assertEquals(before, state(id));
        }
    }

    @Test
    void compactScenariosAndRevisionConflictsStillWorkWhenFullIsDisabled() throws Exception {
        var session = sessions.create(0);
        String base = "/api/v1/sessions/" + session.id();
        mvc.perform(post(base + "/scenarios/treeify?encoding=compact").param("snapshotVersion", "2")
                        .contentType("application/json").content("{\"expectedRevision\":0}"))
                .andExpect(status().isOk()).andExpect(jsonPath("revision").value(1))
                .andExpect(jsonPath("encoding").value("node-table-v2"))
                .andExpect(jsonPath("trace.committed.size").value(9))
                .andExpect(jsonPath("trace.committed.buckets[0].nodeRefs.length()").value(9));
        var before = state(session.id().toString());
        mvc.perform(
                        post(base + "/commands?encoding=compact").param("snapshotVersion", "2").contentType("application/json")
                                .content(ApiIntegrationTest.command(0, "RESET", "A", "null")))
                .andExpect(status().isConflict()).andExpect(jsonPath("code").value("REVISION_CONFLICT"));
        assertEquals(before, state(session.id().toString()));
    }

    @Test
    void heavySplitRejectsFullBeforeMutationAndAcceptsCompactWithSameRevision() throws Exception {
        var session = sessions.create(64);
        for (int i = 0; i < 96; i++)
            sessions.execute(session.id(), i, new Operation(OperationType.PUT,
                    KeySpec.collision(String.format("%03d", i) + "\0".repeat(61), i % 2 == 0 ? 1 : 129),
                    "\0".repeat(128)));
        String id = session.id().toString(), path = "/api/v1/sessions/" + id + "/commands";
        var operation = new Operation(OperationType.PUT, KeySpec.collision("096" + "\0".repeat(61), 1),
                "\0".repeat(128));
        String body = json.writeValueAsString(new CommandRequest(96L, operation));
        var before = state(id);
        forbidden(path + "?encoding=full", body);
        assertEquals(before, state(id));
        byte[] compact = mvc.perform(
                        post(path + "?encoding=compact").param("snapshotVersion", "2").contentType("application/json")
                                .content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("revision").value(97))
                .andExpect(jsonPath("encoding").value("node-table-v2"))
                .andExpect(jsonPath("trace.committed.size").value(97))
                .andExpect(jsonPath("trace.committed.capacity").value(256))
                .andExpect(jsonPath("trace.steps.length()").value(990))
                .andReturn().getResponse().getContentAsByteArray();
        assertTrue(compact.length < 8 * 1024 * 1024);
    }
}
