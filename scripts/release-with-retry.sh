#!/usr/bin/env bash
# Runs semantic-release up to 3 times, re-syncing tags from the remote before each attempt
# (argus-config#1179, trunk-based development).
#
# A release here only analyses, tags and publishes the GitHub Release; it commits nothing
# back (.releaserc.json), so the only push race is the tag push. A push rejected as a
# non-fast-forward or an existing tag is retried after `git fetch --tags`; nothing has
# been published at that point. The checkout stays on the promoted SHA: unlike a branch
# release, a retry must not move to a newer deploy tip, because only the SHA the test job
# went green on may be tagged.
#
# Anything else that fails (bad token, a plugin error) is not a race and is not retried:
# its exit status is passed through.
#
# RELEASE_COMMAND overrides the command (test/release-with-retry.test.ts uses it).
set -uo pipefail

RELEASE_COMMAND="${RELEASE_COMMAND:-pnpm exec semantic-release}"
LOG="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/semantic-release.log"
MAX_ATTEMPTS=3
# `[remote rejected]` (a protected ref or a hook) is deliberately not here.
REJECTED_PATTERN='failed to push some refs|\[rejected\]|non-fast-forward|fetch first|Updates were rejected'

for attempt in $(seq 1 "${MAX_ATTEMPTS}"); do
  if ! git fetch --quiet --tags origin; then
    echo "::error::could not fetch tags from origin"
    exit 1
  fi

  bash -c "${RELEASE_COMMAND}" 2>&1 | tee "${LOG}"
  exit_code="${PIPESTATUS[0]}"

  if [ "${exit_code}" -eq 0 ]; then
    exit 0
  fi
  if ! grep -qE "${REJECTED_PATTERN}" "${LOG}"; then
    exit "${exit_code}"
  fi
  echo "::warning::a release push was rejected (attempt ${attempt} of ${MAX_ATTEMPTS})"
done

echo "::error::release push was rejected ${MAX_ATTEMPTS} times, release not completed"
exit 1
