#!/usr/bin/env bash
set -euo pipefail

# Build and publish the package to npm.
# Usage:
#   ./scripts/release.sh           # patch bump (default)
#   ./scripts/release.sh minor
#   ./scripts/release.sh major
#   ./scripts/release.sh 1.2.3     # explicit version

BUMP="${1:-patch}"

# Require a clean working tree
if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: Working tree is dirty. Commit or stash changes before releasing." >&2
  exit 1
fi

# Require npm auth
if ! npm whoami &>/dev/null; then
  echo "ERROR: Not logged in to npm. Run 'npm login' first." >&2
  exit 1
fi

echo "==> Cleaning previous build artifacts..."
pnpm clean

echo "==> Installing dependencies..."
pnpm install --frozen-lockfile

echo "==> Running tests..."
pnpm test --passWithNoTests --watchAll=false

echo "==> Generating type declarations..."
pnpm tsc --build

echo "==> Building package..."
pnpm build

# Verify the dist directory was produced
if [[ ! -d dist ]]; then
  echo "ERROR: Build succeeded but 'dist/' directory not found." >&2
  exit 1
fi

echo "==> Bumping version ($BUMP)..."
npm version "$BUMP" --no-git-tag-version

VERSION="$(node -p "require('./package.json').version")"

echo "==> Publishing v$VERSION to npm..."
pnpm publish --no-git-checks --access public

echo "==> Creating git tag v$VERSION..."
git add package.json
git commit -m "chore: release v$VERSION"
git tag "v$VERSION"

echo ""
echo "Published v$VERSION successfully."
echo "Don't forget to: git push && git push --tags"
