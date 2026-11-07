#!/usr/bin/env bash
# Runner-side delivery only. Never installs or uploads the privileged helper.
set -euo pipefail
[[ $# == 3 && $1 =~ ^[0-9a-f]{40}$ && $2 =~ ^[0-9a-f]{64}$ ]] || { echo 'Expected COMMIT_SHA SHA256 JAR_PATH' >&2; exit 2; }
sha=$1
expected=$2
jar=$3
[[ -f "$jar" && ! -L "$jar" ]] || { echo 'Missing regular artifact' >&2; exit 1; }
actual=$(sha256sum -- "$jar")
[[ ${actual%% *} == "$expected" ]] || { echo 'Runner artifact hash mismatch' >&2; exit 1; }
: "${JCV_DEPLOY_SSH_KEY:?Set the production SSH key secret}"
: "${JCV_DEPLOY_KNOWN_HOSTS:?Set the independently verified known_hosts secret}"
: "${RUNNER_TEMP:?Runner temporary directory required}"
umask 077
ssh_dir=$(mktemp -d "$RUNNER_TEMP/jcv-ssh.XXXXXX")
trap 'rm -rf -- "$ssh_dir"' EXIT
printf '%s\n' "$JCV_DEPLOY_SSH_KEY" > "$ssh_dir/key"
printf '%s\n' "$JCV_DEPLOY_KNOWN_HOSTS" > "$ssh_dir/known_hosts"
ssh-keygen -F 135.106.208.51 -f "$ssh_dir/known_hosts" >/dev/null
options=(-i "$ssh_dir/key" -o BatchMode=yes -o StrictHostKeyChecking=yes
  -o "UserKnownHostsFile=$ssh_dir/known_hosts" -o GlobalKnownHostsFile=/dev/null
  -o IdentitiesOnly=yes -o LogLevel=ERROR -o ConnectTimeout=15
  -o ServerAliveInterval=15 -o ServerAliveCountMax=4)
remote=jcv-deploy@135.106.208.51
scp "${options[@]}" -- "$jar" "$remote:/var/lib/jcv-deploy/incoming/$sha.jar"
ssh "${options[@]}" "$remote" "sudo -n /usr/local/sbin/jcv-deploy $sha $expected"
