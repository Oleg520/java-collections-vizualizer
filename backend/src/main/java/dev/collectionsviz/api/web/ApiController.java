package dev.collectionsviz.api.web;

import dev.collectionsviz.api.dto.CreateRequest;
import dev.collectionsviz.api.dto.ResetRequest;
import dev.collectionsviz.api.dto.CommandRequest;
import dev.collectionsviz.api.dto.ScenarioRequest;
import dev.collectionsviz.api.dto.SessionState;
import dev.collectionsviz.api.session.SessionStore;
import dev.collectionsviz.api.error.ApiException;
import dev.collectionsviz.api.trace.CompactTraceRegistry;
import dev.collectionsviz.core.registry.CollectionRegistry;
import dev.collectionsviz.core.protocol.Scenario;
import dev.collectionsviz.core.protocol.CollectionType;

import java.util.*;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.info.BuildProperties;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class ApiController {
    private final SessionStore sessions;
    private final BuildProperties build;
    private final boolean allowFullTrace;
    public ApiController(SessionStore sessions, BuildProperties build,
                         @Value("${visualizer.allow-full-trace:false}") boolean allowFullTrace) {
        this.sessions=sessions; this.build=build; this.allowFullTrace=allowFullTrace;
    }
    private boolean compactEncoding(String encoding) {
        boolean compact=CompactTraceRegistry.requested(encoding);
        if (!compact && !allowFullTrace)
            throw new ApiException(403,"FULL_TRACE_DISABLED",
                "Полный trace отключён. Используйте encoding=compact.");
        return compact;
    }
    @GetMapping("/health") public Map<String,String> health() { return Map.of("status","UP","version",build.getVersion(),"java",Runtime.version().feature()+""); }
    @GetMapping("/scenarios") public List<Scenario> scenarios(@RequestParam(defaultValue="HASH_MAP") CollectionType collection) { return CollectionRegistry.STANDARD.require(collection).scenarios(); }
    @PostMapping("/sessions") @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
    public SessionState create(@RequestBody(required=false) CreateRequest request,HttpServletRequest httpRequest) {
        return sessions.create(request==null ? CollectionType.HASH_MAP : request.collection(), request==null ? null : request.initialCapacity(),
            (String)httpRequest.getAttribute(ApiLimitFilter.CLIENT_ATTRIBUTE));
    }
    @GetMapping("/sessions/{id}") public SessionState get(@PathVariable UUID id) { return sessions.get(id); }
    @PostMapping("/sessions/{id}/reset")
    public SessionState reset(@PathVariable UUID id,@Valid @RequestBody ResetRequest request,HttpServletRequest httpRequest) {
        return sessions.reset(id,request.expectedRevision(),request.collection(),request.initialCapacity(),
            (String)httpRequest.getAttribute(ApiLimitFilter.CLIENT_ATTRIBUTE));
    }
    @PostMapping("/sessions/{id}/commands")
    public Object command(@PathVariable UUID id,@Valid @RequestBody CommandRequest request,
                          @RequestParam(defaultValue="full") String encoding) {
        boolean compact = compactEncoding(encoding); // Validate before committing a command.
        var response = sessions.execute(id,request.expectedRevision(),request.operation());
        return compact ? CompactTraceRegistry.STANDARD.encode(response) : response;
    }
    @PostMapping("/sessions/{id}/scenarios/{name}")
    public Object scenario(@PathVariable UUID id,@PathVariable String name,@Valid @RequestBody ScenarioRequest request,
                           @RequestParam(defaultValue="full") String encoding) {
        boolean compact = compactEncoding(encoding);
        var response = sessions.scenario(id,request.expectedRevision(),name);
        return compact ? CompactTraceRegistry.STANDARD.encode(response) : response;
    }
}
