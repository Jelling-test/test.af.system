# Telegraf på NAS (MQTT → test → Supabase)

## Hurtig start (test til fil)
1) Udfyld `.env.example` og gem som `.env` (MQTT_PASSWORD mm.)
2) Start: `docker compose up -d`
3) Send test:
```
mosquitto_pub -h 192.168.9.61 -p 1890 -u $MQTT_USER -P $MQTT_PASSWORD \
  -t zigbee2mqtt/test_device_123 \
  -m '{"power":12.3,"energy":1.2,"voltage":231,"linkquality":99}'
```
4) Se data i `./logs/metrics.json` og `docker logs -f telegraf`.

## Skift til Supabase
1) Udfyld PG_* i `.env` (PG_HOST=db.<project-ref>.supabase.co, PG_USER=ingest)
2) Ændr i `docker-compose.yml` volumen til `./telegraf.supabase.conf:/etc/telegraf/telegraf.conf:ro`
3) `docker compose up -d` (recreate)

Bemærk: Tabellen `meter_readings` skal eksistere i Supabase, og RLS bør være disabled eller have INSERT policy for rollen `ingest`.
