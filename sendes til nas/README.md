# Z2M Availability Opdatering - 29. november 2025

## Hvad er ændret?

Alle 6 Z2M instanser opdateres med ny availability konfiguration:

```yaml
availability:
  enabled: true
  active:
    timeout: 10              # Første ping efter 10 min
    max_jitter: 30000        # Undgå samtidige pings
    backoff: true            # Eksponentiel backoff
    pause_on_backoff_gt: 15  # STOP efter 2 ping forsøg
  passive:
    timeout: 1500            # Batteri: 25 timer
```

## Fordele

- **Maks 2 ping forsøg** per offline måler
- **Ingen "cascade failure"** ved strømsvigt på mange målere
- **Automatisk genoptagelse** når måler kommer online igen

## Installation

### Trin 1: Backup nuværende filer (VIGTIGT!)

På NAS'en, backup disse mapper:
- `/docker/zigbee2mqtt/data/configuration.yaml`
- `/docker/zigbee2mqtt_area2/data/configuration.yaml`
- `/docker/zigbee2mqtt_area3/data/configuration.yaml`
- `/docker/zigbee2mqtt_area4/data/configuration.yaml`
- `/docker/zigbee2mqtt_area5/data/configuration.yaml`
- `/docker/zigbee2mqtt_area6/data/configuration.yaml`

### Trin 2: Kopier nye filer

Kopier fra denne mappe:
```
sendes til nas/zigbee2mqtt/data/configuration.yaml → /docker/zigbee2mqtt/data/
sendes til nas/zigbee2mqtt_area2/data/configuration.yaml → /docker/zigbee2mqtt_area2/data/
... osv
```

### Trin 3: Genstart Z2M containere

```bash
docker restart zigbee2mqtt
docker restart zigbee2mqtt_area2
docker restart zigbee2mqtt_area3
docker restart zigbee2mqtt_area4
docker restart zigbee2mqtt_area5
docker restart zigbee2mqtt_area6
```

### Trin 4: Test med Kontor måler

1. Tag strømmen fra Kontor måler
2. Vent 10-15 minutter
3. Tjek Z2M UI: http://192.168.9.61:8082
4. Kontor skal vises som "Offline"
5. Sæt strøm på igen
6. Kontor skal automatisk blive "Online"

## Rækkefølge for opdatering

Start med **zigbee2mqtt** (port 8082) - her er Kontor måleren.
Når den er testet, opdater de øvrige områder.

| Område | Port | Controller IP |
|--------|------|---------------|
| zigbee2mqtt | 8082 | 192.168.0.254:6638 |
| zigbee2mqtt_area2 | 8083 | 192.168.1.35:6638 |
| zigbee2mqtt_area3 | 8084 | 192.168.1.9:6638 |
| zigbee2mqtt_area4 | 8085 | 192.168.1.66:6638 |
| zigbee2mqtt_area5 | 8086 | 192.168.0.95:6638 |
| zigbee2mqtt_area6 | 8087 | 192.168.0.60:6638 |
