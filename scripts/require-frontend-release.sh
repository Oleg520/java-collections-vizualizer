#!/bin/sh
# Production uploads must use the immutable main dispatch commit and a release tag.
set -eu
cd "$(dirname "$0")/.."
[ "${GITHUB_REF:-}" = refs/heads/main ] || { echo 'Dispatch from main only' >&2; exit 1; }
[ -n "${GITHUB_SHA:-}" ] || { echo 'Dispatch SHA required' >&2; exit 1; }
version=$(sh scripts/git-version.sh)
[ "$version" != dev ] || { echo 'Exactly one X.Y.Z release tag required on dispatch SHA' >&2; exit 1; }
printf '%s\n' "$version"
