# HashMap physical identity — Issue #55

HashMap now has one contract: schemaVersion=2, node-table-v2. There is no V1
projection/decoder. `id` tracks a logical entry; `objectId` tracks a physical Java
object. Structural links, bucket heads/roots and drawing endpoints use objectId.
Two objects for one entry may coexist in WORKING. The snapshot assembler captures
all five reference fields and places each physical object once; it never rewrites
the HashMap algorithm. Placement in a temporary area is not Java bucket ownership.
`linked=false` means outside a table chain, not necessarily removed.

## Local manual reproduction (never published)

With JDK 21 and the repository's Node version:

```sh
./mvnw -B verify
java -jar "$(sh scripts/backend-jar.sh)" --server.address=127.0.0.1
npm --prefix frontend run dev -- --port 5173 --strictPort
```

Open **http://127.0.0.1:5173/__dev/hashmap-split**. This separate Vite serve-only
entry creates a capacity-64 Java session and executes real PUT commands:
L0…L5 (or L0…L1), hash=1; H0…H6, hash=65; filler F entries, hash=2+i%30,
until size=49. Values are L/H/F. The final PUT resizes 64→128. No scenario or
special mutation endpoint was added to the backend or the public scenario catalog.
A preparation failure stops the sequence; unknown mutations are never replayed.

1. Click **Загрузить split 6/7** or **Загрузить split 2/7**.
2. Click **Кадр 11 (шаг 12)**. Indices are zero based; the regular counter is one based.
   This TREE_DIRECTION frame used to lose 4→2, 4→8, 2→1, 2→3 (6/7) or
   2→1, 2→3 (2/7), where these old labels were logical IDs.
3. The duplicate-representation panel shows logical IDs with distinct objectIds.
   For 6/7 inspect logical entry 4; for 2/7 inspect entry 2. Select both copies
   independently; **К выбранному узлу** scrolls to the selected object. Dashed
   nodes labelled **вне цепочки** are temporary objects. Their outgoing L/R edges
   target physical objects, including objects in another area.
4. The lab initially filters the diagram to areas 1/65 to keep both ends of
   cross-area links nearby. The checkbox restores the complete snapshot view;
   size always refers to the complete Map. The recorded trace is never filtered.
5. Step backwards/forwards, seek to the end (49 logical entries), return to frame
   11, select an earlier operation in history, and use **Прочитать сервер (GET)**.
   Playback/history never send writes. Details fall back to a live replacement
   when the preferred object disappears, then return to the preferred object on rewind.

Key boundaries: frame 0 is before the final PUT; frame 11 is the asymmetric
working split; the final OPERATION_COMPLETED is the committed state. Intermediate
red-black invariants are intentionally not required of every WORKING frame.

The lab import is gated by both import.meta.env.DEV and a Vite command=serve
constant. Any build (including a nonstandard NODE_ENV) excludes it. A
`generateBundle` assertion rejects artifacts containing its route/module/marker.
The preview browser test verifies that this URL serves the ordinary application,
with no lab controls. Test fixtures and measurement scripts are not application assets.

## Verification

- Core: exact asymmetric/mirrored splits 6/7, 2/7, 7/6, 7/2, 6/6, 7/7 and empty
  halves; every-frame pointer resolution/unique objects; direct comparison with
  the actual Java objects at observer callbacks; logical continuity/new physical
  identity on replacement; no ID reuse after engine RESET; existing randomized JDK
  differential and final red-black invariants retained.
- Backend: physical graph roundtrips for asymmetric and maximum splits; strict
  current wire fixture; missing/old/future version rejection before writes,
  scenarios and reset-to-ArrayList; full trace admission remains unchanged.
- Frontend: exact physical endpoints, cross-area edges, selection/fallback/rewind,
  duplicate-address rejection, retired encoding rejection, health check before POST.
- Playwright: desktop/mobile, reduced motion, two copies and restored edges,
  forward/backward seeks, history/GET, compatibility rejection, existing lost-response
  and recovery cases. The broad suite and strict lifecycle suite are separate.

## Resource probe

[Raw samples](hashmap-physical-identity.json): five isolated JVM/Node samples per
version, compared with main f3e8459. Temurin 21.0.13, Serial GC, Xmx256m;
Node 24.21.0 with explicit GC. Each JVM warms twice on the same 97-entry sequence.
Maximum-length escaped strings match the existing transport-budget test. History
retains the last 12 operations (1315 frames). Numbers below are local medians,
not a latency guarantee; GC/JIT and concurrent local work cause timing variation.

| Measure | main | Issue #55 |
|---|---:|---:|
| Final split steps | 990 | 990 |
| Compact bytes | 3,155,533 | 3,193,440 (+1.2%) |
| Node pool versions | 830 | 830 |
| Final execute including snapshots | 18.06 ms | 15.53 ms |
| Final compact encoding | 2.97 ms | 3.18 ms |
| Retained Java history heap | 14,007,416 B | 14,975,776 B |
| Retained decoded JS history heap | 3,586,120 B | 3,652,184 B |
| Decode all history frames | 4.14 ms | 20.70 ms |
| Layout all history frames | 44.56 ms | 45.80 ms |

The extra decode work validates unique physical IDs and link targets, not Java
algorithms. These whole-history times are not per-frame times. The existing
8 MiB compact response / 5000 pool-version guards still pass. No production limit
was changed. The asymmetric cases additionally assert a bounded physical graph.
The probe does not establish the absence of long-running leaks or an exhaustive
worst case across all legal sessions.

Reproduce the Java probe after building/installing the reactor and obtaining the
backend dependency classpath:

```sh
./mvnw -B install -DskipTests
./mvnw -pl backend dependency:build-classpath -Dmdep.outputFile=/tmp/hashmap-classpath
mkdir -p /tmp/hashmap-probe
java -Xmx256m -XX:+UseSerialGC \
  -cp "core/target/classes:backend/target/classes:$(cat /tmp/hashmap-classpath)" \
  scripts/HashMapIdentityBenchmark.java /tmp/hashmap-probe
frontend/node_modules/.bin/tsc frontend/src/features/hashmap/layout.ts \
  frontend/src/api/trace/hashmap.ts --outDir /tmp/hashmap-probe/js \
  --module commonjs --target es2022 --skipLibCheck
node --expose-gc scripts/measure-hashmap-frontend.cjs /tmp/hashmap-probe
```

Run the same helper against an isolated main checkout's target/classes for the
baseline (and compile that checkout's frontend files for its decoder/layout).

## Update order and old tabs

Update backend first, then frontend, then reload open tabs. Old HashMap requests
receive 426 API_VERSION_MISMATCH before state/revision changes. New frontend
checks health.hashMapSnapshotVersion before sending a write, so an old backend
receives no POST. The server additionally checks each request under the session
lock; reset checks source and target collection. If delivery is uncertain, the
existing recovery path performs GET only and blocks further writes when it cannot
reconcile. There is no automatic downgrade or replay. Neither update nor deployment
is performed by this change.

## Recorded local checks

- Maven clean verify: 24 core + 44 backend tests passed.
- Frontend: 73 unit tests passed; standard production build passed.
- Desktop/mobile development E2E: 66 passed; strict lifecycle: 2 passed.
- Production preview: 12 selected checks passed, including absence of lab controls,
  the exact build version and all public Java demos at every constructor setting.
- NODE_ENV=development build also passed the lab-exclusion assertion; normal build
  was restored afterwards. OpenAPI parsed and all local references resolved.
- Python script suite: 14 passed; profiling clients migrated to the required query
  version. Compose configuration validated. Docker image build was not run locally.

Chromium needed the already available local shared-library directory. This local
network drops connections to closed localhost ports rather than refusing them;
strict-suite auto-start used an external, temporary Node preload to bound ONLY
initial GET health/root readiness probes. It changes no application behavior or
test assertions and is not committed or needed in the normal CI environment.
