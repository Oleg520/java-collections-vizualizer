#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
# Fetch annotated and lightweight tags even from a shallow Netlify checkout.
# Do not mask network/authentication errors or force-replace conflicting tags.
remote=$(git remote get-url origin)
# Netlify's checkout may use an SSH deploy key unavailable to build commands.
case "$remote" in
  git@github.com:*) remote="https://github.com/${remote#git@github.com:}" ;;
  ssh://git@github.com/*) remote="https://github.com/${remote#ssh://git@github.com/}" ;;
esac
git -c credential.helper= fetch --no-recurse-submodules "$remote" 'refs/tags/*:refs/tags/*'
sh scripts/git-version.sh
