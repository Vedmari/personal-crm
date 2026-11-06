#!/usr/bin/env bash
# Restores the production database from a backup. Never called automatically:
# only a person runs it, on the server:
#
#   ssh -t crm bash /opt/crm/prod/deploy/restore.sh <backup file>
#
# Without an argument it lists the backups and changes nothing. The file is a
# name from /opt/crm/prod/backups or a full path.
#
# Steps: check the file -> show which file replaces which database and wait
# for "yes" -> back up the current database -> stop the app -> drop the
# database, create it again, load the backup -> start the app on the same
# version -> smoke-check /health.
#
# The app version does not change and migrations are not run. The backup name
# carries the version it was made for: if the app runs another version, roll
# the app back first (deploy/rollback.sh).
set -euo pipefail

APP_DIR=/opt/crm/prod
HEALTH_URL=http://127.0.0.1:3000/health

source "$APP_DIR/deploy/lib.sh"

usage() {
  printf '\nUsage: ssh -t crm bash %s/deploy/restore.sh <backup file>\n' "$APP_DIR"
}

list_backups() {
  step "Backups in $BACKUP_DIR (time in the name is UTC)"
  if compgen -G "$BACKUP_DIR/*.dump" >/dev/null; then
    ls -lh "$BACKUP_DIR"/*.dump
  else
    echo "No backups yet."
  fi
}

# Version in the backup name: 2026-11-06_153012_d7ee8bf.dump -> d7ee8bf.
backup_version() {
  basename "$1" | sed -n 's/^[0-9-]*_[0-9]*_\([0-9a-f]\{7\}\|unknown\)[._].*$/\1/p'
}

# Drops the database, creates it again and loads the dump from stdin.
replace_database() {
  compose exec -T postgres sh -c '
    set -e
    dropdb --username="$POSTGRES_USER" --force --if-exists "$POSTGRES_DB"
    createdb --username="$POSTGRES_USER" "$POSTGRES_DB"
    pg_restore --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" \
      --no-owner --exit-on-error --single-transaction
  ' <"$1"
}

[ -s "$APP_DIR/.env" ] || fail "$APP_DIR/.env is empty: the app is not set up on this server."

image="$(read_release IMAGE)"
tag="$(read_release IMAGE_TAG)"
[ -n "$tag" ] || fail "The app is not deployed yet: there is nothing to restore into."
# Read by deploy/compose.yaml. The app comes back on exactly this version.
export IMAGE="$image" IMAGE_TAG="$tag"

if [ $# -eq 0 ]; then
  list_backups
  usage
  exit 0
fi

backup="$1"
if [ ! -f "$backup" ] && [ -f "$BACKUP_DIR/$backup" ]; then
  backup="$BACKUP_DIR/$backup"
fi
[ -f "$backup" ] || fail "Backup file not found: $1
Run the script without arguments to see the list of backups."
backup="$(realpath "$backup")"

step "Checking the backup file"
compose up --detach --wait postgres
check_backup "$backup" || fail "$backup is not a complete database backup. Nothing was changed."
echo "OK"

db_name="$(compose exec -T postgres printenv POSTGRES_DB)"
made_for="$(backup_version "$backup")"
made_for="${made_for:-unknown}"

step "What will happen"
cat <<EOF
Backup file:  $backup
              $(file_size "$backup"), made for app version $made_for
Database:     $db_name in container prod-postgres-1 (compose project prod)
App version:  $tag (stays the same)

The database "$db_name" will be DELETED, created again and filled from this file.
A copy of the current database is saved first. The app is stopped meanwhile.
EOF
if [ "$made_for" != "${tag:0:7}" ]; then
  cat <<EOF

WARNING: the backup was made for version $made_for, the app runs ${tag:0:7}.
The app may not work with data from another version. Usually the app is rolled
back first (deploy/rollback.sh) and then the backup of that version is restored.
EOF
fi
echo
read -r -p 'Type yes to continue: ' answer || answer=""
if [ "$answer" != "yes" ]; then
  echo "Cancelled. Nothing was changed."
  exit 1
fi

step "Saving a copy of the current database"
snapshot="$(backup_database "$tag" before-restore)" ||
  fail "Could not save a copy of the current database. Nothing was changed."
echo "$snapshot ($(file_size "$snapshot"))"

step "Stopping the app"
compose stop app

step "Replacing the database $db_name with $(basename "$backup")"
if ! replace_database "$backup"; then
  fail "Restore failed: the database may be empty or incomplete. The app stays stopped.
To bring back the database as it was before this restore:
  ssh -t crm bash $APP_DIR/deploy/restore.sh $(basename "$snapshot")"
fi

step "Starting the app on $tag"
compose up --detach --no-deps app

step "Smoke check: $HEALTH_URL"
wait_for_health "$HEALTH_URL" || fail "The database is restored, but /health does not answer 200.
Logs: ssh crm docker logs --tail 100 prod-app-1
Copy of the database before this restore: $snapshot"

step "Restored $db_name from $(basename "$backup")"
echo "Copy of the database before this restore: $snapshot"
