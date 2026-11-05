#!/usr/bin/env bash
# The single definition of CI. .github/workflows/ci.yml calls it; run it locally before a PR.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

group_start() {
  if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
    echo "::group::$1"
  else
    printf '\n==> %s\n' "$1"
  fi
}

group_end() {
  if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
    echo "::endgroup::"
  fi
}

step() {
  local name="$1"
  shift
  group_start "$name"
  "$@"
  group_end
}

step "Install" pnpm install --frozen-lockfile
step "Typecheck" pnpm run typecheck
step "Lint" pnpm run lint:check
step "Format" pnpm run format:check
step "Build" pnpm run build
step "Smoke test" env ARGUSWIKI_DEV=1 node dist/cli.js code --dry-run --init
step "Test" pnpm run test
step "Shell syntax" bash -n scripts/ci.sh .github/actions/host-pnpm/check.sh
