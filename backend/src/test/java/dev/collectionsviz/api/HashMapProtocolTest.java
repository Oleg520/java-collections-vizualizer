package dev.collectionsviz.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import com.fasterxml.jackson.databind.ObjectMapper;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "visualizer.allow-full-trace=true")
@AutoConfigureMockMvc
class HashMapProtocolTest {
    @Autowired
    MockMvc mvc;
    @Autowired
    ObjectMapper json;
    @Autowired
    dev.collectionsviz.api.session.SessionStore sessions;

    @Test
    void oldTabsAndUnsupportedVersionsCannotMutateOrResetEvenToArrayList() throws Exception {
        int before = sessions.storedSessions();
        for (String query : new String[]{"", "?snapshotVersion=", "?snapshotVersion=0", "?snapshotVersion=1", "?snapshotVersion=-1", "?snapshotVersion=3"})
            mvc.perform(post("/api/v1/sessions" + query).contentType("application/json").content("{}"))
                    .andExpect(status().isUpgradeRequired()).andExpect(jsonPath("code").value("API_VERSION_MISMATCH"));
        org.junit.jupiter.api.Assertions.assertEquals(before, sessions.storedSessions());
        var response = mvc.perform(
                        post("/api/v1/sessions?snapshotVersion=2").contentType("application/json").content("{}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("schemaVersion").value(2)).andReturn()
                .getResponse();
        String base = "/api/v1/sessions/" + json.readTree(response.getContentAsString()).get("id").asText();
        for (String version : new String[]{"", "&snapshotVersion=", "&snapshotVersion=0", "&snapshotVersion=1", "&snapshotVersion=-1", "&snapshotVersion=3"}) {
            String query = version.isEmpty() ? "" : "?" + version.substring(1);
            mvc.perform(get(base + query)).andExpect(status().isUpgradeRequired());
            mvc.perform(post(base + "/reset" + query).contentType("application/json")
                            .content("{\"expectedRevision\":0,\"collection\":\"ARRAY_LIST\"}"))
                    .andExpect(status().isUpgradeRequired());
            mvc.perform(post(base + "/commands?encoding=compact" + version).contentType("application/json")
                            .content(ApiIntegrationTest.command(999, "PUT", "A", "null")))
                    .andExpect(status().isUpgradeRequired());
            mvc.perform(post(base + "/scenarios/tree-remove?encoding=compact" + version).contentType("application/json")
                    .content("{\"expectedRevision\":0}")).andExpect(status().isUpgradeRequired());
        }
        mvc.perform(post(base + "/reset").contentType("application/json")
                        .content("{\"expectedRevision\":0,\"collection\":\"ARRAY_LIST\"}"))
                .andExpect(status().isUpgradeRequired());
        mvc.perform(get(base + "?snapshotVersion=2")).andExpect(jsonPath("revision").value(0))
                .andExpect(jsonPath("state.size").value(0)).andExpect(jsonPath("collection").value("HASH_MAP"));
        mvc.perform(post(base + "/commands?encoding=full&snapshotVersion=2").contentType("application/json")
                        .content(ApiIntegrationTest.command(0, "PUT", "A", "null"))).andExpect(status().isOk())
                .andExpect(jsonPath("trace.schemaVersion").value(2))
                .andExpect(jsonPath("trace.committed.buckets[0].nodes[0].objectId").isNumber());
        mvc.perform(post(base + "/commands?encoding=compact&snapshotVersion=2").contentType("application/json")
                        .content(ApiIntegrationTest.command(1, "GET", "A", "null"))).andExpect(status().isOk())
                .andExpect(jsonPath("schemaVersion").value(2)).andExpect(jsonPath("encoding").value("node-table-v2"));
    }

    @Test
    void defaultCollectionAndWireVersionsStayAlignedWithHealth() throws Exception {
        mvc.perform(get("/api/v1/health")).andExpect(status().isOk())
                .andExpect(jsonPath("hashMapSnapshotVersion").value("2"));
        var scenarios = mvc.perform(get("/api/v1/scenarios")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        org.junit.jupiter.api.Assertions.assertEquals(scenarios,
                mvc.perform(get("/api/v1/scenarios?collection=HASH_MAP"))
                        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        for (String body : new String[]{"", "{}", "{\"collection\":null}"}) {
            var response = mvc.perform(post("/api/v1/sessions?snapshotVersion=2")
                            .contentType("application/json").content(body))
                    .andExpect(status().isCreated()).andExpect(jsonPath("schemaVersion").value(2))
                    .andExpect(jsonPath("collection").value("HASH_MAP")).andReturn().getResponse();
            String base = "/api/v1/sessions/" + json.readTree(response.getContentAsString()).get("id").asText();
            // Missing/empty encoding still selects full when explicitly enabled.
            mvc.perform(post(base + "/commands?snapshotVersion=2&encoding=")
                            .contentType("application/json").content(ApiIntegrationTest.command(0, "GET", "A", "null")))
                    .andExpect(status().isOk()).andExpect(jsonPath("schemaVersion").value(2))
                    .andExpect(jsonPath("trace.schemaVersion").value(2)).andExpect(jsonPath("encoding").doesNotExist());
        }
    }

    @Test
    void arrayListKeepsVersionOneResponsesForAllAcceptedRequestVersions() throws Exception {
        for (String version : new String[]{"", "?snapshotVersion=", "?snapshotVersion=0", "?snapshotVersion=1", "?snapshotVersion=2"}) {
            var response = mvc.perform(post("/api/v1/sessions" + version).contentType("application/json")
                            .content("{\"collection\":\"ARRAY_LIST\"}"))
                    .andExpect(status().isCreated()).andExpect(jsonPath("schemaVersion").value(1))
                    .andReturn().getResponse();
            String base = "/api/v1/sessions/" + json.readTree(response.getContentAsString()).get("id").asText();
            mvc.perform(get(base + version)).andExpect(status().isOk()).andExpect(jsonPath("schemaVersion").value(1));
            String separator = version.isEmpty() ? "?" : "&";
            mvc.perform(post(base + "/commands" + version + separator + "encoding=compact")
                            .contentType("application/json")
                            .content("{\"expectedRevision\":0,\"operation\":{\"type\":\"CLEAR\"}}"))
                    .andExpect(status().isOk()).andExpect(jsonPath("schemaVersion").value(1))
                    .andExpect(jsonPath("trace.schemaVersion").value(1))
                    .andExpect(jsonPath("encoding").value("array-frames-v1"));
            if (!version.equals("?snapshotVersion=2")) {
                mvc.perform(post(base + "/reset" + version).contentType("application/json")
                                .content("{\"expectedRevision\":1,\"collection\":\"HASH_MAP\"}"))
                        .andExpect(status().isUpgradeRequired()).andExpect(jsonPath("schemaVersion").value(1));
                mvc.perform(get(base + version)).andExpect(jsonPath("collection").value("ARRAY_LIST"))
                        .andExpect(jsonPath("revision").value(1));
            }
        }
    }

}
