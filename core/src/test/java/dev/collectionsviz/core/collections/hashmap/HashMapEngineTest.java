package dev.collectionsviz.core.collections.hashmap;

import dev.collectionsviz.core.protocol.Step;
import dev.collectionsviz.core.protocol.Trace;
import dev.collectionsviz.core.protocol.command.Operation;
import dev.collectionsviz.core.protocol.command.OperationType;
import dev.collectionsviz.core.protocol.command.KeySpec;
import dev.collectionsviz.core.protocol.command.KeyType;

import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class HashMapEngineTest {
    static Trace<HashMapSnapshot> op(HashMapEngine engine, OperationType type, KeySpec key, String value) {
        return engine.execute(new Operation(type,key,value));
    }
    static Trace<HashMapSnapshot> put(HashMapEngine engine,String key,int hash) {
        return op(engine,OperationType.PUT,KeySpec.collision(key,hash),key);
    }
    static boolean has(Trace<HashMapSnapshot> trace,String event) { return trace.steps().stream().anyMatch(s->s.event().equals(event)); }
    static List<NodeView> nodes(HashMapSnapshot state) { return state.buckets().stream().flatMap(b->b.nodes().stream()).toList(); }
    static void invariant(HashMapSnapshot state) {
        assertEquals("COMMITTED",state.phase());
        assertEquals(0,state.pendingCapacity());
        assertTrue(state.pendingBuckets().isEmpty());
        assertEquals(state.size(),nodes(state).size());
        Set<Long> ids=new HashSet<>();
        Set<KeySpec> keys=new HashSet<>();
        for(var b:state.buckets()) {
            Map<Long,NodeView> nodes=new HashMap<>();
            for(var n:b.nodes()) {
                assertTrue(ids.add(n.id()),"unique ID"); assertTrue(keys.add(n.key()),"unique key");
                assertEquals(b.index(),(state.capacity()-1)&n.hash()); assertTrue(n.linked()); nodes.put(n.objectId(),n);
                assertEquals(n.rawHashCode() ^ (n.rawHashCode() >>> 16),n.hash());
            }
            Set<Long> chain=new HashSet<>(); Long id=b.headId(),prev=null;
            while(id!=null) {
                assertTrue(chain.add(id),"acyclic next chain");
                var n=nodes.get(id); assertNotNull(n);
                if(b.kind().equals("TREE")) assertEquals(prev,n.prev());
                prev=id; id=n.next();
            }
            assertEquals(nodes.keySet(),chain);
            if(b.kind().equals("TREE")) {
                var root=nodes.get(b.rootId()); assertNotNull(root); assertNull(root.parent()); assertFalse(root.red());
                assertEquals(b.headId(),b.rootId());
                Set<Long> visited=new HashSet<>();
                blackHeight(root,null,nodes,visited);
                assertEquals(chain,visited,"all chain nodes belong to tree");
            } else for(var n:b.nodes()) { assertNull(n.parent()); assertNull(n.red()); }
        }
    }
    static int blackHeight(NodeView node,Long parent,Map<Long,NodeView> nodes,Set<Long> visited) {
        if(node==null) return 1;
        assertTrue(visited.add(node.objectId()),"acyclic tree"); assertEquals(parent,node.parent());
        var left=nodes.get(node.left()); var right=nodes.get(node.right());
        if(node.left()!=null) { assertNotNull(left); assertTrue(left.hash()<=node.hash()); }
        if(node.right()!=null) { assertNotNull(right); assertTrue(right.hash()>=node.hash()); }
        if(node.red()) { if(left!=null) assertFalse(left.red()); if(right!=null) assertFalse(right.red()); }
        int l=blackHeight(left,node.objectId(),nodes,visited),r=blackHeight(right,node.objectId(),nodes,visited);
        assertEquals(l,r,"equal black height at "+node.id()); return l+(node.red()?0:1);
    }
    @Test void lazyAllocationHashNullAndUpdate() {
        var e=new HashMapEngine(); assertEquals(0,e.snapshot().capacity()); assertEquals(0,e.snapshot().threshold());
        assertNull(op(e,OperationType.GET,KeySpec.string("missing"),null).result().value()); assertEquals(0,e.snapshot().capacity());
        var nil=new KeySpec(KeyType.NULL,null,null);
        var t=op(e,OperationType.PUT,nil,null); assertFalse(t.result().found());
        assertEquals(16,e.snapshot().capacity()); assertEquals(12,e.snapshot().threshold());
        assertTrue(op(e,OperationType.GET,nil,null).result().found());
        long id=nodes(e.snapshot()).getFirst().id();
        t=op(e,OperationType.PUT,nil,"value"); assertTrue(t.result().found()); assertEquals(1,e.snapshot().size());
        assertEquals(id,nodes(e.snapshot()).getFirst().id());
        put(e,"negative",Integer.MIN_VALUE); put(e,"spread",0x12340000); invariant(e.snapshot());
        assertEquals("value",op(e,OperationType.REMOVE,nil,null).result().previousValue());
        assertFalse(op(e,OperationType.REMOVE,nil,null).result().found());
    }
    @Test void collisionEqualityAndHashRegistry() {
        var e=new HashMapEngine(); put(e,"A",42); put(e,"B",42);
        assertEquals(2,e.snapshot().size()); assertEquals(1,e.snapshot().buckets().size());
        assertEquals("A",put(e,"A",42).result().previousValue());
        var before=e.snapshot(); assertThrows(IllegalArgumentException.class,()->put(e,"A",43)); assertEquals(before,e.snapshot());
        op(e,OperationType.REMOVE,KeySpec.collision("A",42),null);
        assertThrows(IllegalArgumentException.class,()->put(e,"A",43));
        op(e,OperationType.RESET,null,null); put(e,"A",43); invariant(e.snapshot());
    }
    @Test void resizeSplitsPreservesIdsAndSnapshots() {
        var e=new HashMapEngine(); var t=e.scenario("resize");
        assertEquals(32,t.committed().capacity()); assertEquals(13,t.committed().size());
        var splits=t.steps().stream().filter(s->s.event().equals("BUCKET_SPLIT")).toList();
        assertTrue(splits.stream().anyMatch(s->s.details().get("fromBucket").equals(1)&&s.details().get("toBucket").equals(17)));
        assertTrue(splits.stream().anyMatch(s->s.details().get("fromBucket").equals(1)&&s.details().get("toBucket").equals(1)));
        var first=t.steps().stream().filter(s->s.event().equals("RESIZE_STARTED")).findFirst().orElseThrow().snapshot();
        Map<KeySpec,Long> ids=new HashMap<>(); nodes(first).forEach(n->ids.put(n.key(),n.id()));
        nodes(t.committed()).forEach(n->{ if(ids.containsKey(n.key())) assertEquals(ids.get(n.key()),n.id()); });
        assertEquals(16,first.capacity()); assertEquals(13,first.size());
        assertTrace(t,e); invariant(e.snapshot());
    }
    @Test void exactNinthInsertionTreeifyAndSmallTableDeferral() {
        var e=new HashMapEngine(64);
        for(int i=1;i<=8;i++) put(e,"K"+i,42);
        assertEquals("LIST",e.snapshot().buckets().getFirst().kind());
        var ids=nodes(e.snapshot()).stream().map(NodeView::id).toList();
        var t=put(e,"K9",42); assertTrue(has(t,"TREEIFY_COMPLETED")); assertTrue(has(t,"TREE_ROTATED")); assertTrue(has(t,"TREE_RECOLORED"));
        assertTrue(nodes(e.snapshot()).stream().map(NodeView::id).toList().containsAll(ids)); invariant(e.snapshot());
        var small=new HashMapEngine(); for(int i=1;i<=8;i++) put(small,"K"+i,42);
        t=put(small,"K9",42); assertTrue(has(t,"TREEIFY_DEFERRED")); assertFalse(has(t,"TREEIFY_COMPLETED")); assertEquals(32,small.snapshot().capacity());
        put(small,"K10",42); assertEquals(64,small.snapshot().capacity()); assertEquals("LIST",small.snapshot().buckets().getFirst().kind());
        assertTrue(has(put(small,"K11",42),"TREEIFY_COMPLETED")); invariant(small.snapshot());
    }
    @Test void treeSplitCountAndRemovalShapeAreDifferentRules() {
        for(int half:List.of(6,9)) {
            var e=new HashMapEngine(64);
            for(int i=0;i<half*2;i++) put(e,"C"+i,i%2==0?1:65);
            Map<KeySpec,Long> ids=new HashMap<>(); nodes(e.snapshot()).forEach(n->ids.put(n.key(),n.id()));
            Trace<HashMapSnapshot> t=null;
            for(int i=2;e.snapshot().size()<49;i++) t=put(e,"F"+i,i);
            assertEquals(128,e.snapshot().capacity());
            for(int index:List.of(1,65)) {
                var bucket=e.snapshot().buckets().stream().filter(b->b.index()==index).findFirst().orElseThrow();
                assertEquals(half<=6?"LIST":"TREE",bucket.kind()); assertEquals(half,bucket.nodes().size());
                bucket.nodes().forEach(n->assertEquals(ids.get(n.key()),n.id()));
            }
            assertEquals(half<=6,has(t,"UNTREEIFIED")); invariant(e.snapshot());
            // No mapping may disappear while local split halves are being rebuilt.
            for (var step:t.steps()) if (step.event().equals("UNTREEIFIED") || step.event().equals("TREE_ROTATED")) {
                Set<Long> visible=new HashSet<>();
                step.snapshot().buckets().forEach(b->b.nodes().forEach(n->visible.add(n.id())));
                step.snapshot().pendingBuckets().forEach(b->b.nodes().forEach(n->visible.add(n.id())));
                assertEquals(49,visible.size(),"all resize mappings visible at " + step.event());
            }
        }
        Set<Integer> counts=new HashSet<>();
        for(int seed=0;seed<12;seed++) {
            var e=new HashMapEngine(64); var order=new ArrayList<Integer>();
            for(int i=0;i<16;i++) {put(e,"K"+i,42); order.add(i);}
            Collections.shuffle(order,new Random(seed));
            for(int i:order) {
                var t=op(e,OperationType.REMOVE,KeySpec.collision("K"+i,42),null);
                if(has(t,"UNTREEIFIED")) {
                    counts.add(e.snapshot().size());
                    assertTrue(t.steps().stream().anyMatch(s->"REMOVAL_SHAPE".equals(s.details().get("reason"))));
                }
                invariant(e.snapshot());
            }
        }
        assertTrue(counts.stream().anyMatch(n->n!=6),"removal is not a universal six-node rule");
    }
    @Test void differentialRandomizedAgainstJava21HashMap() {
        var e=new HashMapEngine(64); Map<Object,String> reference=new HashMap<>(64);
        var keys=new ArrayList<KeySpec>(); keys.add(new KeySpec(KeyType.NULL,null,null));
        for(int i=0;i<60;i++) keys.add(KeySpec.collision("K"+i,i<40?42:i%4==0?65:1));
        for(int i=0;i<10;i++) { keys.add(KeySpec.string("S"+i)); keys.add(new KeySpec(KeyType.INTEGER,""+(i-5),null)); }
        var random=new Random(210042);
        for(int i=0;i<2400;i++) {
            var k=keys.get(random.nextInt(keys.size()));
            Object key=switch(k.type()) {case NULL->null;case COLLISION->new TeachingKey(k.value(),k.hashCodeOverride());case INTEGER->Integer.valueOf(k.value());case STRING->k.value();};
            var type=OperationType.values()[random.nextInt(3)]; String value=random.nextInt(4)==0?null:"v"+i;
            boolean found=reference.containsKey(key);
            String expected=switch(type) {case PUT->reference.put(key,value);case GET->reference.get(key);case REMOVE->reference.remove(key);default->throw new AssertionError();};
            var t=op(e,type,k,value); assertEquals(found,t.result().found(),"found at "+i);
            assertEquals(expected,type==OperationType.GET?t.result().value():t.result().previousValue(),"result at "+i);
            assertEquals(reference.size(),e.snapshot().size()); invariant(e.snapshot()); assertTrace(t,e);
        }
    }
    @Test void clearKeepsCapacityResetReleasesItAndIdsNeverRecycle() {
        var e=new HashMapEngine(); put(e,"A",42); long first=nodes(e.snapshot()).getFirst().id();
        op(e,OperationType.CLEAR,null,null); assertEquals(16,e.snapshot().capacity()); assertEquals(0,e.snapshot().size());
        op(e,OperationType.RESET,null,null); assertEquals(0,e.snapshot().capacity());
        put(e,"A",42); assertTrue(nodes(e.snapshot()).getFirst().id()>first);
    }
    @Test void allScenariosAreExecutableAndDeterministicAtEveryInitialCapacity() {
        for (int capacity : List.of(0,16,32,64)) for (var scenario : HashMapEngine.SCENARIOS) {
            var a = new HashMapEngine(capacity); var b = new HashMapEngine(capacity);
            put(a,"pre-existing",7); put(b,"pre-existing",7);
            var ta=a.scenario(scenario.id()); var tb=b.scenario(scenario.id());
            assertEquals(ta,tb); assertTrace(ta,a); invariant(a.snapshot());
            var events=ta.steps().stream().map(Step::event).toList();
            switch (scenario.id()) {
                case "resize" -> {
                    assertEquals(32,ta.committed().capacity()); assertEquals(13,ta.committed().size());
                    assertTrue(events.contains("RESIZE_COMPLETED"));
                    assertTrue(ta.steps().stream().anyMatch(step -> step.event().equals("BUCKET_SPLIT")
                        && step.details().get("fromBucket").equals(1) && step.details().get("toBucket").equals(17)));
                }
                case "why-no-tree" -> {
                    assertEquals(32,ta.committed().capacity()); assertEquals(9,ta.committed().size());
                    assertTrue(events.contains("TREEIFY_DEFERRED")); assertFalse(events.contains("TREEIFY_COMPLETED"));
                }
                case "treeify", "tree-search", "tree-remove" -> {
                    assertTrue(events.contains("TREEIFY_COMPLETED")); assertEquals(64,ta.committed().capacity());
                    if (scenario.id().equals("tree-search")) { assertTrue(ta.result().found()); assertEquals("v7",ta.result().value()); }
                    if (scenario.id().equals("tree-remove")) { assertEquals(1,ta.committed().size()); assertTrue(events.contains("UNTREEIFIED")); }
                }
                default -> assertEquals(16,ta.committed().capacity());
            }
            op(a,OperationType.RESET,null,null);
            assertEquals(capacity,a.snapshot().threshold(),"demo must not change the session constructor setting");
            put(a,"after-reset",3); assertEquals(capacity == 0 ? 16 : capacity,a.snapshot().capacity());
        }
    }
    @Test void limitsRejectAtomicallyAndUpdatesStillWorkAtCapacity() {
        var e=new HashMapEngine();
        for(int i=0;i<128;i++) put(e,"K"+i,42);
        var before=e.snapshot();
        assertThrows(IllegalArgumentException.class,()->put(e,"overflow",42));
        assertEquals(before,e.snapshot());
        assertTrue(put(e,"K1",42).result().found());
        assertEquals(128,e.snapshot().size()); invariant(e.snapshot());
        assertThrows(IllegalArgumentException.class,()->op(e,OperationType.PUT,KeySpec.string("long"),"x".repeat(129)));
        assertEquals(before,e.snapshot());
        var registry=new HashMapEngine();
        for(int i=0;i<512;i++) op(registry,OperationType.GET,KeySpec.collision("R"+i,42),null);
        assertThrows(IllegalArgumentException.class,()->op(registry,OperationType.GET,KeySpec.collision("overflow",42),null));
        assertEquals(0,registry.snapshot().capacity());
        op(registry,OperationType.RESET,null,null); put(registry,"overflow",43);
    }
    @Test void equalityEventsDistinguishIdentityFromActualEquals() {
        var e=new HashMapEngine(); var nil=new KeySpec(KeyType.NULL,null,null);
        op(e,OperationType.PUT,nil,"null-key");
        var identity=op(e,OperationType.GET,nil,null).steps().stream().filter(s->s.event().equals("KEY_COMPARED")).findFirst().orElseThrow();
        assertEquals(true,identity.details().get("identityEqual")); assertEquals(false,identity.details().get("equalsChecked"));
        op(e,OperationType.PUT,KeySpec.string(new String("equal")),"value");
        var equal=op(e,OperationType.GET,KeySpec.string(new String("equal")),null).steps().stream().filter(s->s.event().equals("KEY_COMPARED") && Boolean.TRUE.equals(s.details().get("equal"))).findFirst().orElseThrow();
        assertEquals(false,equal.details().get("identityEqual")); assertEquals(true,equal.details().get("equalsChecked"));
    }
    @Test void pastSnapshotsDoNotChangeWhenLiveNodesAreUpdatedOrReorganized() {
        var e=new HashMapEngine(64);
        put(e,"K1",42); var old=put(e,"K2",42);
        var saved=old.committed(); var savedNodes=nodes(saved);
        long firstId=savedNodes.getFirst().id();
        op(e,OperationType.PUT,KeySpec.collision("K1",42),"new-value");
        for(int i=3;i<=9;i++) put(e,"K"+i,42);
        op(e,OperationType.REMOVE,KeySpec.collision("K1",42),null);
        assertEquals(2,saved.size()); assertEquals("LIST",saved.buckets().getFirst().kind());
        assertEquals("K1",savedNodes.getFirst().value()); assertEquals(firstId,savedNodes.getFirst().id());
        assertEquals(saved,old.steps().getLast().snapshot());
        assertThrows(UnsupportedOperationException.class,()->saved.buckets().clear());
        assertThrows(UnsupportedOperationException.class,()->old.steps().clear());
    }
    static void assertTrace(Trace<HashMapSnapshot> trace,HashMapEngine e) {
        assertEquals(trace.committed(),e.snapshot()); assertEquals(trace.committed(),trace.steps().getLast().snapshot());
        for(int i=0;i<trace.steps().size();i++) { var s=trace.steps().get(i); assertEquals(i,s.index()); assertFalse(s.message().isBlank()); assertNotNull(s.stage()); }
    }
}
