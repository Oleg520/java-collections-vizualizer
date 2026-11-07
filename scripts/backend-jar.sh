#!/bin/sh
# Reject missing/stale multiple artifacts instead of selecting an arbitrary glob.
set -eu
directory=${1:-"$(dirname "$0")/../backend/target"}
set -- "$directory"/backend-*.jar
if [ "$#" -ne 1 ] || [ ! -f "$1" ] || [ -L "$1" ]; then
  echo "Expected exactly one backend JAR in $directory; run ./mvnw clean verify" >&2
  exit 1
fi
printf '%s\n' "$1"
