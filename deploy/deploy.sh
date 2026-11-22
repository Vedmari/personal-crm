#!/usr/bin/env bash
# Deploys one version of the app to one environment on the server.
# Called by GitHub Actions after the image is in GHCR:
#
#   deploy.sh <prod|staging> <image> <tag> <registry-user>    (registry token on stdin)
#
#   prod    - production, https://app.lichnaya-crm.ru
#   staging - the test stand, https://test-app.lichnaya-crm.ru
# Both get the same image; each runs the copy of this script in its own folder
# (/opt/crm/prod/deploy, /opt/crm/staging/deploy).
#
# Steps: wait until no other deploy script runs on this environment -> pull
# the image -> start Postgres -> production: back up the database; test stand:
# if its database is empty, load a copy of production from the latest
# production backup -> apply migrations in a one-off container -> start the
# app on the new image -> smoke-check /health.
#
# The backup goes to /opt/crm/prod/backups; its name carries the version that
# ran before this deploy. It is restored only by hand with deploy/restore.sh.
# The test stand is not backed up: its data is a copy of production, and a
# spoiled copy is made again with deploy/reset-staging-db.sh.
#
# A failed backup, a failed copy of production or failed migrations stop the
# deploy: the app keeps running the previous image.
# A failed smoke check stops the deploy with an error. There is no automatic
# rollback: it is started by hand with deploy/rollback.sh.
set -euo pipefail

usage="usage: deploy.sh <prod|staging> <image> <tag> <registry-user>"
environment="${1:?$usage}"
image="${2:?$usage}"
tag="${3:?$usage}"
registry_user="${4:?$usage}"

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
use_environment "$environment"
lock_environment

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

if [ "$ENVIRONMENT" = prod ]; then
  step "Backing up the database (version before this deploy: ${current_tag:-unknown})"
  if ! backup_file="$(backup_database "$current_tag")"; then
    fail "Backup failed. Migrations were not applied: the app keeps running the previous version${current_tag:+ ($current_tag)}."
  fi
  echo "$backup_file ($(file_size "$backup_file"))"
  rotate_backups deploy
else
  step "Checking the test stand database"
  tables="$(count_tables)" || fail "Could not read the test stand database."
  if [ "$tables" = 0 ]; then
    backup_file="$(latest_prod_backup)" ||
      fail "The database is empty, and there is no production backup in $BACKUP_DIR to copy."
    echo "The database is empty: loading a copy of production from $backup_file ($(file_size "$backup_file"))."
    load_prod_backup "$backup_file" ||
      fail "Could not load the copy of production. The app keeps running the previous version${current_tag:+ ($current_tag)}."
  else
    echo "The database has data ($tables tables): it stays as it is."
    echo "To make it a fresh copy of production: ssh -t crm bash $APP_DIR/deploy/reset-staging-db.sh"
  fi
fi

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
Nothing was rolled back. Logs: ssh crm sudo journalctl --no-pager -n 100 CONTAINER_TAG=crm-$ENVIRONMENT-app
For production, select Roll back in the Deploy prod workflow.
For staging, run: ssh crm bash /opt/crm/staging/deploy/rollback.sh staging"
fi

step "Deployed $tag to $ENVIRONMENT"
