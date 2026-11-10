// Local measurement helper. See docs/verification/hashmap-physical-identity.md.
import dev.collectionsviz.core.collections.hashmap.*;
import dev.collectionsviz.core.protocol.*;
import dev.collectionsviz.core.protocol.command.*;
import dev.collectionsviz.api.dto.*;
import dev.collectionsviz.api.trace.hashmap.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import java.nio.file.*;
public class HashMapIdentityBenchmark {
 static final ObjectMapper json=new ObjectMapper();
 static List<Object> history;
 static long heap(){System.gc();return Runtime.getRuntime().totalMemory()-Runtime.getRuntime().freeMemory();}
 public static void main(String[] args)throws Exception{
  // Warm JIT and serializers with the same bounded workload.
  run(false,args[0]); run(false,args[0]); history=null; long base=heap();
  var results=run(true,args[0]); results.put("retainedHistoryHeapBytes",heap()-base);
  Files.writeString(Path.of(args[0]+"/metrics.json"),json.writerWithDefaultPrettyPrinter().writeValueAsString(results));
  System.out.println(json.writeValueAsString(results));
 }
 static Map<String,Object> run(boolean save,String dir)throws Exception {
  var engine=new HashMapEngine(64);history=new ArrayList<>();
  long lastMs=0,encodeMs=0;Trace<HashMapSnapshot> last=null;CompactTrace encoded=null;
  var compactHistory=new ArrayList<Object>();
  for(int i=0;i<97;i++) {
   long start=System.nanoTime();
   last=engine.execute(new Operation(OperationType.PUT,KeySpec.collision(String.format("%03d",i)+"\0".repeat(61),i%2==0?1:129),"\0".repeat(128)));
   lastMs=System.nanoTime()-start;
   if(i>=85){var response=new SessionTrace<>(last.schemaVersion(),new UUID(0,55),i+1,last); start=System.nanoTime();encoded=CompactTrace.encode(response);encodeMs=System.nanoTime()-start;history.add(response);compactHistory.add(encoded);}
  }
  var result=new LinkedHashMap<String,Object>();
  result.put("steps",last.steps().size());result.put("compactBytes",json.writeValueAsBytes(encoded).length);result.put("nodePool",encoded.nodePool().size());
  result.put("lastExecuteMs",lastMs/1e6);result.put("lastEncodeMs",encodeMs/1e6);
  result.put("maxPhysicalViews",last.steps().stream().mapToInt(s->s.snapshot().buckets().stream().mapToInt(b->b.nodes().size()).sum()+s.snapshot().pendingBuckets().stream().mapToInt(b->b.nodes().size()).sum()).max().orElseThrow());
  if(save)Files.writeString(Path.of(dir+"/history.json"),json.writeValueAsString(compactHistory));
  return result;
 }
}
