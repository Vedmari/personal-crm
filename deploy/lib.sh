# Shared helpers for the scripts in deploy/. Sourced, not run directly.
#
# The server runs two environments of the app. Each is a docker compose
# project with its own folder, .env, database and port, and a copy of these
# scripts in <folder>/deploy:
#   prod    - production:     /opt/crm/prod,    https://app.lichnaya-crm.ru,      127.0.0.1:3000
#   staging - the test stand: /opt/crm/staging, https://test-app.lichnaya-crm.ru, 127.0.0.1:3001
# Every script picks its environment with use_environment before anything else.

# The folder of this copy of the scripts.
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Database backups of production. They hold personal data: the folder is 700,
# the files are 600. The test stand reads them to copy production.
BACKUP_DIR=/opt/crm/prod/backups

step() {
  printf '\n==> %s\n' "$*"
}

fail() {
  printf '\nERROR: %s\n' "$*" >&2
  exit 1
}

# Sets where the script works: ENVIRONMENT, APP_DIR, RELEASE_FILE, HEALTH_URL
# and APP_PORT (read by compose.yaml).
#   $1 - prod or staging
use_environment() {
  case "${1:-}" in
    prod) APP_PORT=3000 ;;
    staging) APP_PORT=3001 ;;
    *) fail "Unknown environment \"${1:-}\": use prod or staging." ;;
  esac
  ENVIRONMENT="$1"
  APP_DIR="/opt/crm/$ENVIRONMENT"
  RELEASE_FILE="$APP_DIR/release.env"
  HEALTH_URL="http://127.0.0.1:$APP_PORT/health"
  export APP_PORT

  # Each environment runs its own copy of the scripts: after a deploy to one
  # environment, the other may still have an older version of them.
  [ "$SCRIPTS_DIR" = "$APP_DIR/deploy" ] ||
    fail "These scripts are in $SCRIPTS_DIR. For $ENVIRONMENT run the ones in $APP_DIR/deploy."
}

# One script at a time on an environment: a deploy, a rollback, a restore or
# a reset of the test stand database waits until the one running now ends.
# The lock is let go when the script exits, even on an error.
lock_environment() {
  exec 9>>"$APP_DIR/deploy.lock"
  if ! flock --nonblock 9; then
    echo "Another deploy script is running on $ENVIRONMENT: waiting for it to end (up to 30 minutes)."
    flock --timeout 1800 9 || fail "The other script on $ENVIRONMENT did not end in 30 minutes."
  fi
}

compose() {
  docker compose --project-name "$ENVIRONMENT" \
    --file "$APP_DIR/deploy/compose.yaml" \
    --env-file "$APP_DIR/.env" \
    "$@"
}

# release.env records which image runs now and which ran before it,
# so a rollback knows where to go back to.
read_release() {
  [ -f "$RELEASE_FILE" ] || return 0
  sed -n "s/^$1=//p" "$RELEASE_FILE"
}

write_release() {
  printf 'IMAGE=%s\nIMAGE_TAG=%s\nPREVIOUS_IMAGE_TAG=%s\n' "$1" "$2" "$3" >"$RELEASE_FILE"
}

file_size() {
  du -h "$1" | cut -f1
}

# Runs SQL from stdin in the database of this environment.
# User and database names come from the container's own environment.
run_sql() {
  compose exec -T postgres sh -c \
    'psql --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --quiet --tuples-only --no-align --set=ON_ERROR_STOP=1'
}

# Checks that a file is a complete database dump that pg_restore can read.
check_backup() {
  [ -s "$1" ] && compose exec -T postgres pg_restore --list <"$1" >/dev/null
}

# Dumps the production database into $BACKUP_DIR and prints the file path.
#   $1 - version of the app the data belongs to (commit SHA), may be empty
#   $2 - optional word added to the end of the name
# Name: <UTC date>_<UTC time>_<first 7 characters of the SHA>[_<word>].dump,
# for example 2026-11-06_153012_d7ee8bf.dump.
backup_database() {
  local version="${1:-unknown}" suffix="${2:+_$2}" file
  [ "$ENVIRONMENT" = prod ] || fail "Backups are made on production only."
  file="$BACKUP_DIR/$(date -u +%Y-%m-%d_%H%M%S)_${version:0:7}${suffix}.dump"

  mkdir -p "$BACKUP_DIR" && chmod 700 "$BACKUP_DIR" || return 1
  # The dump is written under a temporary name and renamed only after it is
  # checked, so a failed or cut-off dump never looks like a ready backup.
  if ! (umask 077 && compose exec -T postgres sh -c \
    'pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom' \
    >"$file.partial") || ! check_backup "$file.partial"; then
    rm -f "$file.partial"
    return 1
  fi
  mv "$file.partial" "$file" || return 1
  printf '%s\n' "$file"
}

# Drops the database of this environment, creates it again and loads the
# dump from the file $1 into it.
#   $2... - more pg_restore options
replace_database() {
  local file="$1"
  shift
  compose exec -T postgres sh -c '
    set -e
    dropdb --username="$POSTGRES_USER" --force --if-exists "$POSTGRES_DB"
    createdb --username="$POSTGRES_USER" "$POSTGRES_DB"
    pg_restore --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" \
      --no-owner --exit-on-error --single-transaction "$@"
  ' sh "$@" <"$file"
}

# Prints how many tables the database of this environment has:
# 0 on a new test stand, or after its volume was removed.
count_tables() {
  run_sql <<'SQL'
select count(*) from pg_tables where schemaname not in ('pg_catalog', 'information_schema');
SQL
}

# Prints the newest production backup. Skips the copies restore.sh saves
# before it replaces the database: they hold the data that was replaced.
# Fails when there is no backup.
latest_prod_backup() {
  local file latest=""
  # The names start with the UTC date and time, so the last one is the newest.
  for file in "$BACKUP_DIR"/*.dump; do
    case "$file" in *_before-restore.dump) continue ;; esac
    if [ -f "$file" ]; then
      latest="$file"
    fi
  done
  [ -n "$latest" ] || return 1
  printf '%s\n' "$latest"
}

# Makes the test stand database a copy of production from the backup file $1.
# Then removes what belongs to the sign-in on production: the sign-ins, the
# unused links from sign-in emails and the counters of sent emails. A sign-in
# on the test stand starts on its own.
load_prod_backup() {
  [ "$ENVIRONMENT" = staging ] || fail "Only the test stand database is loaded from a production backup."
  check_backup "$1" || return 1
  # The test stand may have another database user: production's rights are not copied.
  replace_database "$1" --no-privileges || return 1
  # An older backup may not have all of these tables yet.
  run_sql <<'SQL'
do $$
declare
  name text;
begin
  foreach name in array array['session', 'verification', 'login_link_sends'] loop
    if to_regclass(format('public.%I', name)) is not null then
      execute format('truncate table public.%I', name);
    end if;
  end loop;
end
$$;
SQL
}

wait_for_health() {
  local attempt
  # The app needs a few seconds to start, so early failures are expected and not shown.
  for attempt in $(seq 1 30); do
    if curl --fail --silent --max-time 5 "$1"; then
      echo
      return 0
    fi
    sleep 2
  done
  # Shows why the last attempt failed.
  curl --fail --silent --show-error --max-time 5 "$1"
}

# Prints the current and the previous version of the app in a release.env.
release_tags() {
  if [ -f "$1" ]; then
    sed -n 's/^IMAGE_TAG=//p; s/^PREVIOUS_IMAGE_TAG=//p' "$1"
  fi
}

# Removes the app images that no environment needs. Production and the test
# stand use the same images on this server, so it keeps the current and the
# previous version of both: each of them can always be rolled back. Untagged
# leftovers of the same image (from a re-run that rebuilt a tag) are removed too.
remove_old_images() {
  local image="$1" tag keep=" "
  for tag in $(release_tags /opt/crm/prod/release.env) $(release_tags /opt/crm/staging/release.env); do
    keep+="$tag "
  done
  echo "Keeping:${keep% }"

  docker image ls "$image" --format '{{.Tag}}' | while read -r tag; do
    case "$tag" in "<none>") continue ;; esac
    case "$keep" in *" $tag "*) continue ;; esac
    if docker image rm "$image:$tag" >/dev/null; then
      echo "removed $image:$tag"
    else
      echo "could not remove $image:$tag" >&2
    fi
  done
  docker image prune --force \
    --filter "label=org.opencontainers.image.source=https://github.com/Vedmari/personal-crm" >/dev/null
}
