#!/bin/bash
# Zigbee2MQTT Backup Script
# Kør dette script dagligt via cron job

BACKUP_DIR="/volume1/docker/zigbee2mqtt-backups"
DATE=$(date +%Y%m%d_%H%M%S)
SOURCE_DIR="/volume1/docker/zigbee2mqtt/data"

# Opret backup mappe hvis den ikke findes
mkdir -p "$BACKUP_DIR"

# Opret backup med timestamp
BACKUP_FILE="$BACKUP_DIR/z2m_backup_$DATE.tar.gz"

# Pak vigtige filer
tar -czf "$BACKUP_FILE" \
  "$SOURCE_DIR/database.db" \
  "$SOURCE_DIR/configuration.yaml" \
  "$SOURCE_DIR/state.json" \
  "$SOURCE_DIR/coordinator_backup.json"

echo "Backup oprettet: $BACKUP_FILE"

# Behold kun de sidste 30 dages backups
find "$BACKUP_DIR" -name "z2m_backup_*.tar.gz" -mtime +30 -delete

echo "Gamle backups slettet (ældre end 30 dage)"
