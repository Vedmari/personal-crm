#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
use_environment prod
lock_environment
image=$(read_release IMAGE)
: "${image:?Production has no recorded image}"
remove_old_images "$image"
