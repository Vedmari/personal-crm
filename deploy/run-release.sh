#!/usr/bin/env bash
# Runs on the GitHub runner. Each environment has its own workflow lock.
set -euo pipefail

case "${1:-}" in
  staging|prod) environment=$1 ;;
  *) exit 2 ;;
esac
scripts="/opt/crm/$environment/deploy"
image="ghcr.io/${GITHUB_REPOSITORY,,}"

if [[ "$environment" = prod && "${ROLLBACK:-false}" = true ]]; then
  # Use the installed compose file and local image, even if GHCR is unavailable.
  ssh server bash "$scripts/rollback.sh" prod
else
  if [[ "$environment" = prod ]]; then
    tag=${RELEASE_SHA:?No successful staging release was selected}
  else
    tag=$GITHUB_SHA
  fi
  [[ "$tag" =~ ^[0-9a-f]{40}$ ]] || exit 2
  rsync -rc deploy/ "server:$scripts/"
  if [[ "$environment" = prod ]]; then
    ssh server bash "$scripts/install-backup-timer.sh"
  fi
  printf '%s\n' "$REGISTRY_TOKEN" |
    ssh server bash "$scripts/deploy.sh" "$environment" "$image" "$tag" "$GITHUB_ACTOR"
fi

actual=$(ssh server "sed -n 's/^IMAGE_TAG=//p' /opt/crm/$environment/release.env")
[[ "$actual" =~ ^[0-9a-f]{40}$ ]] || exit 1
printf 'Released to **%s**: `%s`\n' "$environment" "$actual" >> "$GITHUB_STEP_SUMMARY"
