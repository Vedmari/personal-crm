# Shared helpers for the scripts in deploy/. Sourced, not run directly.

RELEASE_FILE="$APP_DIR/release.env"
# Database backups hold personal data: the folder is 700, the files are 600.
BACKUP_DIR="$APP_DIR/backups"

step() {
  printf '\n==> %s\n' "$*"
}

fail() {
  printf '\nERROR: %s\n' "$*" >&2
  exit 1
}

compose() {
  docker compose --project-name prod \
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
  file="$BACKUP_DIR/$(date -u +%Y-%m-%d_%H%M%S)_${version:0:7}${suffix}.dump"

  mkdir -p "$BACKUP_DIR" && chmod 700 "$BACKUP_DIR" || return 1
  # The dump is written under a temporary name and renamed only after it is
  # checked, so a failed or cut-off dump never looks like a ready backup.
  # User and database names come from the container's own environment.
  if ! (umask 077 && compose exec -T postgres sh -c \
    'pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom' \
    >"$file.partial") || ! check_backup "$file.partial"; then
    rm -f "$file.partial"
    return 1
  fi
  mv "$file.partial" "$file" || return 1
  printf '%s\n' "$file"
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

# Keeps only the given tags of the app image; untagged leftovers of the same
# image (from a re-run that rebuilt a tag) are removed too.
remove_old_images() {
  local image="$1" keep_current="$2" keep_previous="$3" tag
  docker image ls "$image" --format '{{.Tag}}' | while read -r tag; do
    if [ "$tag" = "$keep_current" ] || [ "$tag" = "$keep_previous" ] || [ "$tag" = "<none>" ]; then
      continue
    fi
    if docker image rm "$image:$tag" >/dev/null; then
      echo "removed $image:$tag"
    else
      echo "could not remove $image:$tag" >&2
    fi
  done
  docker image prune --force \
    --filter "label=org.opencontainers.image.source=https://github.com/Vedmari/personal-crm" >/dev/null
}
