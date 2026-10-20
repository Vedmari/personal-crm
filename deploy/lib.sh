# Shared helpers for deploy.sh and rollback.sh. Sourced, not run directly.

RELEASE_FILE="$APP_DIR/release.env"

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
