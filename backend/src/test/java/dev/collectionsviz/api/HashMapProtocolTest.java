package dev.collectionsviz.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import com.fasterxml.jackson.databind.ObjectMapper;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties="visualizer.allow-full-trace=true")
@AutoConfigureMockMvc
class HashMapProtocolTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired dev.collectionsviz.api.session.SessionStore sessions;
    @Test void oldTabsAndUnsupportedVersionsCannotMutateOrResetEvenToArrayList() throws Exception {
        int before=sessions.storedSessions();
        for(String query:new String[]{"","?snapshotVersion=1","?snapshotVersion=3"})
            mvc.perform(post("/api/v1/sessions"+query).contentType("application/json").content("{}"))
                .andExpect(status().isUpgradeRequired()).andExpect(jsonPath("code").value("API_VERSION_MISMATCH"));
        org.junit.jupiter.api.Assertions.assertEquals(before,sessions.storedSessions());
        var response=mvc.perform(post("/api/v1/sessions?snapshotVersion=2").contentType("application/json").content("{}"))
            .andExpect(status().isCreated()).andExpect(jsonPath("schemaVersion").value(2)).andReturn().getResponse();
        String base="/api/v1/sessions/"+json.readTree(response.getContentAsString()).get("id").asText();
        for(String version:new String[]{"","&snapshotVersion=1","&snapshotVersion=3"}) {
            mvc.perform(post(base+"/commands?encoding=compact"+version).contentType("application/json")
                .content(ApiIntegrationTest.command(999,"PUT","A","null"))).andExpect(status().isUpgradeRequired());
            mvc.perform(post(base+"/scenarios/tree-remove?encoding=compact"+version).contentType("application/json")
                .content("{\"expectedRevision\":0}")).andExpect(status().isUpgradeRequired());
        }
        mvc.perform(post(base+"/reset").contentType("application/json")
            .content("{\"expectedRevision\":0,\"collection\":\"ARRAY_LIST\"}"))
            .andExpect(status().isUpgradeRequired());
        mvc.perform(get(base+"?snapshotVersion=2")).andExpect(jsonPath("revision").value(0))
            .andExpect(jsonPath("state.size").value(0)).andExpect(jsonPath("collection").value("HASH_MAP"));
        mvc.perform(post(base+"/commands?encoding=full&snapshotVersion=2").contentType("application/json")
            .content(ApiIntegrationTest.command(0,"PUT","A","null"))).andExpect(status().isOk())
            .andExpect(jsonPath("trace.schemaVersion").value(2)).andExpect(jsonPath("trace.committed.buckets[0].nodes[0].objectId").isNumber());
        mvc.perform(post(base+"/commands?encoding=compact&snapshotVersion=2").contentType("application/json")
            .content(ApiIntegrationTest.command(1,"GET","A","null"))).andExpect(status().isOk())
            .andExpect(jsonPath("schemaVersion").value(2)).andExpect(jsonPath("encoding").value("node-table-v2"));
    }
}
