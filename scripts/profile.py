#!/usr/bin/env python3
"""Reproducible HTTP workload; use a disposable local backend, never a shared demo."""
import argparse
import concurrent.futures
import gzip
import json
import statistics
import subprocess
import re
from datetime import datetime, timezone
import time
import urllib.request
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:8080')
parser.add_argument('--pid', type=int, help='Local Java PID for Linux RSS/high-water measurements')
parser.add_argument('--jcmd', help='Optional local JDK jcmd executable; requests GC for retained-heap comparison')
parser.add_argument('--output', default='docs/verification/resource-profile.json')
parser.add_argument('--encoding', choices=['full','compact'], default='compact')
parser.add_argument('--rounds', type=int, default=12)
args = parser.parse_args()
rows = []

def request(path, body=None):
    raw = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(args.url + '/api/v1' + path + ('?encoding=' + args.encoding if '/commands' in path or '/scenarios/' in path else ''), raw, {'Content-Type': 'application/json'})
    start = time.perf_counter()
    with urllib.request.urlopen(req, timeout=60) as response:
        data = response.read()
    elapsed = (time.perf_counter() - start) * 1000
    payload = json.loads(data)
    return payload, data, elapsed

def memory():
    if not args.pid:
        return {}
    lines = Path(f'/proc/{args.pid}/status').read_text().splitlines()
    return {line.split(':')[0] + 'KiB': int(line.split()[1]) for line in lines if line.startswith(('VmRSS:', 'VmHWM:'))}

def create(capacity=0):
    return request('/sessions', {'initialCapacity': capacity})[0]

def command(session, operation):
    payload, data, ms = request(f"/sessions/{session['id']}/commands", {'expectedRevision': session['revision'], 'operation': operation})
    session['revision'] = payload['revision']
    return payload, data, ms

def measure(name, result):
    payload, data, ms = result
    trace = payload['trace']
    node_views = sum(len(b.get('nodes', b.get('nodeRefs', []))) for step in trace['steps'] for field in ('buckets', 'pendingBuckets') for b in step['snapshot'][field])
    row = {'name': name, 'steps': len(trace['steps']), 'snapshotNodeViews': node_views,
           'nodeVersions': len(payload.get('nodePool', [])), 'jsonBytes': len(data), 'gzipBytes': len(gzip.compress(data)), 'httpMs': round(ms, 2), **memory()}
    rows.append(row)
    print(json.dumps(row), flush=True)

# Every constructor choice must produce the same demonstration, regardless of earlier operations.
for capacity in (0, 16, 32, 64):
    s = create(capacity)
    for name in ('insert','collision','update','resize','treeify','why-no-tree','tree-search','tree-remove'):
        result = request(f"/sessions/{s['id']}/scenarios/{name}", {'expectedRevision': s['revision']})
        s['revision'] = result[0]['revision']
        measure(f'{name}/initialCapacity={capacity}', result)
        if name in ('resize','why-no-tree'):
            assert result[0]['trace']['committed']['capacity'] == 32

# Large list-table resize, large tree split, and worst allowed escaped text.
for distribution, escaped in [('spread',False), ('tree-split',False), ('tree-split',True)]:
    s = create(64)
    for i in range(128):
        label = str(i).zfill(3) + ('\0' if escaped else 'k') * 61
        value = ('\0' if escaped else 'v') * 128
        hash_code = i if distribution == 'spread' else 1 if i % 2 == 0 else 129
        result = command(s, {'type':'PUT','key':{'type':'COLLISION','value':label,'hashCodeOverride':hash_code},'value':value})
        if i in (48,96,127):
            measure(f'{distribution}/escaped={escaped}/size={i+1}', result)
    assert result[0]['trace']['committed']['size'] == 128

# Four expensive 97th inserts simultaneously, with no browser/dev-server load.
burst_sessions = [create(64) for _ in range(4)]
for session in burst_sessions:
    for i in range(96):
        command(session, {'type':'PUT','key':{'type':'COLLISION','value':str(i).zfill(3)+'k'*61,
            'hashCodeOverride':1 if i%2==0 else 129},'value':'v'*128})
def burst(item):
    index, session = item
    result = command(session, {'type':'PUT','key':{'type':'COLLISION','value':'096'+'k'*61,'hashCodeOverride':1},'value':'v'*128})
    assert result[0]['trace']['committed']['size'] == 97
    measure(f'concurrent-tree-split/{index}',result)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
    list(executor.map(burst,enumerate(burst_sessions)))

# Reuse sessions so sustained execution cannot hide a leak behind a session-count increase.
sessions = [create() for _ in range(8)]
latencies = []
byte_counts = []
def cycle(s):
    for _ in range(args.rounds):
        result = request(f"/sessions/{s['id']}/scenarios/tree-remove", {'expectedRevision':s['revision']})
        s['revision'] = result[0]['revision']
        assert result[0]['trace']['committed']['size'] == 1
        latencies.append(result[2])
        byte_counts.append(len(result[1]))
def run_batch():
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        list(executor.map(cycle, sessions))

def retained_heap():
    if not args.pid or not args.jcmd:
        return None
    subprocess.run([args.jcmd,str(args.pid),'GC.run'],check=True,capture_output=True,timeout=30)
    info=subprocess.run([args.jcmd,str(args.pid),'GC.heap_info'],check=True,capture_output=True,text=True,timeout=30).stdout
    used=re.search(r'used (\d+)K',info)
    return {'usedHeapKiB':int(used.group(1)) if used else None, **memory()}

run_batch()
first_heap=retained_heap()
run_batch()
second_heap=retained_heap()

# Check negotiated HTTP compression, not just an offline gzip estimate.
s=sessions[0]
req=urllib.request.Request(args.url+f"/api/v1/sessions/{s['id']}/scenarios/treeify?encoding={args.encoding}",
    json.dumps({'expectedRevision':s['revision']}).encode(),
    {'Content-Type':'application/json','Accept-Encoding':'gzip'})
with urllib.request.urlopen(req,timeout=60) as response:
    assert response.headers.get('Content-Encoding')=='gzip'
    compressed=response.read()
    assert json.loads(gzip.decompress(compressed))['trace']['committed']['size']==9
compression={'contentEncoding':'gzip','wireBytes':len(compressed)}
summary = {'schemaVersion':1, 'measuredAt':datetime.now(timezone.utc).isoformat(), 'encoding':args.encoding,
           'retainedHeapAfterBatches':[first_heap,second_heap], 'httpCompression':compression, 'workload':{'sessions':19, 'concurrency':4, 'repeatedScenarios':len(latencies)},
           'scenariosAndLimits':rows,
           'sustained':{'httpP50Ms':round(statistics.median(latencies),2),
                        'httpP95Ms':round(sorted(latencies)[int((len(latencies)-1)*.95)],2),
                        'responseBytesMax':max(byte_counts), **memory()}}
output = Path(args.output)
output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
print('Wrote', output)
