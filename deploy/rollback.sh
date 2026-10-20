#!/usr/bin/env bash
# Manual rollback: switches the app back to the previous image.
# Never called automatically. Run it yourself:
#
#   ssh crm /opt/crm/prod/deploy/rollback.sh
#
# Migrations are not undone: the previous version runs on the current database.
set -euo pipefail

APP_DIR=/opt/crm/prod
HEALTH_URL=http://127.0.0.1:3000/health

source "$APP_DIR/deploy/lib.sh"

image="$(read_release IMAGE)"
current_tag="$(read_release IMAGE_TAG)"
previous_tag="$(read_release PREVIOUS_IMAGE_TAG)"

[ -n "$previous_tag" ] || fail "There is no previous version to roll back to."

export IMAGE="$image" IMAGE_TAG="$previous_tag"

step "Rolling back from $current_tag to $previous_tag"
compose up --detach --no-deps app
write_release "$image" "$previous_tag" "$current_tag"

step "Smoke check: $HEALTH_URL"
wait_for_health "$HEALTH_URL" || fail "Smoke check failed after rollback. Logs: docker logs --tail 100 prod-app-1"

step "Rolled back to $previous_tag"
