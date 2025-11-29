#!/bin/bash
# Zigbee2MQTT Navne Backup Script
# Kun configuration.yaml med alle målernes navne

BACKUP_DIR="/volume1/docker/zigbee2mqtt-backups"
DATE=$(date +%Y%m%d_%H%M%S)
SOURCE_FILE="/volume1/docker/zigbee2mqtt/data/configuration.yaml"

# Opret backup mappe hvis den ikke findes
mkdir -p "$BACKUP_DIR"

# Kopier kun configuration.yaml med timestamp
BACKUP_FILE="$BACKUP_DIR/z2m_names_$DATE.yaml"

cp "$SOURCE_FILE" "$BACKUP_FILE"

echo "Navne backup oprettet: $BACKUP_FILE"

# Behold kun de sidste 52 ugers backups (1 år)
find "$BACKUP_DIR" -name "z2m_names_*.yaml" -mtime +365 -delete

echo "Gamle backups slettet (ældre end 1 år)"

# Vis antal målere i backup
DEVICE_COUNT=$(grep -c "friendly_name:" "$BACKUP_FILE")
echo "Antal målere i backup: $DEVICE_COUNT"
