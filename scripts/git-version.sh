#!/bin/sh
# Shared exact-commit release rule for Maven validation and Vite.
set -efu
cd "$(dirname "$0")/.."
fail() { echo "Build version: $*" >&2; exit 1; }
head=$(git rev-parse --verify HEAD) || fail 'Git checkout required (including .git and tags)'

# These identify the immutable commit selected by each build service.
for expected in "${COMMIT_REF:-}" "${CF_PAGES_COMMIT_SHA:-}" "${GITHUB_SHA:-}"; do
  [ -z "$expected" ] || [ "$expected" = "$head" ] || fail "CI commit $expected differs from HEAD $head"
done

tags=$(git tag --points-at HEAD) || fail 'Cannot read tags'
pattern='(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)'
release=
for tag in $tags; do
  if printf '%s\n' "$tag" | LC_ALL=C grep -Eq "^$pattern$"; then
    [ -z "$release" ] || fail "Multiple release tags on HEAD: $release, $tag"
    release=$tag
  fi
done

case "${GITHUB_REF:-}" in
  refs/tags/*)
    requested=${GITHUB_REF#refs/tags/}
    [ -n "$release" ] && [ "$requested" = "$release" ] || fail "Requested tag $requested is not the unique plain X.Y.Z tag on HEAD"
    ;;
esac

if [ "${1:-}" = --check-maven ]; then
  expected=${release:-0.0.0-$head-SNAPSHOT}
  [ "${2:-}" = "$expected" ] || fail "Maven version ${2:-missing} differs from Git version $expected"
else
  printf '%s\n' "${release:-dev}"
fi
