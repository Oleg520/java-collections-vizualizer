#!/usr/bin/env python3
"""Bounded disposable checks of the real Java image, without private infrastructure."""
import argparse
import json
import os
import shutil
import subprocess
import time
import uuid
import urllib.request
import urllib.error


def docker(*args):
    return subprocess.check_output(['docker', *args], text=True, stderr=subprocess.PIPE, timeout=90).strip()


def local_daemon():
    endpoint = (os.environ.get('DOCKER_HOST') if not os.environ.get('DOCKER_CONTEXT') else None)
    endpoint = endpoint or json.loads(docker('context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}'))
    if not endpoint.startswith(('unix://', 'npipe://')) or docker('info', '--format', '{{.OSType}}') != 'linux':
        raise ValueError('Disposable checks require a local Linux Docker daemon')


def http(url, body=None, headers=None):
    headers = headers or {}
    # Docker Desktop publishes into Windows loopback when running from WSL.
    windows = 'microsoft' in os.uname().release.lower() and shutil.which('curl.exe')
    if windows:
        args = ['curl.exe', '--noproxy', '*', '--silent', '--show-error', '--max-time', '6',
                '--write-out', '\n%{http_code}']
        for key, value in headers.items():
            args += ['--header', key + ': ' + value]
        if body is not None:
            args += ['--data-binary', json.dumps(body)]
        text = subprocess.check_output([*args, url], text=True, timeout=10)
        content, code = text.rsplit('\n', 1)
        return int(code), json.loads(content) if content else None
    request = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None,
                                     headers=headers)
    try:
        response = urllib.request.urlopen(request, timeout=6)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        content = response.read()
        return response.status, json.loads(content) if content else None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['image', 'revision', 'version', 'jar-sha256']:
        parser.add_argument('--' + name, required=True)
    args = parser.parse_args()
    local_daemon()
    name = 'jcv-image-check-' + uuid.uuid4().hex[:12]
    network = name + '-net'
    created = False
    try:
        docker('network', 'create', network)
        gateway = json.loads(docker('network', 'inspect', network))[0]['IPAM']['Config'][0]['Gateway']
        image = json.loads(docker('image', 'inspect', args.image))[0]
        labels = image['Config']['Labels']
        assert labels['org.opencontainers.image.revision'] == args.revision
        assert labels['org.opencontainers.image.version'] == args.version
        assert labels['dev.collectionsviz.jar.sha256'] == args.jar_sha256
        env = {'TRUSTED_PROXIES': gateway, 'SESSION_CREATE_RATE_LIMIT': '1',
               'WORK_RATE_LIMIT': '60', 'MAX_SESSIONS': '8',
               'JAVA_TOOL_OPTIONS': '-Xms64m -Xmx256m -Xss512k -XX:MaxMetaspaceSize=128m '
               '-XX:ReservedCodeCacheSize=64m -XX:MaxDirectMemorySize=32m '
               '-XX:ActiveProcessorCount=2 -XX:+ExitOnOutOfMemoryError'}
        command = ['run', '-d', '--pull', 'never', '--name', name, '--network', network,
                   '--read-only', '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=64m,mode=1777',
                   '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
                   '--memory', '512m', '--memory-swap', '576m', '--cpus', '1',
                   '--pids-limit', '96', '--ulimit', 'nofile=4096:4096', '-p', '127.0.0.1::8080']
        for key, value in env.items():
            command += ['-e', key + '=' + value]
        docker(*command, args.image)
        created = True
        deadline = time.monotonic() + 75
        while True:
            container = json.loads(docker('inspect', name))[0]
            if container['State']['Health']['Status'] == 'healthy':
                break
            if not container['State']['Running'] or time.monotonic() > deadline:
                raise ValueError('Container did not become healthy')
            time.sleep(1)
        host = container['HostConfig']
        assert container['Image'] == image['Id'] and container['Config']['User'] == '10001:10001'
        assert host['ReadonlyRootfs'] and host['CapDrop'] == ['ALL']
        assert host['SecurityOpt'] == ['no-new-privileges:true']
        assert host['Memory'] == 512 * 1024**2 and host['MemorySwap'] == 576 * 1024**2
        assert host['NanoCpus'] == 1000000000 and host['PidsLimit'] == 96
        assert host['Ulimits'] == [{'Name': 'nofile', 'Soft': 4096, 'Hard': 4096}]
        assert host['Tmpfs'] == {'/tmp': 'rw,noexec,nosuid,nodev,size=64m,mode=1777'}
        assert not container['Mounts'] and not host['Privileged']
        ports = container['NetworkSettings']['Ports']
        assert set(ports) == {'8080/tcp'} and ports['8080/tcp'][0]['HostIp'] == '127.0.0.1'
        assert docker('exec', name, 'sha256sum', '/app/backend.jar').split()[0] == args.jar_sha256
        status = docker('exec', name, 'cat', '/proc/1/status')
        for expected in ['NoNewPrivs:\t1', 'Seccomp:\t2', 'CapEff:\t0000000000000000']:
            assert expected in status, expected
        apparmor = 'name=apparmor' in docker('info', '--format', '{{json .SecurityOptions}}')
        if os.environ.get('GITHUB_ACTIONS') == 'true' and not apparmor:
            raise ValueError('Linux CI must exercise AppArmor enforcement')
        if apparmor:
            assert container['AppArmorProfile'] == 'docker-default'
            assert docker('exec', name, 'cat', '/proc/1/attr/current') == 'docker-default (enforce)'
        base = 'http://127.0.0.1:' + ports['8080/tcp'][0]['HostPort']
        code, health = http(base + '/api/v1/health')
        assert code == 200 and health['java'] == '21' and health['version'] == args.version
        assert http(base + '/actuator/health')[0] == 404
        # Trusted immediate host proxy can distinguish clients; one client cannot
        # evade its creation budget by sending a different request for that same IP.
        endpoint = base + '/api/v1/sessions?snapshotVersion=2'
        headers = {'Content-Type': 'application/json', 'X-JCV-Client-IP': '192.0.2.10'}
        assert http(endpoint, {'collection': 'HASH_MAP'}, headers)[0] == 201
        headers['X-JCV-Client-IP'] = '192.0.2.11'
        assert http(endpoint, {'collection': 'ARRAY_LIST'}, headers)[0] == 201
        headers['X-JCV-Client-IP'] = '192.0.2.10'
        assert http(endpoint, {'collection': 'HASH_MAP'}, headers)[0] == 429
        # An untrusted direct container peer cannot rotate custom headers to obtain
        # new quotas. curl runs inside the same container using its non-loopback IP.
        address = container['NetworkSettings']['Networks'][network]['IPAddress']
        target = 'http://' + address + ':8080/api/v1/sessions?snapshotVersion=2'
        for index, expected in [(20, 201), (21, 429)]:
            response = docker('exec', name, 'curl', '--noproxy', '*', '-sS', '-o', '/tmp/check.json',
                              '-w', '%{http_code}', '-H', 'Content-Type: application/json',
                              '-H', f'X-JCV-Client-IP: 192.0.2.{index}', '-d',
                              '{"collection":"HASH_MAP"}', target)
            assert int(response) == expected, 'Untrusted proxy header bypass'
        # Management is reachable from container loopback, not its bridge interface.
        assert json.loads(docker('exec', name, 'wget', '-qO-',
                                 'http://127.0.0.1:18083/actuator/health'))['status'] == 'UP'
        result = subprocess.run(['docker', 'exec', name, 'curl', '--noproxy', '*', '-sS',
                                 '--connect-timeout', '2', f'http://{address}:18083/actuator/health'],
                                capture_output=True, timeout=10)
        assert result.returncode != 0
        started = time.monotonic()
        docker('stop', '--time', '30', name)
        stopped = json.loads(docker('inspect', name))[0]
        assert not stopped['State']['OOMKilled'] and stopped['State']['ExitCode'] in (0, 143)
        assert time.monotonic() - started < 30, 'SIGTERM required forced kill'
        print(json.dumps({'container_smoke': 'passed', 'version': args.version,
                          'proxy_gateway': gateway, 'apparmor_enforced': apparmor,
                          'checks': ['exact JAR/image', 'health/version', 'quotas/spoofed headers',
                                     'management isolation', 'kernel limits', 'SIGTERM']}))
    finally:
        if created:
            docker('rm', '-f', name)
        docker('network', 'rm', network)


if __name__ == '__main__':
    main()
