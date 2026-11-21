#!/usr/bin/env bash
# A retry must reuse a published SHA tag. Registry errors stop the build.
set -euo pipefail
reference="$1:$GITHUB_SHA"
if result=$(docker buildx imagetools inspect "$reference" 2>&1); then
  echo 'exists=true' >> "$GITHUB_OUTPUT"
elif [[ "$result" = *"$reference: not found"* || "$result" = *"manifest unknown"* ]]; then
  echo 'exists=false' >> "$GITHUB_OUTPUT"
else
  printf '%s\n' "$result" >&2
  exit 1
fi
