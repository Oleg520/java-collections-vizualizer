package dev.collectionsviz.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@AutoConfigureMockMvc
class ApiIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    String create() throws Exception {
        return json.readTree(mvc.perform(post("/api/v1/sessions").contentType("application/json").content("{}"))
            .andExpect(status().isCreated()).andExpect(jsonPath("state.capacity").value(0))
            .andExpect(jsonPath("schemaVersion").value(1)).andReturn().getResponse().getContentAsString()).get("id").asText();
    }
    static String command(long revision,String type,String key,String value) {
        return "{\"expectedRevision\":"+revision+",\"operation\":{\"type\":\""+type+"\",\"key\":{\"type\":\"STRING\",\"value\":\""+key+"\"},\"value\":"+value+"}}";
    }
    @Test void fullContractIsolationAndRevisionConflicts() throws Exception {
        String a=create(),b=create();
        String body=mvc.perform(post("/api/v1/sessions/"+a+"/commands").contentType("application/json").content(command(0,"PUT","A","\"hello\"")))
            .andExpect(status().isOk()).andExpect(jsonPath("revision").value(1)).andExpect(jsonPath("trace.committed.size").value(1))
            .andExpect(jsonPath("trace.result.found").value(false)).andExpect(jsonPath("trace.committed.capacity").value(16))
            .andReturn().getResponse().getContentAsString();
        JsonNode trace=json.readTree(body).get("trace"),steps=trace.get("steps");
        assertEquals(trace.get("committed"),steps.get(steps.size()-1).get("snapshot"));
        assertEquals(0,steps.get(0).get("index").asInt());
        mvc.perform(get("/api/v1/sessions/"+b)).andExpect(jsonPath("state.size").value(0)).andExpect(jsonPath("revision").value(0));
        mvc.perform(post("/api/v1/sessions/"+a+"/commands").contentType("application/json").content(command(0,"PUT","B","null")))
            .andExpect(status().isConflict()).andExpect(jsonPath("code").value("REVISION_CONFLICT"));
        mvc.perform(post("/api/v1/sessions/"+a+"/commands").contentType("application/json").content(command(1,"GET","A","null")))
            .andExpect(status().isOk()).andExpect(jsonPath("trace.result.value").value("hello"));
        mvc.perform(post("/api/v1/sessions/"+a+"/commands").contentType("application/json").content(command(2,"REMOVE","A","null")))
            .andExpect(status().isOk()).andExpect(jsonPath("trace.result.previousValue").value("hello")).andExpect(jsonPath("trace.committed.size").value(0));
    }
    @Test void malformedInputsDoNotMutate() throws Exception {
        String id=create(),url="/api/v1/sessions/"+id+"/commands";
        for(String body:new String[]{"{}","{\"expectedRevision\":-1,\"operation\":{\"type\":\"RESET\"}}","{\"expectedRevision\":0,\"operation\":{\"type\":\"BOGUS\"}}",command(0,"PUT","A".repeat(65),"null"),"{\"expectedRevision\":0,\"operation\":{\"type\":\"PUT\",\"key\":null}}"})
            mvc.perform(post(url).contentType("application/json").content(body)).andExpect(status().isBadRequest()).andExpect(jsonPath("code").exists());
        mvc.perform(get("/api/v1/sessions/"+id)).andExpect(jsonPath("revision").value(0)).andExpect(jsonPath("state.size").value(0));
        mvc.perform(get("/api/v1/sessions/not-a-uuid")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/sessions/00000000-0000-0000-0000-000000000000")).andExpect(status().isNotFound());
        mvc.perform(post("/api/v1/sessions").contentType("application/json").content("{\"initialCapacity\":1000000}")).andExpect(status().isBadRequest());
    }
    @Test void scenariosAndCors() throws Exception {
        String id=create();
        mvc.perform(get("/api/v1/scenarios")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(8));
        mvc.perform(post("/api/v1/sessions/"+id+"/scenarios/treeify").contentType("application/json").content("{\"expectedRevision\":0}"))
            .andExpect(status().isOk()).andExpect(jsonPath("trace.committed.buckets[0].kind").value("TREE"))
            .andExpect(jsonPath("trace.committed.buckets[0].rootId").isNumber());
        mvc.perform(options("/api/v1/sessions").header("Origin","http://localhost:5173").header("Access-Control-Request-Method","POST"))
            .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin","http://localhost:5173"));
        mvc.perform(options("/api/v1/sessions").header("Origin","https://unlisted.example").header("Access-Control-Request-Method","POST"))
            .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/health")).andExpect(jsonPath("status").value("UP")).andExpect(jsonPath("java").value("21"));
    }
}
