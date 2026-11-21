#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
use_environment prod
lock_environment
IMAGE=$(read_release IMAGE)
IMAGE_TAG=$(read_release IMAGE_TAG)
export IMAGE IMAGE_TAG
: "${IMAGE_TAG:?Production has no recorded release}"
file=$(backup_database "$IMAGE_TAG" daily)
echo "$file ($(file_size "$file"))"
rotate_backups daily
