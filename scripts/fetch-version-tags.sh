#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
# Fetch annotated and lightweight tags even from a shallow Netlify checkout.
# Do not mask network/authentication errors or force-replace conflicting tags.
git fetch --no-recurse-submodules origin 'refs/tags/*:refs/tags/*'
sh scripts/git-version.sh
