#!/usr/bin/env bash
set -euo pipefail

cd /opt/crm/prod/deploy
for unit in crm-db-backup.service crm-db-backup.timer; do
  sudo -n install -m 0644 "$unit" "/etc/systemd/system/$unit"
done
sudo -n systemctl daemon-reload
sudo -n systemctl enable --now crm-db-backup.timer
systemctl list-timers --all crm-db-backup.timer
