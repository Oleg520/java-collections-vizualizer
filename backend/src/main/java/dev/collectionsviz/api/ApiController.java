package dev.collectionsviz.api;

import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import dev.collectionsviz.core.HashMapEngine;
import dev.collectionsviz.core.Protocol.*;

@RestController
@RequestMapping("/api/v1")
public class ApiController {
    public record CreateRequest(Integer initialCapacity) {}
    public record CommandRequest(@NotNull @PositiveOrZero Long expectedRevision, @NotNull Operation operation) {}
    public record ScenarioRequest(@NotNull @PositiveOrZero Long expectedRevision) {}
    private final SessionStore sessions;
    public ApiController(SessionStore sessions) { this.sessions=sessions; }
    @GetMapping("/health") public Map<String,String> health() { return Map.of("status","UP","version","0.1.0","java",Runtime.version().feature()+""); }
    @GetMapping("/scenarios") public List<Scenario> scenarios() { return HashMapEngine.SCENARIOS; }
    @PostMapping("/sessions") @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
    public SessionStore.SessionState create(@RequestBody(required=false) CreateRequest request) {
        return sessions.create(request==null || request.initialCapacity()==null ? 0 : request.initialCapacity());
    }
    @GetMapping("/sessions/{id}") public SessionStore.SessionState get(@PathVariable UUID id) { return sessions.get(id); }
    @PostMapping("/sessions/{id}/commands")
    public Object command(@PathVariable UUID id,@Valid @RequestBody CommandRequest request,
                          @RequestParam(defaultValue="full") String encoding) {
        boolean compact = CompactTrace.requested(encoding); // Validate before committing a command.
        var response = sessions.execute(id,request.expectedRevision(),request.operation());
        return compact ? CompactTrace.encode(response) : response;
    }
    @PostMapping("/sessions/{id}/scenarios/{name}")
    public Object scenario(@PathVariable UUID id,@PathVariable String name,@Valid @RequestBody ScenarioRequest request,
                           @RequestParam(defaultValue="full") String encoding) {
        boolean compact = CompactTrace.requested(encoding);
        var response = sessions.scenario(id,request.expectedRevision(),name);
        return compact ? CompactTrace.encode(response) : response;
    }
}
