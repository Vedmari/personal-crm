#!/usr/bin/env bash
# Makes the test stand database a fresh copy of production again: for when
# the data on the test stand got spoiled. Never called automatically. Run it
# on the server:
#
#   ssh -t crm bash /opt/crm/staging/deploy/reset-staging-db.sh
#
# Steps: find the latest production backup -> show which file replaces the
# test stand database and wait for "yes" -> stop the test stand app -> drop
# its database, create it again, load the backup, remove the production
# sign-ins -> apply the migrations of the version the test stand runs ->
# start the app on the same version -> smoke-check /health.
#
# Production is not touched: its backups are only read. The test stand data
# is not saved first: everything on it is a copy of production anyway.
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
use_environment staging
lock_environment

image="$(read_release IMAGE)"
tag="$(read_release IMAGE_TAG)"
[ -n "$tag" ] || fail "The test stand is not deployed yet: its first deploy fills the database by itself."
# Read by deploy/compose.yaml. The app comes back on exactly this version.
export IMAGE="$image" IMAGE_TAG="$tag"

backup="$(latest_prod_backup)" || fail "There is no production backup in $BACKUP_DIR."

step "Checking the backup file"
compose up --detach --wait postgres
check_backup "$backup" || fail "$backup is not a complete database backup. Nothing was changed."
echo "OK"

step "What will happen"
cat <<EOF
Backup file:  $backup ($(file_size "$backup"))
Database:     the test stand database in container staging-postgres-1 (compose project staging)
App version:  $tag (stays the same)

Everything in the test stand database will be DELETED and replaced by this
copy of production. Production is not touched. The app is stopped meanwhile.
EOF
echo
read -r -p 'Type yes to continue: ' answer || answer=""
if [ "$answer" != "yes" ]; then
  echo "Cancelled. Nothing was changed."
  exit 1
fi

step "Stopping the app"
compose stop app

step "Loading $(basename "$backup") into the test stand database"
load_prod_backup "$backup" ||
  fail "Loading failed: the test stand database may be empty or incomplete. The app stays stopped. Run this script again."

step "Applying migrations"
compose run --rm migrate || fail "Migrations failed. The app stays stopped."

step "Starting the app on $tag"
compose up --detach --no-deps app

step "Smoke check: $HEALTH_URL"
wait_for_health "$HEALTH_URL" || fail "The database is loaded, but /health does not answer 200.
Logs: ssh crm sudo journalctl --no-pager -n 100 CONTAINER_TAG=crm-staging-app"

step "The test stand database is a copy of production from $(basename "$backup")"
