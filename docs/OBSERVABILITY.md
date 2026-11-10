# Backend diagnostics

The backend uses Spring Boot Actuator and its in-process Micrometer registry.
There is no metrics service, exporter, database or new request logging. Collection
algorithms and API limits are unchanged. The existing `/api/v1/health` remains
public and independent of admission limits.

## Local access

Diagnostics listen on **127.0.0.1:18083**, separately from the API port.
`MANAGEMENT_PORT` may select another unused port; keep it separate from `PORT`
and retain the loopback address. Only `/actuator/health` and `/actuator/metrics`
are exposed. Health details, JMX, env, heap dumps and loggers are not exposed.
No management port is published in Compose. Keep diagnostics outside
public reverse-proxy routes and published container ports.

On the machine running Java:

```bash
curl --fail http://127.0.0.1:18083/actuator/health
curl --fail http://127.0.0.1:18083/actuator/metrics
curl --fail http://127.0.0.1:18083/actuator/metrics/visualizer.sessions.active
```

In Compose the listener is inside the container's network namespace. Use a
local container debugging tool in that namespace; there is no host management
port. Local processes with access to the namespace can read these diagnostics;
there is no application-level authentication on the loopback listener.

## Metrics and interpretation

| Meter | Meaning and fixed dimensions |
|---|---|
| `visualizer.sessions.active` | Occupied SessionStore entries. Expired entries remain counted until normal TTL cleanup/access removes them; scraping never runs cleanup or acquires session locks. Compare with configured `MAX_SESSIONS`. |
| `visualizer.work.active` | Admitted concurrent requests, including compact encoding and JSON writing. Compare with `MAX_CONCURRENT_WORK`. No per-client series. |
| `visualizer.api.admissions` | Requests admitted by the filter, `kind=creation/work`; includes requests later rejected by MVC or SessionStore. |
| `visualizer.api.rejections` | Fixed `(status,code)` pairs: 429 with `RATE_LIMITED`, `WORK_LIMIT`, `CLIENT_TRACKING_LIMIT`, `CLIENT_SESSION_LIMIT`; 409 with `REVISION_CONFLICT`; 503 with `SESSION_LIMIT`. Counts an HTTP rejection once, before writing its JSON. |
| `http.server.requests` | Standard Boot request timer: count and total/max duration in seconds. Approximate rolling p50/p95 are exposed as `http.server.requests.percentile` gauges with `phi=0.5/0.95`. Includes admission failures and response serialization. URI tags are MVC route templates, or bounded fallback values for unmapped/rejected requests. Includes health and management traffic; select a URI to inspect API traffic. |
| `visualizer.trace.response.bytes` | Count, total and max **uncompressed UTF-8 JSON response bytes**, including the envelope. Fixed `collection=HASH_MAP/ARRAY_LIST`, `encoding=compact/full`. Counts only completed trace responses. No histogram or trace retention. |
| `visualizer.trace.write.failures` | Trace response writing did not complete normally; same four collection/encoding combinations. An incomplete write is excluded from the size summary. |
| `jvm.memory.*`, `jvm.gc.*` | Standard Boot memory pool and GC metrics. Pause timers appear after GC notifications. Other standard runtime meters include threads, process CPU and uptime. RSS is measured separately via OS tools. |

Examples (URL-encode additional tag values when needed):

```bash
curl --fail 'http://127.0.0.1:18083/actuator/metrics/visualizer.api.rejections?tag=code:WORK_LIMIT'
curl --fail 'http://127.0.0.1:18083/actuator/metrics/http.server.requests?tag=status:503'
curl --fail 'http://127.0.0.1:18083/actuator/metrics/http.server.requests.percentile?tag=phi:0.95&tag=uri:/api/v1/health&tag=method:GET&tag=status:200'
curl --fail 'http://127.0.0.1:18083/actuator/metrics/visualizer.trace.response.bytes?tag=encoding:compact'
curl --fail 'http://127.0.0.1:18083/actuator/metrics/jvm.memory.used?tag=area:heap'
curl --fail http://127.0.0.1:18083/actuator/metrics/jvm.gc.pause
```

429 denotes expected overload protection, 409 denotes revision recovery, and
503 `SESSION_LIMIT` denotes exhausted session slots. Use the standard timer's
5xx counts to detect other backend failures. Request duration covers the server
filter/MVC stack, not browser transfer or playback. A completed write means the
servlet chain returned successfully, not that the browser received every byte.
Compression and low-level disconnects can finish outside the servlet chain.
Select one URI/method/status and phi when reading percentile gauges: sums of
percentiles across routes do not describe an API-wide percentile.

Counters and totals reset when the process restarts; percentile/max values have
Micrometer time windows. There is no historical storage or alerting. The latency
percentiles use bounded sketches per standard HTTP meter, rather than exported
histogram buckets. No IP, UUID, scenario value, user data, raw request URL or
exception message is added as a custom tag or log field.

## Verification and overhead

`ObservabilityIntegrationTest` starts real application and management listeners,
checks the private configuration, main-port 404s, endpoint allowlist, JVM metrics,
HTTP latency, actual 409/429/503 counts, bounded URI tags, and exact byte counts
for both collections and encodings. Unit tests cover lifecycle gauges, rejection
cardinality, streaming a large response, resets and failed writes; existing API
limit/concurrency tests continue to check serialization coverage and recovery.

Reproduce the comparison against a baseline JAR from unmodified main:

```bash
python3 scripts/profile-observability.py \
  --baseline /tmp/jcv-baseline.jar \
  --candidate "$(sh scripts/backend-jar.sh)" \
  --java-home "$JAVA_HOME"
```

Use disposable local builds, with ports 18090/18091 free. The script starts and
stops its own processes, uses a 256 MiB heap and one visible processor, and raises
rate limits equally **only in these local processes**. It alternates baseline /
candidate / candidate / baseline, warms up 1000 requests per process, measures
2000 mixed HashMap/ArrayList compact scenarios, records CPU/RSS/retained heap,
and checks a large split response and gzip. Explicit local `jcmd GC.run` calls
bound retained-heap measurements; they are outside the timed request interval.

Results against main `49b5f3f` (OpenJDK 21.0.13, Serial GC, Linux x86_64;
full hardware/JAR hashes in the [local comparison](verification/backend-observability.json)):

| Measurement, two runs each | Baseline | Observability |
|---|---:|---:|
| HTTP p50 | 1.516–1.649 ms | 1.555–1.577 ms |
| HTTP p95 | 2.152–2.461 ms | 2.219–2.259 ms |
| Process CPU / 2000 measured requests | 2.41–2.60 s | 2.79–2.89 s |
| Retained heap after measured batch | 14.73 MiB | 18.70–18.71 MiB |
| RSS after measured batch and explicit GC | 189.2–193.0 MiB | 214.5–218.1 MiB |

Mean process CPU increased about 13% (0.17 ms/request), retained heap about
4 MiB and RSS about 25 MiB. Latency ranges overlap; this does not establish a
latency improvement. Both builds produced identical response byte counts,
including a 1,433,743-byte split trace, and passed gzip checks. Candidate runs
also verified the management socket's loopback binding via the Linux socket table.
No additional response buffer or trace traversal is introduced by measurement.
Short local measurements include JIT, host scheduling and JVM attach noise;
they do not establish an SLA, long-term absence of leaks or hosting capacity.

References: [Spring Boot metrics](https://docs.spring.io/spring-boot/3.5/reference/actuator/metrics.html),
[management listener configuration](https://docs.spring.io/spring-boot/3.5/how-to/actuator.html).
