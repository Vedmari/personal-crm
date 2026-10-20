#!/usr/bin/env bash
# Deploys one version of the app on the server.
# Called by GitHub Actions (.github/workflows/deploy.yml) after the image is in GHCR:
#
#   deploy.sh <image> <tag> <registry-user>    (registry token on stdin)
#
# Steps: pull the image -> start Postgres -> apply migrations in a one-off
# container -> start the app on the new image -> smoke-check /health ->
# keep only the current and the previous image.
#
# Failed migrations stop the deploy: the app keeps running the previous image.
# A failed smoke check stops the deploy with an error. There is no automatic
# rollback: it is started by hand with deploy/rollback.sh.
set -euo pipefail

APP_DIR=/opt/crm/prod
HEALTH_URL=http://127.0.0.1:3000/health

image="${1:?usage: deploy.sh <image> <tag> <registry-user>}"
tag="${2:?usage: deploy.sh <image> <tag> <registry-user>}"
registry_user="${3:?usage: deploy.sh <image> <tag> <registry-user>}"

source "$APP_DIR/deploy/lib.sh"

# Read by deploy/compose.yaml.
export IMAGE="$image" IMAGE_TAG="$tag"

[ -s "$APP_DIR/.env" ] || fail "$APP_DIR/.env is empty: fill it in first (README.md, section about deploying)."
# Validates the compose file and .env without printing them: they hold the password.
compose config --quiet

current_tag="$(read_release IMAGE_TAG)"
previous_tag="$(read_release PREVIOUS_IMAGE_TAG)"
if [ -n "$current_tag" ] && [ "$current_tag" != "$tag" ]; then
  previous_tag="$current_tag"
fi

step "Pulling $image:$tag"
# Registry credentials live in a temporary directory and are removed right after the pull.
docker_config="$(mktemp -d)"
trap 'rm -rf "$docker_config"' EXIT
DOCKER_CONFIG="$docker_config" docker login ghcr.io --username "$registry_user" --password-stdin >/dev/null
DOCKER_CONFIG="$docker_config" docker pull --quiet "$image:$tag"
rm -rf "$docker_config"

step "Starting the database"
compose up --detach --wait postgres

step "Applying migrations"
if ! compose run --rm migrate; then
  fail "Migrations failed. The app keeps running the previous version${current_tag:+ ($current_tag)}."
fi

step "Starting the app on $tag"
compose up --detach --no-deps app
write_release "$image" "$tag" "$previous_tag"

step "Smoke check: $HEALTH_URL"
if ! wait_for_health "$HEALTH_URL"; then
  fail "Smoke check failed: $tag is running but /health does not answer 200.
Nothing was rolled back. Logs: ssh crm docker logs --tail 100 prod-app-1
Rollback by hand: ssh crm $APP_DIR/deploy/rollback.sh"
fi

step "Removing old images (keeping $tag${previous_tag:+ and $previous_tag})"
remove_old_images "$image" "$tag" "$previous_tag"

step "Deployed $tag"
