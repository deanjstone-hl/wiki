#!/usr/bin/env bash
# The host-pnpm action's check, kept in a file so scripts/host-pnpm-check.test.ts
# can run it against fake pnpm installs. Runs in the directory whose
# package.json holds the packageManager pin.
set -euo pipefail

fnm_bin="$HOME/.local/share/fnm/aliases/default/bin"
if [[ -d "$fnm_bin" ]]; then
  echo "$fnm_bin" >> "$GITHUB_PATH"
  export PATH="$fnm_bin:$PATH"
fi

pin="$(node -p "require('./package.json').packageManager || ''")"
expected="${pin#pnpm@}"
expected="${expected%%+*}"
if [[ "$pin" != pnpm@* || -z "$expected" ]]; then
  echo "::error::package.json has no pnpm@<version> packageManager pin (got '$pin')"
  exit 1
fi

# A nested package installs from its own pin, so hold it to the root pin
# explicitly (argus#680). A repo with no root package.json has no root pin to
# hold it to (context runs this in a nested argus checkout, argus#777).
if [[ -f "$GITHUB_WORKSPACE/package.json" && "$(realpath .)" != "$(realpath "$GITHUB_WORKSPACE")" ]]; then
  root_pin="$(node -p "require('$GITHUB_WORKSPACE/package.json').packageManager || ''")"
  echo "$PWD/package.json packageManager: $pin (root pin: $root_pin)"
  if [[ "$pin" != "$root_pin" ]]; then
    echo "::error::$PWD/package.json pins $pin, but the root package.json pins $root_pin"
    exit 1
  fi
fi

pnpm_path="$(command -v pnpm || true)"
if [[ -z "$pnpm_path" ]]; then
  echo "::error::no pnpm on PATH"
  exit 1
fi

# Corepack's shim (the homelab runners' pnpm) downloads and runs exactly the
# version the pin names, and a standalone pnpm >= 9.7 switches itself to it, so
# there is no separately installed host version to drift and `pnpm --version`
# reports the pin whenever that enforcement is on (argus#690). The comparison
# below catches it being off: a standalone pnpm that does not switch, or a
# shim told to ignore the pin, which corepack has an explicit switch for.
if [[ "$(realpath "$pnpm_path")" == */corepack/dist/pnpm.js ]]; then
  mode="corepack shim"
  if [[ "${COREPACK_ENABLE_PROJECT_SPEC:-}" == 0 ]]; then
    echo "::error::COREPACK_ENABLE_PROJECT_SPEC=0 makes corepack ignore the packageManager pin $pin"
    exit 1
  fi
else
  mode="standalone"
fi

actual="$(pnpm --version)"
echo "pnpm --version: $actual ($mode at $pnpm_path; packageManager pin: $expected)"
if [[ "$actual" != "$expected" ]]; then
  echo "::error::pnpm $actual ($mode) does not match the packageManager pin $expected"
  exit 1
fi
