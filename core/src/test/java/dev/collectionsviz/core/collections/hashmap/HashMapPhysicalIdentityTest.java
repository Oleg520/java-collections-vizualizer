package dev.collectionsviz.core.collections.hashmap;

import dev.collectionsviz.core.protocol.*;
import dev.collectionsviz.core.protocol.command.*;
import org.junit.jupiter.api.Test;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import static org.junit.jupiter.api.Assertions.*;

class HashMapPhysicalIdentityTest {
    static List<NodeView> nodes(HashMapSnapshot s) {
        var result=new ArrayList<NodeView>(); s.buckets().forEach(b -> result.addAll(b.nodes()));
        s.pendingBuckets().forEach(b -> result.addAll(b.nodes())); return result;
    }
    static Trace<HashMapSnapshot> split(int lo,int hi) {
        var e=new HashMapEngine(64); Trace<HashMapSnapshot> last=null;
        for(int i=0;i<lo;i++) e.execute(put("L"+i,1));
        for(int i=0;i<hi;i++) e.execute(put("H"+i,65));
        for(int i=0;e.snapshot().size()<49;i++) last=e.execute(put("F"+i,2+i%30));
        return last;
    }
    static Operation put(String id,int hash) { return new Operation(OperationType.PUT,KeySpec.collision(id,hash),id); }
    @Test void asymmetricSplitsRetainEveryPhysicalRepresentationAndResolveEveryPointer() {
        for(var counts:List.of(new int[]{6,7},new int[]{2,7},new int[]{7,6},new int[]{7,2},
            new int[]{6,6},new int[]{7,7},new int[]{0,9},new int[]{9,0})) {
            var trace=split(counts[0],counts[1]);
            for(var step:trace.steps()) {
                var ids=new HashSet<Long>(); var ns=nodes(step.snapshot());
                for(var n:ns) assertTrue(ids.add(n.objectId()),"unique physical object at "+step.event());
                for(var n:ns) for(Long ref:Arrays.asList(n.next(),n.parent(),n.left(),n.right(),n.prev()))
                    if(ref!=null) assertTrue(ids.contains(ref),"resolved pointer "+ref);
                for(var b:step.snapshot().buckets()) {
                    assertTrue(ids.contains(b.headId())); if(b.rootId()!=null) assertTrue(ids.contains(b.rootId()));
                }
                assertTrue(ns.size()<=98,"physical graph is bounded by originals + replacements");
            }
            HashMapEngineTest.invariant(trace.committed());
            assertEquals(49,trace.committed().size());
        }
        for(int lo:List.of(6,2)) {
            var s=split(lo,7).steps().get(11).snapshot();
            var copies=nodes(s).stream().filter(n -> n.id()==(lo==6?4:2)).toList();
            assertEquals(2,copies.size()); assertNotEquals(copies.get(0).objectId(),copies.get(1).objectId());
            assertTrue(copies.stream().anyMatch(n -> n.red()==null && n.linked()));
            assertTrue(copies.stream().anyMatch(n -> n.red()!=null && !n.linked()));
        }
    }
    @Test void pointersDescribeTheActualJavaObjectsAtEveryObserverCallback() {
        var logical=new AtomicLong(); var physical=new AtomicLong();
        @SuppressWarnings("unchecked") var holder=(InstrumentedHashMap<Object,String>[])new InstrumentedHashMap<?,?>[1];
        holder[0]=new InstrumentedHashMap<>(64,logical::incrementAndGet,physical::incrementAndGet,(event,message,details) -> {
            var map=holder[0]; var snapshot=HashMapSnapshotAssembler.capture(map,"WORKING");
            var actual=new IdentityHashMap<InstrumentedHashMap.Node<Object,String>,Boolean>();
            var queue=new ArrayList<InstrumentedHashMap.Node<Object,String>>();
            if(map.table!=null) Collections.addAll(queue,map.table);
            if(map.pendingTable!=null) Collections.addAll(queue,map.pendingTable);
            queue.addAll(map.inFlight);
            for(int i=0;i<queue.size();i++) {
                var n=queue.get(i); if(n==null || actual.put(n,true)!=null) continue;
                queue.add(n.next);
                if(n instanceof InstrumentedHashMap.TreeNode<Object,String> t) queue.addAll(Arrays.asList(t.parent,t.left,t.right,t.prev));
            }
            var views=new HashMap<Long,NodeView>(); nodes(snapshot).forEach(n -> assertNull(views.put(n.objectId(),n)));
            assertEquals(actual.size(),views.size());
            for(var n:actual.keySet()) {
                var v=views.get(n.objectId); assertNotNull(v); assertEquals(n.id,v.id()); assertEquals(id(n.next),v.next());
                if(n instanceof InstrumentedHashMap.TreeNode<Object,String> t) {
                    assertEquals(id(t.parent),v.parent()); assertEquals(id(t.left),v.left());
                    assertEquals(id(t.right),v.right()); assertEquals(id(t.prev),v.prev()); assertEquals(t.red,v.red());
                }
            }
        });
        var map=holder[0];
        for(int i=0;i<49;i++) { int h=i<6?1:i<13?65:2+(i-13)%30; var k=new TeachingKey((i<6?"L"+i:i<13?"H"+(i-6):"F"+(i-13)),h);map.putVal(InstrumentedHashMap.hash(k),k,"v",false,true); }
        for(int i=0;i<7;i++) map.removeNode(65,new TeachingKey("H"+i,65),null,false,true);
    }
    private static Long id(InstrumentedHashMap.Node<?,?> n) { return n==null?null:n.objectId; }
    @Test void replacementAndResetPreserveLogicalContinuityWithoutReusingObjects() {
        var e=new HashMapEngine(64); for(int i=0;i<8;i++) e.execute(put("K"+i,42));
        var before=e.snapshot(); e.execute(put("K8",42)); var tree=e.snapshot();
        for(var n:nodes(before)) {
            var replacement=nodes(tree).stream().filter(t -> t.id()==n.id()).findFirst().orElseThrow();
            assertNotEquals(n.objectId(),replacement.objectId());
        }
        var updated=e.execute(put("K1",42)).committed(); assertEquals(nodes(tree),nodes(updated));
        long max=nodes(tree).stream().mapToLong(NodeView::objectId).max().orElseThrow();
        e.execute(new Operation(OperationType.RESET,null,null)); e.execute(put("new",42));
        assertTrue(nodes(e.snapshot()).getFirst().objectId()>max);
    }
}
