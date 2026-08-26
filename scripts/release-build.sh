#!/usr/bin/env bash
#
# Builds the Release .vpkg from an actual release tag, not "whatever's currently checked out" -
# the guardrail this project's release process is otherwise missing: nothing stops someone from
# running `npm run build:release` on an arbitrary branch/local-only commit and uploading that to
# the Amazon Appstore believing it matches a tagged release. This script makes "build from the
# tag" the only path: it checks out the tag (detached HEAD), verifies package.json/manifest.toml
# actually agree with the tag's version (catching a release that was tagged without going
# through prepare-release.yml/tag-release.yml, or a workflow that partially failed), then runs
# a clean install and the real release build - see DEVELOPER.md's "Versioning & releases"
# section for how a tag gets created in the first place.
#
# Usage:
#   scripts/release-build.sh          # builds the latest tag
#   scripts/release-build.sh v1.2.0   # builds a specific tag
#
# Leaves the repo in detached HEAD at the built tag when it's done, deliberately - the printed
# summary says so, and how to get back to a branch, rather than switching back automatically and
# risking the local reviewer walking away thinking they built one thing when they built another.

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

if [ -n "$(git status --porcelain)" ]; then
  echo "error: working tree has uncommitted changes - commit, stash, or discard them first." >&2
  echo "       (about to check out a release tag; this would either lose or carry over local changes.)" >&2
  exit 1
fi

STARTING_REF=$(git symbolic-ref --quiet --short HEAD || git rev-parse HEAD)

echo "Fetching tags..."
git fetch origin --tags --force >/dev/null

TAG="${1:-}"
if [ -z "$TAG" ]; then
  TAG=$(git tag --list 'v*' --sort=-v:refname | head -n 1)
  if [ -z "$TAG" ]; then
    echo "error: no tags found (expected something like v1.0.0) - pass one explicitly, or run the Prepare Release/Tag Release workflows first." >&2
    exit 1
  fi
  echo "No tag given - using the latest: $TAG"
fi

if ! git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "error: tag '$TAG' not found (even after fetching)." >&2
  exit 1
fi

echo "Checking out $TAG..."
git checkout --quiet "$TAG"

EXPECTED_VERSION="${TAG#v}"
PKG_VERSION=$(node -p "require('./package.json').version")
MANIFEST_VERSION=$(sed -n 's/^version = "\(.*\)"/\1/p' manifest.toml)

if [ "$PKG_VERSION" != "$EXPECTED_VERSION" ] || [ "$MANIFEST_VERSION" != "$EXPECTED_VERSION" ]; then
  echo "error: version mismatch at $TAG - refusing to build a possibly-inconsistent release." >&2
  echo "       tag:            $EXPECTED_VERSION" >&2
  echo "       package.json:   $PKG_VERSION" >&2
  echo "       manifest.toml:  $MANIFEST_VERSION" >&2
  git checkout --quiet "$STARTING_REF"
  exit 1
fi

echo "Version check OK ($EXPECTED_VERSION consistent across the tag, package.json, and manifest.toml)."
echo
echo "Installing dependencies (npm ci)..."
npm ci

echo
echo "Building Release .vpkg..."
npm run build:release

echo
echo "Done. Built $TAG at commit $(git rev-parse --short HEAD)."
echo "The repo is now in detached HEAD at this tag, deliberately - the .vpkg you just built came"
echo "from exactly this commit. Run 'git checkout $STARTING_REF' to get back to where you were."
