package dev.collectionsviz.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties="visualizer.trusted-proxies=127.0.0.1,::1")
@AutoConfigureMockMvc
class SessionProxyIntegrationTest {
    @TestConfiguration static class Config {
        @Bean SessionStoreTest.MutableClock clock(){return new SessionStoreTest.MutableClock();}
        @Bean @Primary ApiAdmission admission(SessionStoreTest.MutableClock c){return new ApiAdmission(60,2,120,50,2,1,c);}
        @Bean @Primary SessionStore store(SessionStoreTest.MutableClock c){return new SessionStore(600,32,1,c);}
    }
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired SessionStoreTest.MutableClock clock;
    @Autowired SessionStore store;
    MockHttpServletRequestBuilder via(MockHttpServletRequestBuilder r,String ip){return r.with(q->{q.setRemoteAddr("::ffff:127.0.0.1");return q;}).header(ClientAddress.HEADER,ip);}
    String create(String ip) throws Exception {
        return json.readTree(mvc.perform(via(post("/api/v1/sessions").contentType("application/json").content("{}"),ip)).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("id").asText();
    }
    @Test void distinctProxyClientsHaveIndependentQuotasAndCannotResetEachOther() throws Exception {
        String a="198.51.100.41",b="198.51.100.42",id=create(a),other=create(b);
        assertNotEquals(id,other);
        for(int i=0;i<20;i++) mvc.perform(via(post("/api/v1/sessions/"+id+"/reset").contentType("application/json").content("{\"expectedRevision\":"+i+",\"collection\":\"ARRAY_LIST\",\"initialCapacity\":0}"),a))
            .andExpect(status().isOk()).andExpect(jsonPath("id").value(id)).andExpect(jsonPath("revision").value(i+1));
        mvc.perform(via(post("/api/v1/sessions/"+id+"/reset").contentType("application/json").content("{\"expectedRevision\":20,\"collection\":\"HASH_MAP\"}"),b)).andExpect(status().isNotFound());
        mvc.perform(via(post("/api/v1/sessions").contentType("application/json").content("{}"),a)).andExpect(status().isTooManyRequests()).andExpect(jsonPath("code").value("CLIENT_SESSION_LIMIT"));
        mvc.perform(via(post("/api/v1/sessions").contentType("application/json").content("{}"),a)).andExpect(status().isTooManyRequests()).andExpect(jsonPath("code").value("RATE_LIMITED"));
        // No repeat of creation is required for an existing owned slot, even after create budget is used.
        mvc.perform(via(post("/api/v1/sessions/"+id+"/reset").contentType("application/json").content("{\"expectedRevision\":20,\"collection\":\"HASH_MAP\"}"),a)).andExpect(status().isOk());
        mvc.perform(via(options("/api/v1/sessions/"+id+"/reset").header("Origin","http://localhost:5173").header("Access-Control-Request-Method","POST"),a)).andExpect(status().isOk());
    }
    @Test void malformedDuplicateAndUntrustedHeadersCannotChooseAClient() throws Exception {
        var id=store.create(0,"127.0.0.1").id();
        for(String value:new String[]{"198.51.100.1, 198.51.100.2","hostname","::1%eth0"}) {
            mvc.perform(via(post("/api/v1/sessions").contentType("application/json").content("{}"),value))
                .andExpect(status().isTooManyRequests()).andExpect(jsonPath("code").value("CLIENT_SESSION_LIMIT"));
            clock.millis+=60000; // Start a new rate window while the owned slot is still alive.
            store.get(id);
        }
        mvc.perform(via(post("/api/v1/sessions").contentType("application/json").content("{}"),"198.51.100.1")
            .header(ClientAddress.HEADER,"198.51.100.2"))
            .andExpect(status().isTooManyRequests()).andExpect(jsonPath("code").value("CLIENT_SESSION_LIMIT"));
        store.create(0,"198.51.100.55");
        mvc.perform(post("/api/v1/sessions").with(r->{r.setRemoteAddr("198.51.100.55");return r;})
            .header(ClientAddress.HEADER,"198.51.100.56").header("X-Forwarded-For","198.51.100.57")
            .contentType("application/json").content("{}"))
            .andExpect(status().isTooManyRequests()).andExpect(jsonPath("code").value("CLIENT_SESSION_LIMIT"));
    }
}
