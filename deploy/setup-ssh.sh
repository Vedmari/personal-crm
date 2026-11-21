#!/usr/bin/env bash
set -euo pipefail

install -d -m 700 ~/.ssh
(umask 077 && printf '%s\n' "$DEPLOY_SSH_KEY" > ~/.ssh/deploy_key)
printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > ~/.ssh/known_hosts
cat > ~/.ssh/config <<EOF
Host server
  HostName $DEPLOY_HOST
  User $DEPLOY_USER
  IdentityFile ~/.ssh/deploy_key
  IdentitiesOnly yes
  StrictHostKeyChecking yes
  ConnectTimeout 60
  ServerAliveInterval 30
EOF
