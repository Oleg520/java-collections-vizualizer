package dev.collectionsviz.api;

import java.util.*;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.info.BuildProperties;
import org.springframework.web.bind.annotation.*;
import dev.collectionsviz.core.CollectionRegistry;
import dev.collectionsviz.core.Protocol.*;

@RestController
@RequestMapping("/api/v1")
public class ApiController {
    public record CreateRequest(CollectionType collection, Integer initialCapacity) {}
    public record ResetRequest(@NotNull @PositiveOrZero Long expectedRevision, @NotNull CollectionType collection, Integer initialCapacity) {}
    public record CommandRequest(@NotNull @PositiveOrZero Long expectedRevision, @NotNull Operation operation) {}
    public record ScenarioRequest(@NotNull @PositiveOrZero Long expectedRevision) {}
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
            throw new SessionStore.ApiException(403,"FULL_TRACE_DISABLED",
                "Полный trace отключён. Используйте encoding=compact.");
        return compact;
    }
    @GetMapping("/health") public Map<String,String> health() { return Map.of("status","UP","version",build.getVersion(),"java",Runtime.version().feature()+""); }
    @GetMapping("/scenarios") public List<Scenario> scenarios(@RequestParam(defaultValue="HASH_MAP") CollectionType collection) { return CollectionRegistry.STANDARD.require(collection).scenarios(); }
    @PostMapping("/sessions") @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
    public SessionStore.SessionState create(@RequestBody(required=false) CreateRequest request,HttpServletRequest httpRequest) {
        return sessions.create(request==null ? CollectionType.HASH_MAP : request.collection(), request==null ? null : request.initialCapacity(),
            (String)httpRequest.getAttribute(ApiLimitFilter.CLIENT_ATTRIBUTE));
    }
    @GetMapping("/sessions/{id}") public SessionStore.SessionState get(@PathVariable UUID id) { return sessions.get(id); }
    @PostMapping("/sessions/{id}/reset")
    public SessionStore.SessionState reset(@PathVariable UUID id,@Valid @RequestBody ResetRequest request,HttpServletRequest httpRequest) {
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
