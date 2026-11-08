package dev.collectionsviz.api;

import dev.collectionsviz.api.session.SessionStore;
import dev.collectionsviz.api.admission.ApiAdmission;
import dev.collectionsviz.api.admission.ClientAddress;
import dev.collectionsviz.api.session.SessionFixtures;
import dev.collectionsviz.api.admission.AdmissionFixtures;
import dev.collectionsviz.api.support.MutableClock;

import java.util.UUID;
import java.net.URI;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@AutoConfigureMockMvc
class ApiLimitsIntegrationTest {
    @TestConfiguration static class Config {
        @Bean MutableClock testClock() { return new MutableClock(); }
        @Bean @Primary ApiAdmission testAdmission(MutableClock clock) { return AdmissionFixtures.admission(10,3,3,20,2,1,clock); }
        @Bean @Primary SessionStore testStore(MutableClock clock) { return SessionFixtures.store(60,8,2,clock); }
    }
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired SessionStore store;
    @Autowired ApiAdmission admission;
    @Autowired MutableClock clock;
    MockHttpServletRequestBuilder from(MockHttpServletRequestBuilder request,String ip) {
        return request.with(r -> { r.setRemoteAddr(ip); return r; });
    }
    UUID create(String ip,String path) throws Exception {
        var body=mvc.perform(from(post(URI.create(path)).contentType("application/json").content("{}"),ip))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return UUID.fromString(json.readTree(body).get("id").asText());
    }
    @Test void creationRateCannotBeBypassedWithProxyHeadersOrRoutingAliasesAndLiveCapPersists() throws Exception {
        String ip="198.51.100.11";
        mvc.perform(from(post("/api/v1/sessions").contentType("application/json").content("{\"initialCapacity\":1000000}"),ip))
            .andExpect(status().isBadRequest());
        UUID a=create(ip,"/api/v1/%73essions"),b=create(ip,"/api/v1/sessions;v=1");
        mvc.perform(from(post("/api/v1/sessions").contentType("application/json").content("{}")
            .header("X-Forwarded-For","203.0.113.9").header("Forwarded","for=203.0.113.10")
            .header(ClientAddress.HEADER,"203.0.113.11"),ip))
            .andExpect(status().isTooManyRequests()).andExpect(jsonPath("code").value("RATE_LIMITED"))
            .andExpect(header().string("Retry-After","10"));
        clock.millis+=10000;
        mvc.perform(from(post("/api/v1/sessions").contentType("application/json").content("{}"),ip))
            .andExpect(status().isTooManyRequests()).andExpect(jsonPath("code").value("CLIENT_SESSION_LIMIT"))
            .andExpect(header().string("Retry-After","60"));
        assertEquals(0,store.get(a).revision()); assertEquals(0,store.get(b).state().size());
        assertNotNull(create("198.51.100.12","/api/v1/sessions"));
        clock.millis+=60000;
        assertNotNull(create(ip,"/api/v1/sessions"));
    }
    @Test void rejectedCommandsDoNotMutateAndWindowRecoveryUsesOriginalRevision() throws Exception {
        String ip="198.51.100.21"; UUID id=create(ip,"/api/v1/sessions");
        String base="/api/v1/sessions/"+id;
        mvc.perform(from(post(base+"/commands?encoding=compact").contentType("application/json").content(ApiIntegrationTest.command(0,"PUT","A","null")),ip))
            .andExpect(status().isOk()).andExpect(jsonPath("revision").value(1));
        mvc.perform(from(post(base+"/scenarios/treeify?encoding=compact").contentType("application/json").content("{\"expectedRevision\":1}"),ip))
            .andExpect(status().isOk()).andExpect(jsonPath("revision").value(2));
        mvc.perform(from(get(base),ip)).andExpect(status().isOk());
        var before=store.get(id);
        for(String suffix:new String[]{"/commands","/%63ommands","/commands;v=1"}) {
            mvc.perform(from(post(URI.create(base+suffix+"?encoding=compact")).contentType("application/json").content(ApiIntegrationTest.command(2,"CLEAR","A","null"))
                .header("Origin","http://localhost:5173"),ip))
                .andExpect(status().isTooManyRequests()).andExpect(jsonPath("code").value("RATE_LIMITED"))
                .andExpect(header().string("Retry-After","10"))
                .andExpect(header().string("Access-Control-Allow-Origin","http://localhost:5173"));
            assertEquals(before,store.get(id));
        }
        clock.millis+=10000;
        mvc.perform(from(post(base+"/commands?encoding=compact").contentType("application/json").content(ApiIntegrationTest.command(2,"CLEAR","A","null")),ip))
            .andExpect(status().isOk()).andExpect(jsonPath("revision").value(3)).andExpect(jsonPath("trace.committed.size").value(0));
    }
    @Test void busyWorkDoesNotQueueOrBlockHealthAndDoesNotConsumeRevision() throws Exception {
        String ip="198.51.100.31"; UUID id=create(ip,"/api/v1/sessions");
        var before=store.get(id);
        try(var held=admission.enter(ip,false); var other=admission.enter("198.51.100.32",false)) {
            mvc.perform(from(post("/api/v1/sessions/"+id+"/commands?encoding=compact").contentType("application/json").content(ApiIntegrationTest.command(0,"RESET","A","null")),ip))
                .andExpect(status().isTooManyRequests()).andExpect(jsonPath("code").value("WORK_LIMIT"));
            mvc.perform(get("/api/v1/health")).andExpect(status().isOk());
            mvc.perform(options("/api/v1/sessions").header("Origin","http://localhost:5173").header("Access-Control-Request-Method","POST"))
                .andExpect(status().isOk());
            assertEquals(before,store.get(id));
        }
        mvc.perform(from(post("/api/v1/sessions/"+id+"/commands?encoding=compact").contentType("application/json").content(ApiIntegrationTest.command(0,"RESET","A","null")),ip))
            .andExpect(status().isOk()).andExpect(jsonPath("revision").value(1));
    }
}
