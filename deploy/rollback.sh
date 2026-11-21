#!/usr/bin/env bash
# Manual rollback: switches the app of one environment back to its previous image.
# Never called automatically. Run it yourself:
#
#   ssh crm bash /opt/crm/prod/deploy/rollback.sh prod          (production)
#   ssh crm bash /opt/crm/staging/deploy/rollback.sh staging    (the test stand)
#
# Migrations are not undone: the previous version runs on the current database.
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
use_environment "${1:-}"
lock_environment

image="$(read_release IMAGE)"
current_tag="$(read_release IMAGE_TAG)"
previous_tag="$(read_release PREVIOUS_IMAGE_TAG)"

[ -n "$previous_tag" ] || fail "There is no previous version on $ENVIRONMENT to roll back to."

export IMAGE="$image" IMAGE_TAG="$previous_tag"

step "Rolling back $ENVIRONMENT from $current_tag to $previous_tag"
compose up --detach --no-deps app
write_release "$image" "$previous_tag" "$current_tag"

step "Smoke check: $HEALTH_URL"
wait_for_health "$HEALTH_URL" ||
  fail "Smoke check failed after rollback. Logs: docker logs --tail 100 $ENVIRONMENT-app-1"

step "Rolled back $ENVIRONMENT to $previous_tag"
