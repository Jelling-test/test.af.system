# Supabase Query Reference

Dette dokument viser alle Supabase queries du skal bruge i backend'en.

## Setup Supabase Client

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
```

## Power Meters Queries

### Hent antal målere for et område
```javascript
const { count, error } = await supabase
  .from('power_meters')
  .select('*', { count: 'exact', head: true })
  .eq('mqtt_topic', area.mqtt_topic);

// count indeholder antallet
```

### Hent alle målere for et område
```javascript
const { data: meters, error } = await supabase
  .from('power_meters')
  .select('*')
  .eq('mqtt_topic', 'zigbee2mqtt');
```

### Opdater last_seen for en måler
```javascript
const { error } = await supabase
  .from('power_meters')
  .update({ last_seen: new Date().toISOString() })
  .eq('meter_number', 'power_meter_01');
```

### Opret ny måler (hvis den ikke findes)
```javascript
const { data, error } = await supabase
  .from('power_meters')
  .upsert({
    meter_number: 'power_meter_01',
    mqtt_topic: 'zigbee2mqtt',
    friendly_name: 'Måler 01',
    last_seen: new Date().toISOString()
  }, {
    onConflict: 'meter_number'
  })
  .select()
  .single();
```

## Monitoring Sessions Queries

### Opret ny monitoring session
```javascript
const monitoringId = `mon_${Date.now()}`;

const { data: session, error } = await supabase
  .from('monitoring_sessions')
  .insert({
    id: monitoringId,
    area_ids: [1, 2], // Array af area IDs som integers
    start_time: new Date().toISOString(),
    duration_seconds: 12 * 3600, // 12 timer i sekunder
    status: 'active'
  })
  .select()
  .single();

// session.id indeholder monitoring ID
```

### Hent aktive sessions
```javascript
const { data: sessions, error } = await supabase
  .from('monitoring_sessions')
  .select('*')
  .eq('status', 'active');
```

### Opdater session status
```javascript
// Stop session
const { error } = await supabase
  .from('monitoring_sessions')
  .update({
    end_time: new Date().toISOString(),
    status: 'stopped'
  })
  .eq('id', monitoringId);

// Marker som completed
const { error } = await supabase
  .from('monitoring_sessions')
  .update({ status: 'completed' })
  .eq('id', monitoringId);
```

### Hent session med data
```javascript
const { data: session, error } = await supabase
  .from('monitoring_sessions')
  .select(`
    *,
    monitoring_data(count),
    monitoring_events(count)
  `)
  .eq('id', monitoringId)
  .single();
```

## Monitoring Data Queries

### Gem målerdata
```javascript
const { error } = await supabase
  .from('monitoring_data')
  .insert({
    monitoring_id: 'mon_1737117600000',
    meter_number: 'power_meter_01',
    timestamp: new Date().toISOString(),
    lqi: 187,
    voltage: 3000,
    current: 0.5,
    power: 15,
    energy: 0.12,
    state: 'ON',
    raw_data: rawPayload // Hele MQTT payload som JSONB
  });
```

### Bulk insert (mere effektivt)
```javascript
const dataPoints = [
  {
    monitoring_id: sessionId,
    meter_number: 'power_meter_01',
    timestamp: new Date().toISOString(),
    lqi: 187,
    raw_data: data1
  },
  {
    monitoring_id: sessionId,
    meter_number: 'power_meter_02',
    timestamp: new Date().toISOString(),
    lqi: 192,
    raw_data: data2
  }
];

const { error } = await supabase
  .from('monitoring_data')
  .insert(dataPoints);
```

### Hent data for en session
```javascript
const { data, error } = await supabase
  .from('monitoring_data')
  .select('*')
  .eq('monitoring_id', sessionId)
  .order('timestamp', { ascending: true });
```

### Hent gennemsnitlig LQI per måler
```javascript
const { data, error } = await supabase
  .from('monitoring_data')
  .select('meter_number, lqi')
  .eq('monitoring_id', sessionId)
  .not('lqi', 'is', null);

// Beregn gennemsnit i kode
const avgLqiByMeter = data.reduce((acc, row) => {
  if (!acc[row.meter_number]) {
    acc[row.meter_number] = { sum: 0, count: 0 };
  }
  acc[row.meter_number].sum += row.lqi;
  acc[row.meter_number].count += 1;
  return acc;
}, {});

Object.keys(avgLqiByMeter).forEach(meter => {
  avgLqiByMeter[meter] = avgLqiByMeter[meter].sum / avgLqiByMeter[meter].count;
});
```

## Monitoring Events Queries

### Log gap event
```javascript
const { error } = await supabase
  .from('monitoring_events')
  .insert({
    monitoring_id: sessionId,
    meter_number: 'power_meter_01',
    event_type: 'gap',
    timestamp: new Date().toISOString(),
    details: {
      gap_ms: 95000,
      gap_seconds: 95,
      last_seen: lastTimestamp,
      detected_at: new Date().toISOString()
    }
  });
```

### Log low LQI event
```javascript
const { error } = await supabase
  .from('monitoring_events')
  .insert({
    monitoring_id: sessionId,
    meter_number: 'power_meter_01',
    event_type: 'low_lqi',
    timestamp: new Date().toISOString(),
    details: {
      lqi: 85,
      threshold: 100,
      message: 'LQI below threshold'
    }
  });
```

### Log state change event
```javascript
const { error } = await supabase
  .from('monitoring_events')
  .insert({
    monitoring_id: sessionId,
    meter_number: 'power_meter_01',
    event_type: 'state_change',
    timestamp: new Date().toISOString(),
    details: {
      previous_state: 'OFF',
      new_state: 'ON'
    }
  });
```

### Hent alle events for en session
```javascript
const { data: events, error } = await supabase
  .from('monitoring_events')
  .select('*')
  .eq('monitoring_id', sessionId)
  .order('timestamp', { ascending: false });
```

### Hent events efter type
```javascript
const { data: gaps, error } = await supabase
  .from('monitoring_events')
  .select('*')
  .eq('monitoring_id', sessionId)
  .eq('event_type', 'gap');
```

## Praktiske Queries

### Tjek om måler eksisterer
```javascript
const { data: meter, error } = await supabase
  .from('power_meters')
  .select('id, meter_number')
  .eq('meter_number', 'power_meter_01')
  .maybeSingle(); // Returnerer null hvis ikke fundet

if (!meter) {
  // Måler findes ikke, opret den
}
```

### Hent statistik for en session
```javascript
const { data: stats, error } = await supabase
  .rpc('get_session_stats', { session_id: monitoringId });

// Eller lav aggregering manuelt:
const { data: dataCount } = await supabase
  .from('monitoring_data')
  .select('meter_number', { count: 'exact' })
  .eq('monitoring_id', sessionId);

const { data: eventCount } = await supabase
  .from('monitoring_events')
  .select('event_type', { count: 'exact' })
  .eq('monitoring_id', sessionId);
```

### Cleanup gamle data (valgfrit)
```javascript
// Slet data ældre end 30 dage
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const { error } = await supabase
  .from('monitoring_data')
  .delete()
  .lt('timestamp', thirtyDaysAgo.toISOString());
```

## Error Handling

Altid tjek for errors:

```javascript
const { data, error } = await supabase
  .from('monitoring_data')
  .insert(dataPoint);

if (error) {
  console.error('Supabase error:', error.message);
  console.error('Error details:', error);
  // Håndter fejl (retry, log, etc.)
}
```

## Performance Tips

1. **Batch inserts**: Brug bulk insert i stedet for enkelt-inserts
2. **Select kun nødvendige kolonner**: `.select('id, meter_number')` i stedet for `.select('*')`
3. **Brug indeksering**: Sørg for at Supabase har indices på `monitoring_id`, `meter_number`, `timestamp`
4. **Limit queries**: Brug `.limit(100)` hvis du ikke behøver alle rækker
5. **Pagination**: Brug `.range(0, 99)` for at hente data i chunks

## Eksempel: Komplet monitoring flow

```javascript
// 1. Start session
const sessionId = `mon_${Date.now()}`;
const { data: session } = await supabase
  .from('monitoring_sessions')
  .insert({
    id: sessionId,
    area_ids: [1],
    start_time: new Date().toISOString(),
    duration_seconds: 600,
    status: 'active'
  })
  .select()
  .single();

// 2. Modtag MQTT data
mqtt.on('message', async (topic, message) => {
  const data = JSON.parse(message.toString());
  const meterNumber = extractMeterNumber(topic);
  
  // Gem data
  await supabase.from('monitoring_data').insert({
    monitoring_id: sessionId,
    meter_number: meterNumber,
    timestamp: new Date().toISOString(),
    lqi: data.linkquality,
    raw_data: data
  });
  
  // Log events
  if (data.linkquality < 100) {
    await supabase.from('monitoring_events').insert({
      monitoring_id: sessionId,
      meter_number: meterNumber,
      event_type: 'low_lqi',
      timestamp: new Date().toISOString(),
      details: { lqi: data.linkquality }
    });
  }
});

// 3. Stop session
await supabase
  .from('monitoring_sessions')
  .update({
    end_time: new Date().toISOString(),
    status: 'completed'
  })
  .eq('id', sessionId);
```
