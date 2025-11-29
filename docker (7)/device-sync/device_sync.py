import os
import json
import time
import logging
from typing import Dict, Any, List

import paho.mqtt.client as mqtt
from supabase import create_client, Client

# -------- Settings --------
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://<YOUR_PROJECT>.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")  # service role key REQUIRED (write perms)
MQTT_HOST = os.getenv("MQTT_HOST", "192.168.9.61")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1890"))
MQTT_USER = os.getenv("MQTT_USER", "homeassistant")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "")
BASE_TOPICS = [t.strip() for t in os.getenv(
    "BASE_TOPICS",
    "zigbee2mqtt,zigbee2mqtt_area2,zigbee2mqtt_area3,zigbee2mqtt_area4,zigbee2mqtt_area5,zigbee2mqtt_area6"
).split(",") if t.strip()]
POLL_REDISCOVER_SEC = int(os.getenv("POLL_REDISCOVER_SEC", "300"))  # periodically refresh devices list
IGNORE_NAMES = {s.strip().lower() for s in os.getenv("IGNORE_NAMES", "coordinator").split(",") if s.strip()}

# -------- Logging --------
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger("device-sync")

# -------- Supabase --------
if not SUPABASE_KEY:
    raise SystemExit("Missing SUPABASE_SERVICE_ROLE_KEY env var")

sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def upsert_power_meter(friendly_name: str, base_topic: str, is_online: bool = True):
    topic = f"{base_topic}/{friendly_name}"
    now_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    payload = {
        "meter_number": friendly_name,
        "mqtt_topic": topic,
        "is_available": True,
        "is_online": is_online,
        "updated_at": now_iso,
    }
    # Insert or update existing
    sb.table("power_meters").upsert(payload, on_conflict="meter_number").execute()


def update_meter_online_status(friendly_name: str, is_online: bool):
    """Update only the is_online status for a meter."""
    now_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    try:
        sb.table("power_meters").update({
            "is_online": is_online,
            "updated_at": now_iso,
        }).eq("meter_number", friendly_name).execute()
        log.info(f"Updated online status: {friendly_name} -> {'online' if is_online else 'offline'}")
    except Exception as e:
        log.exception(f"Failed to update online status for {friendly_name}: {e}")


def upsert_meter_identity(ieee: str, friendly_name: str, base_topic: str, last_seen: str | None, availability: str | None, model: str | None):
    now_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    payload = {
        "ieee_address": ieee,
        "meter_number": friendly_name,
        "base_topic": base_topic,
        "last_seen": last_seen,
        "availability": availability,
        "model": model,
        "updated_at": now_iso,
    }
    # First ensure power_meter exists
    upsert_power_meter(friendly_name, base_topic)
    # Then identity row (FK to power_meters)
    sb.table("meter_identity").upsert(payload, on_conflict="ieee_address").execute()


def process_devices_array(devices: List[Dict[str, Any]], base_topic: str):
    for d in devices:
        ieee = d.get("ieee_address") or d.get("ieee")
        fn = d.get("friendly_name") or d.get("friendlyName") or ieee
        # Skip coordinator or any ignored names
        device_type = (d.get("type") or "").strip().lower()
        if device_type == "coordinator":
            log.info(f"Ignored coordinator device base={base_topic} type=Coordinator")
            continue
        if (fn or "").strip().lower() in IGNORE_NAMES:
            log.info(f"Ignored device fn={fn} base={base_topic} (matched IGNORE_NAMES)")
            continue
        availability = None
        if isinstance(d.get("availability"), dict):
            availability = d["availability"].get("state")
        elif isinstance(d.get("availability"), str):
            availability = d.get("availability")
        last_seen = d.get("last_seen") or d.get("lastSeen")
        model = (d.get("definition") or {}).get("model") if isinstance(d.get("definition"), dict) else d.get("model")
        if not ieee:
            continue
        try:
            upsert_meter_identity(ieee, fn, base_topic, last_seen, availability, model)
            log.info(f"Upserted device ieee={ieee} fn={fn} base={base_topic}")
        except Exception as e:
            log.exception(f"Upsert failed for ieee={ieee} fn={fn}: {e}")


def rename_in_db(old_name: str | None, new_name: str, base_topic: str):
    """Update existing power_meters + meter_identity rows on rename.
    Falls back to upsert if old_name doesn't exist yet.
    """
    try:
        # If new name is ignored, skip any DB mutations
        if (new_name or "").strip().lower() in IGNORE_NAMES:
            log.info(f"Rename ignored for new_name={new_name} (matched IGNORE_NAMES)")
            return
        
        updated = False
        
        # Update primary row if present
        if old_name:
            result = sb.table("power_meters").update({
                "meter_number": new_name,
                "mqtt_topic": f"{base_topic}/{new_name}",
                "updated_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            }).eq("meter_number", old_name).execute()
            
            if result.data:
                updated = True
                log.info(f"Updated power_meters: {old_name} -> {new_name}")

            # Also update identity links that referenced the old meter_number
            sb.table("meter_identity").update({
                "meter_number": new_name,
                "base_topic": base_topic,
                "updated_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            }).eq("meter_number", old_name).execute()

        # Only create new row if update didn't find existing row
        if not updated:
            upsert_power_meter(new_name, base_topic)
            log.info(f"Created new power_meter: {new_name}")
    except Exception as e:
        log.exception(f"Rename DB update failed ({old_name} -> {new_name} @ {base_topic}): {e}")


def on_message(client: mqtt.Client, userdata, msg: mqtt.MQTTMessage):
    topic = msg.topic
    try:
        payload = json.loads(msg.payload.decode("utf-8")) if msg.payload else None
    except Exception:
        payload = msg.payload.decode("utf-8") if msg.payload else None
    
    # Handle availability topics: {base}/{device}/availability
    for base in BASE_TOPICS:
        # Check if this is an availability message
        if topic.startswith(f"{base}/") and topic.endswith("/availability"):
            # Extract device name from topic
            parts = topic.split("/")
            if len(parts) >= 3:
                device_name = parts[1]  # {base}/{device}/availability
                # Skip coordinator and ignored names
                if device_name.lower() in IGNORE_NAMES or device_name.lower() == "coordinator":
                    return
                # Determine online status from payload
                is_online = False
                if isinstance(payload, dict):
                    is_online = payload.get("state") == "online"
                elif isinstance(payload, str):
                    is_online = payload.lower() == "online"
                update_meter_online_status(device_name, is_online)
                return
    
    # bridge/devices full dump
    for base in BASE_TOPICS:
        if topic == f"{base}/bridge/devices" and isinstance(payload, list):
            process_devices_array(payload, base)
            return
        # rename event
        if topic == f"{base}/bridge/event" and isinstance(payload, dict):
            if payload.get("type") == "device_renamed":
                data = payload.get("data", {})
                new = data.get("to")
                old = data.get("from")
                if new:
                    # Update DB rows immediately for fast consistency
                    rename_in_db(old, new, base)
                    # Fetch fresh devices list for authoritative info
                    client.publish(f"{base}/bridge/config/devices/get", "")
                    log.info(f"Rename event on {base}: {old} -> {new}")
                return
            if payload.get("type") in {"device_announce","device_interview"}:
                client.publish(f"{base}/bridge/config/devices/get", "")
                log.info(f"Device event on {base}: {payload.get('type')}")
                return


def main():
    client = mqtt.Client(client_id="device-sync")
    if MQTT_USER or MQTT_PASSWORD:
        client.username_pw_set(MQTT_USER, MQTT_PASSWORD)
    client.on_message = on_message

    log.info(f"Connecting MQTT {MQTT_HOST}:{MQTT_PORT}")
    client.connect(MQTT_HOST, MQTT_PORT, 60)

    # Subscribe to devices + events + availability for all bases
    for base in BASE_TOPICS:
        client.subscribe(f"{base}/bridge/devices", qos=1)
        client.subscribe(f"{base}/bridge/event", qos=1)
        client.subscribe(f"{base}/+/availability", qos=1)  # Listen for availability changes
        log.info(f"Subscribed to {base}/+/availability")

    client.loop_start()

    # Initial fetch + periodic refresh
    last_refresh = 0
    try:
        while True:
            now = time.time()
            if now - last_refresh >= POLL_REDISCOVER_SEC:
                for base in BASE_TOPICS:
                    client.publish(f"{base}/bridge/config/devices/get", "")
                last_refresh = now
            time.sleep(1.0)
    except KeyboardInterrupt:
        pass
    finally:
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":
    main()
