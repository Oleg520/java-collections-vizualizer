package dev.collectionsviz.api;

import java.time.Clock;
import java.util.*;
import java.util.concurrent.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.collectionsviz.core.ArrayListEngine;
import dev.collectionsviz.core.Protocol.*;
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
class ArrayListApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired SessionStore sessions;
    String create(String extra) throws Exception {
        return json.readTree(mvc.perform(post("/api/v1/sessions").contentType("application/json").content("{\"collection\":\"ARRAY_LIST\""+extra+"}"))
            .andExpect(status().isCreated()).andExpect(jsonPath("collection").value("ARRAY_LIST"))
            .andExpect(jsonPath("state.buckets").doesNotExist()).andReturn().getResponse().getContentAsString()).get("id").asText();
    }
    static String body(String op) { return "{\"expectedRevision\":0,\"operation\":"+op+"}"; }
    @Test void constructorsTypedNullAndCollectionSpecificScenarios() throws Exception {
        for(String extra:List.of("",",\"initialCapacity\":0",",\"initialCapacity\":5")) {
            String id=create(extra);
            mvc.perform(post("/api/v1/sessions/"+id+"/commands?encoding=compact").contentType("application/json").content(body("{\"type\":\"ADD\",\"element\":{\"type\":\"NULL\"}}")))
                .andExpect(status().isOk()).andExpect(jsonPath("encoding").value("array-frames-v1"))
                .andExpect(jsonPath("trace.result.kind").value("BOOLEAN")).andExpect(jsonPath("trace.result.booleanValue").value(true))
                .andExpect(jsonPath("trace.committed.capacity").value(extra.isEmpty()?10:extra.endsWith("0")?1:5))
                .andExpect(jsonPath("cellPool[0].element.type").value("NULL"));
            mvc.perform(get("/api/v1/sessions/"+id)).andExpect(jsonPath("state.buffer.cells[0].element.type").value("NULL"));
        }
        mvc.perform(get("/api/v1/scenarios?collection=ARRAY_LIST")).andExpect(jsonPath("$.length()").value(9));
        mvc.perform(get("/api/v1/scenarios")).andExpect(jsonPath("$.length()").value(8));
        mvc.perform(get("/api/v1/scenarios?collection=BOGUS")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/sessions").contentType("application/json").content("{\"collection\":\"BOGUS\"}")).andExpect(status().isBadRequest());
    }
    @Test void unknownCollectionResetPreservesSessionAndErrorContract() throws Exception {
        String id=create(""), base="/api/v1/sessions/"+id;
        var before=sessions.get(UUID.fromString(id));
        mvc.perform(post(base+"/reset").contentType("application/json")
                .content("{\"expectedRevision\":0,\"collection\":\"BOGUS\"}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("schemaVersion").value(1))
            .andExpect(jsonPath("code").value("INVALID_REQUEST"));
        assertEquals(before,sessions.get(UUID.fromString(id)));
    }
    @Test void invalidInputsAndTracePolicyLeaveRevisionUnchanged() throws Exception {
        String id=create(""), base="/api/v1/sessions/"+id;
        for(String op:List.of("{\"type\":\"GET_AT\",\"index\":0}","{\"type\":\"ADD_AT\",\"index\":0.5,\"element\":{\"type\":\"NULL\"}}","{\"type\":\"GET_AT\"}","{\"type\":\"GET_AT\",\"index\":2147483648}","{\"type\":\"ADD\"}","{\"type\":\"PUT\"}","{\"type\":\"ENSURE_CAPACITY\",\"minCapacity\":257}"))
            mvc.perform(post(base+"/commands?encoding=compact").contentType("application/json").content(body(op))).andExpect(status().isBadRequest());
        for(String encoding:List.of("","?encoding=full")) {
            mvc.perform(post(base+"/commands"+encoding).contentType("application/json").content(body("{\"type\":\"CLEAR\"}"))).andExpect(status().isForbidden());
            mvc.perform(post(base+"/scenarios/growth"+encoding).contentType("application/json").content("{\"expectedRevision\":0}")).andExpect(status().isForbidden());
        }
        mvc.perform(post(base+"/commands?encoding=bad").contentType("application/json").content(body("{\"type\":\"CLEAR\"}"))).andExpect(status().isBadRequest());
        mvc.perform(post(base+"/scenarios/treeify?encoding=compact").contentType("application/json").content("{\"expectedRevision\":0}")).andExpect(status().isBadRequest());
        mvc.perform(get(base)).andExpect(jsonPath("revision").value(0)).andExpect(jsonPath("state.size").value(0));
    }
    @Test void extraneousElementsReturn400WithoutChangingStateOrRevision() throws Exception {
        var session=sessions.create(CollectionType.ARRAY_LIST,null,"extraneous-elements-test");
        sessions.execute(session.id(),0,Operation.array(OperationType.ADD,null,Element.of("keep"),null));
        var before=sessions.get(session.id());
        for(var type:List.of(OperationType.GET_AT,OperationType.REMOVE_AT,OperationType.CLEAR,OperationType.RESET,OperationType.ENSURE_CAPACITY,OperationType.TRIM_TO_SIZE)) {
            Integer index=type==OperationType.GET_AT || type==OperationType.REMOVE_AT ? 0 : null;
            Integer capacity=type==OperationType.ENSURE_CAPACITY ? 24 : null;
            for(var element:List.of(Element.of(null),Element.of("unexpected"))) {
                var operation=Operation.array(type,index,element,capacity);
                mvc.perform(post("/api/v1/sessions/"+session.id()+"/commands?encoding=compact")
                    .contentType("application/json").content(json.writeValueAsString(new ApiController.CommandRequest(1L,operation))))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("code").value("INVALID_INPUT"))
                    .andExpect(jsonPath("message").value("Эта операция не принимает element"));
                assertEquals(before,sessions.get(session.id()));
            }
        }
    }
    static Buffer decodeBuffer(int ref, CompactArrayTrace trace) {
        var b=trace.bufferPool().get(ref);
        return new Buffer(b.id(),b.capacity(),b.cellRefs().stream().map(i->i==null?null:trace.cellPool().get(i)).toList());
    }
    static ArrayListSnapshot decode(CompactArrayTrace.Frame f, CompactArrayTrace t) {
        return new ArrayListSnapshot(f.collection(),f.phase(),f.size(),f.capacity(),f.emptyMode(),f.initialCapacity(),decodeBuffer(f.bufferRef(),t),f.pendingBufferRef()==null?null:decodeBuffer(f.pendingBufferRef(),t));
    }
    @Test void compactRoundTripEveryScenarioAndMaximumSearchBudget() throws Exception {
        var engine=new ArrayListEngine();
        for(var scenario:ArrayListEngine.SCENARIOS) checkTrace(engine.scenario(scenario.id()));
        engine=new ArrayListEngine(256);
        for(int i=0;i<128;i++) engine.execute(Operation.array(OperationType.ADD,null,Element.of("\0".repeat(128)),null));
        var search=engine.execute(Operation.array(OperationType.INDEX_OF,null,Element.of("absent"),null));
        var compact=checkTrace(search);
        int compactBytes=json.writeValueAsBytes(compact).length;
        System.out.println("ArrayList worst-case search: compact="+compactBytes+", full="+json.writeValueAsBytes(search).length);
        assertTrue(compactBytes<256*1024, "compact bytes: "+compactBytes);
        assertEquals(1,compact.bufferPool().size());
        assertTrue(json.writeValueAsBytes(search).length>json.writeValueAsBytes(compact).length*10);
    }
    CompactArrayTrace checkTrace(Trace<ArrayListSnapshot> source) {
        var compact=CompactArrayTrace.encode(new SessionStore.SessionTrace<>(1,UUID.randomUUID(),1,source));
        assertEquals(source.before(),decode(compact.trace().before(),compact));
        assertEquals(source.committed(),decode(compact.trace().committed(),compact));
        for(int i=0;i<source.steps().size();i++) {
            var expected=source.steps().get(i); var actual=compact.trace().steps().get(i);
            assertEquals(expected.snapshot(),decode(actual.snapshot(),compact));
            assertEquals(expected.operation(),actual.operation());
            assertEquals(expected.event(),actual.event()); assertEquals(expected.details(),actual.details());
        }
        return compact;
    }
    @Test void collectionIsolationConcurrencyAndExpiry() throws Exception {
        var clock=new SessionStoreTest.MutableClock(); var store=new SessionStore(10,20,20,clock);
        var a=store.create(CollectionType.ARRAY_LIST,null,"test"); var b=store.create(0);
        var latch=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            Callable<Integer> call=()->{ latch.await(); try { store.execute(a.id(),0,Operation.array(OperationType.ADD,null,Element.of("A"),null)); return 200; } catch(SessionStore.ApiException e) { return e.status; } };
            var one=pool.submit(call); var two=pool.submit(call); latch.countDown();
            assertEquals(Set.of(200,409),Set.of(one.get(5,TimeUnit.SECONDS),two.get(5,TimeUnit.SECONDS)));
        }
        assertEquals(0,store.get(b.id()).state().size()); assertEquals(1,store.get(a.id()).state().size());
        clock.millis=10000; store.cleanup(); assertThrows(SessionStore.ApiException.class,()->store.get(a.id()));
    }
}
