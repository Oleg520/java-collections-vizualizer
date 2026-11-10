#!/usr/bin/env python3
"""Compare two disposable local JARs; never contacts a remote backend."""
import argparse
import hashlib
import http.client
import json
import os
import platform
import re
import socket
import statistics
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline', required=True, type=Path)
    parser.add_argument('--candidate', required=True, type=Path)
    parser.add_argument('--java-home', required=True, type=Path)
    parser.add_argument('--output', type=Path, default=Path('docs/verification/backend-observability.json'))
    args = parser.parse_args()
    java = args.java_home / 'bin/java'
    jcmd = args.java_home / 'bin/jcmd'
    flags = ['-Xms64m', '-Xmx256m', '-XX:ActiveProcessorCount=1', '-XX:+UseSerialGC']
    rows = []
    for port in (18090, 18091):
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', port))
    # Alternate process order to expose warmup/noise rather than hiding it in one average.
    for label in ('baseline', 'candidate', 'candidate', 'baseline'):
        jar = getattr(args, label).resolve()
        env = dict(os.environ, SERVER_ADDRESS='127.0.0.1', PORT='18090', MANAGEMENT_PORT='18091',
                   SESSION_CREATE_RATE_LIMIT='100000', WORK_RATE_LIMIT='100000',
                   MAX_SESSIONS='32', MAX_SESSIONS_PER_CLIENT='32')
        with open('/tmp/jcv-observability-profile-' + label + '.log', 'w') as log:
            process = subprocess.Popen([str(java), *flags, '-jar', str(jar)], env=env, stdout=log, stderr=subprocess.STDOUT)
            connection = http.client.HTTPConnection('127.0.0.1', 18090, timeout=30)
            def request(path, body=None, compressed=False):
                if path.startswith('/sessions'):
                    path += ('&' if '?' in path else '?') + 'snapshotVersion=2'
                data = None if body is None else json.dumps(body).encode()
                headers = {'Content-Type': 'application/json'}
                if compressed:
                    headers['Accept-Encoding'] = 'gzip'
                connection.request('GET' if body is None else 'POST', '/api/v1' + path, data, headers)
                response = connection.getresponse()
                raw = response.read()
                if response.status >= 400:
                    raise RuntimeError(f'Unexpected HTTP {response.status}')
                return raw, dict(response.getheaders())
            def memory():
                lines = Path(f'/proc/{process.pid}/status').read_text().splitlines()
                return {line.split(':')[0] + 'KiB': int(line.split()[1]) for line in lines if line.startswith(('VmRSS:', 'VmHWM:'))}
            def cpu():
                fields = Path(f'/proc/{process.pid}/stat').read_text().split()
                return (int(fields[13]) + int(fields[14])) / os.sysconf('SC_CLK_TCK')
            def heap():
                subprocess.run([str(jcmd), str(process.pid), 'GC.run'], check=True, capture_output=True, timeout=30)
                result = subprocess.run([str(jcmd), str(process.pid), 'GC.heap_info'], check=True, capture_output=True, text=True, timeout=30)
                # Serial GC reports young and old generation separately, plus metaspace.
                used = re.findall(r'(?:def new generation|tenured generation).*?used (\d+)K', result.stdout)
                return sum(map(int, used))
            try:
                start = time.monotonic()
                while True:
                    try:
                        request('/health')
                        break
                    except (OSError, http.client.HTTPException):
                        connection.close()
                        if process.poll() is not None or time.monotonic() - start > 40:
                            raise RuntimeError('Local backend failed to start; see profile log')
                        time.sleep(.1)
                startup_ms = (time.monotonic() - start) * 1000
                sessions = []
                for collection in ('HASH_MAP', 'ARRAY_LIST'):
                    raw, _ = request('/sessions', {'collection': collection})
                    sessions.append(json.loads(raw))
                def scenario(session):
                    name = 'tree-remove' if session['collection'] == 'HASH_MAP' else 'growth'
                    raw, _ = request(f"/sessions/{session['id']}/scenarios/{name}?encoding=compact", {'expectedRevision': session['revision']})
                    session['revision'] = json.loads(raw)['revision']
                    return len(raw)
                for _ in range(500):
                    for session in sessions:
                        scenario(session)
                heap_before = heap()
                cpu_start, wall_start = cpu(), time.monotonic()
                latencies, sizes = [], []
                for _ in range(1000):
                    for session in sessions:
                        begin = time.perf_counter()
                        sizes.append(scenario(session))
                        latencies.append((time.perf_counter() - begin) * 1000)
                elapsed, cpu_seconds = time.monotonic() - wall_start, cpu() - cpu_start
                heap_after = heap()
                row = {'variant': label, 'startupMs': round(startup_ms, 2), 'requests': len(latencies),
                       'wallSeconds': round(elapsed, 3), 'cpuSeconds': round(cpu_seconds, 3),
                       'p50Ms': round(statistics.median(latencies), 3),
                       'p95Ms': round(sorted(latencies)[int(.95 * (len(latencies) - 1))], 3),
                       'responseBytesMax': max(sizes), 'heapBeforeKiB': heap_before, 'heapAfterKiB': heap_after, **memory()}
                # A large split proves streaming and gzip still work with the wrapper.
                raw, _ = request('/sessions', {'initialCapacity': 64})
                session = json.loads(raw)
                for i in range(97):
                    raw, _ = request(f"/sessions/{session['id']}/commands?encoding=compact", {
                        'expectedRevision': session['revision'], 'operation': {'type': 'PUT',
                        'key': {'type': 'COLLISION', 'value': str(i).zfill(3) + 'k' * 61,
                                'hashCodeOverride': 1 if i % 2 == 0 else 129}, 'value': 'v' * 128}})
                    session['revision'] = json.loads(raw)['revision']
                row['largeTraceBytes'] = len(raw)
                assert len(raw) > 1024 * 1024
                if label == 'candidate':
                    # A dual-stack JDK can represent IPv4 loopback as a mapped IPv6 socket.
                    listeners = [line.split()[1].split(':')[0]
                                 for table in ('/proc/net/tcp', '/proc/net/tcp6')
                                 for line in Path(table).read_text().splitlines()[1:]
                                 if line.split()[1].split(':')[1] == f'{18091:04X}' and line.split()[3] == '0A']
                    assert listeners and all(address in ('0100007F', '0000000000000000FFFF00000100007F')
                                             for address in listeners)
                    row['managementLoopbackVerified'] = True
                raw, headers = request(f"/sessions/{session['id']}/scenarios/treeify?encoding=compact", {'expectedRevision': session['revision']}, compressed=True)
                assert headers.get('Content-Encoding') == 'gzip'
                row['gzipVerified'] = True
                rows.append(row)
                print(json.dumps(row), flush=True)
            finally:
                connection.close()
                process.terminate()
                try:
                    process.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
    result = {'baselineCommit': subprocess.check_output(['git', '-C', str(args.baseline.resolve().parents[2]), 'rev-parse', 'HEAD'], text=True).strip(),
              'jarSha256': {label: hashlib.sha256(getattr(args, label).read_bytes()).hexdigest() for label in ('baseline', 'candidate')},
              'javaVersion': subprocess.run([str(java), '-version'], capture_output=True, text=True, check=True).stderr.splitlines(),
              'cpuModel': next((line.split(':', 1)[1].strip() for line in Path('/proc/cpuinfo').read_text().splitlines() if line.startswith('model name')), platform.processor()),
              'measuredAt': datetime.now(timezone.utc).isoformat(), 'platform': platform.platform(),
              'cpu': platform.processor(), 'javaFlags': flags,
              'method': 'ABBA fresh local processes; 1000 warmup + 2000 measured mixed compact scenarios; GC before/after retained heap; one 97th-insert split and gzip check. Local rate limits raised equally for both variants.',
              'runs': rows}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + '\n')


if __name__ == '__main__':
    main()
