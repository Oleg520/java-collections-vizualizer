package dev.collectionsviz.api;

import java.net.URI;
import java.net.http.*;
import java.util.Set;
import java.util.stream.Collectors;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.MeterRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.test.web.server.LocalManagementPort;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={
    "management.server.port=0","visualizer.max-sessions=2","visualizer.max-sessions-per-client=2",
    "visualizer.limits.session-creations=100","visualizer.limits.work-requests=100",
    "visualizer.allow-full-trace=true"})
class ObservabilityIntegrationTest {
    @LocalServerPort int port;
    @LocalManagementPort int managementPort;
    @Autowired MeterRegistry registry;
    @Autowired ObjectMapper json;
    @Autowired ApiAdmission admission;
    @Autowired org.springframework.core.env.Environment environment;
    @Test void privateListenerAndRuntimeMetricsAndBoundedApiDimensions() throws Exception {
        try(var client=HttpClient.newHttpClient()) {
            assertNotEquals(port,managementPort);
            assertEquals("127.0.0.1",environment.getProperty("management.server.address"));
            assertEquals(200,send(client,managementPort,"/actuator/health",null).statusCode());
            assertEquals(200,send(client,managementPort,"/actuator/metrics/jvm.memory.used",null).statusCode());
            // Pause timers are registered lazily after the first GC notification.
            assertNotNull(registry.find("jvm.gc.live.data.size").gauge());
            for(String path:new String[]{"/actuator/metrics","/actuator/health","/actuator/env","/actuator/heapdump"})
                assertEquals(404,send(client,port,path,null).statusCode());
            assertEquals(404,send(client,managementPort,"/actuator/env",null).statusCode());
            assertEquals(404,send(client,managementPort,"/actuator/heapdump",null).statusCode());
            var created=send(client,port,"/api/v1/sessions","{}"); assertEquals(201,created.statusCode());
            String id=json.readTree(created.body()).get("id").asText();
            String base="/api/v1/sessions/"+id;
            for(int i=0;i<2;i++) {
                String encoding=i==0?"compact":"full";
                var result=send(client,port,base+"/scenarios/treeify?encoding="+encoding,"{\"expectedRevision\":"+i+"}");
                assertEquals(200,result.statusCode());
                var summary=registry.get("visualizer.trace.response.bytes").tags("collection","HASH_MAP","encoding",encoding).summary();
                assertEquals(1,summary.count()); assertEquals(result.body().length,summary.totalAmount());
            }
            assertEquals(409,send(client,port,base+"/scenarios/treeify?encoding=compact","{\"expectedRevision\":0}").statusCode());
            assertEquals(1,registry.get("visualizer.api.rejections").tag("code","REVISION_CONFLICT").counter().count());
            var array=send(client,port,"/api/v1/sessions","{\"collection\":\"ARRAY_LIST\"}");
            assertEquals(201,array.statusCode());
            String arrayId=json.readTree(array.body()).get("id").asText();
            for(int i=0;i<2;i++) {
                String encoding=i==0?"compact":"full";
                var result=send(client,port,"/api/v1/sessions/"+arrayId+"/scenarios/growth?encoding="+encoding,
                    "{\"expectedRevision\":"+i+"}");
                assertEquals(200,result.statusCode());
                var summary=registry.get("visualizer.trace.response.bytes").tags("collection","ARRAY_LIST","encoding",encoding).summary();
                assertEquals(1,summary.count()); assertEquals(result.body().length,summary.totalAmount());
            }
            assertEquals(503,send(client,port,"/api/v1/sessions","{}").statusCode());
            assertEquals(1,registry.get("visualizer.api.rejections").tag("code","SESSION_LIMIT").counter().count());
            try(var a=admission.enter("held-a",false); var b=admission.enter("held-b",false)) {
                assertEquals(2,registry.get("visualizer.work.active").gauge().value());
                assertEquals(429,send(client,port,base,null).statusCode());
            }
            assertEquals(0,registry.get("visualizer.work.active").gauge().value());
            assertEquals(2,registry.get("visualizer.sessions.active").gauge().value());
            assertEquals(1,registry.get("visualizer.api.rejections").tag("code","WORK_LIMIT").counter().count());
            for(int i=0;i<20;i++) send(client,port,"/api/v1/unknown-"+i,null);
            var timers=registry.find("http.server.requests").timers(); assertFalse(timers.isEmpty());
            assertTrue(timers.stream().anyMatch(t->"503".equals(t.getId().getTag("status"))));
            assertTrue(timers.stream().anyMatch(t->"429".equals(t.getId().getTag("status"))));
            Set<String> uris=timers.stream().map(t->t.getId().getTag("uri")).collect(Collectors.toSet());
            assertTrue(uris.contains("/api/v1/sessions/{id}/scenarios/{name}"));
            assertTrue(uris.stream().noneMatch(uri->uri.contains(id)||uri.contains("unknown-")||uri.contains("treeify")));
            assertTrue(registry.getMeters().stream().flatMap(m->m.getId().getTags().stream())
                .noneMatch(t->t.getValue().contains(id)||t.getKey().equals("ip")));
        }
    }
    private HttpResponse<byte[]> send(HttpClient client,int target,String path,String body) throws Exception {
        var builder=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+target+path));
        if(body!=null) builder.header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString(body));
        return client.send(builder.build(),HttpResponse.BodyHandlers.ofByteArray());
    }
}
