#!/usr/bin/env bash
# Fills the empty production database with test contacts. Run by hand, once:
#
#   ssh crm bash /opt/crm/prod/deploy/seed.sh
#
# Runs scripts/seed.mts from the image that is deployed now. The generator only
# inserts and refuses to run when the database already has contacts.
#
# Production only: the test stand gets a copy of the production data instead.
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
use_environment prod
lock_environment

image="$(read_release IMAGE)"
tag="$(read_release IMAGE_TAG)"

[ -n "$tag" ] || fail "The app is not deployed yet."

export IMAGE="$image" IMAGE_TAG="$tag"

step "Seeding the database with test data ($tag)"
# The migrate service has the same image and database connection as the app.
compose run --rm migrate node scripts/seed.mts
