import mqtt from 'mqtt';
import { insertMonitoringData, insertMonitoringEvent } from '../utils/supabase.js';

let mqttClient = null;

// Extract meter name from MQTT topic
function extractMeterName(topic) {
  const parts = topic.split('/');
  const lastPart = parts[parts.length - 1];
  
  // Ignore bridge and availability topics
  if (parts.includes('bridge') || parts.includes('availability')) {
    return null;
  }
  
  return lastPart;
}

// Find area by topic match
function findAreaByTopic(topic, areas) {
  return areas.find(area => 
    topic === area.mqtt_topic || topic.startsWith(area.mqtt_topic + '/')
  );
}

// Initialize MQTT client
export function initMQTT(config, state, broadcast) {
  const { broker, username, password } = config.mqtt;
  
  console.log(`[MQTT] Connecting to ${broker}...`);
  
  mqttClient = mqtt.connect(`mqtt://${broker}`, {
    username,
    password,
    reconnectPeriod: 5000,
    connectTimeout: 30000
  });

  mqttClient.on('connect', () => {
    console.log('[MQTT] Connected successfully');
    
    // Subscribe to all area topics
    config.areas.forEach(area => {
      const topics = [
        `${area.mqtt_topic}/bridge/event`,
        `${area.mqtt_topic}/bridge/devices`,
        `${area.mqtt_topic}/bridge/state`,
        `${area.mqtt_topic}/#`
      ];
      
      topics.forEach(topic => {
        mqttClient.subscribe(topic, (err) => {
          if (err) {
            console.error(`[MQTT] Error subscribing to ${topic}:`, err);
          } else {
            console.log(`[MQTT] Subscribed to ${topic}`);
          }
        });
      });
    });
  });

  mqttClient.on('error', (error) => {
    console.error('[MQTT] Connection error:', error);
  });

  mqttClient.on('message', async (topic, message) => {
    try {
      const area = findAreaByTopic(topic, config.areas);
      if (!area) return;

      // Parse message
      let data;
      try {
        data = JSON.parse(message.toString());
      } catch (e) {
        return; // Ignore non-JSON messages
      }

      // Handle bridge events
      if (topic.includes('bridge/event')) {
        handleBridgeEvent(data, area, state, broadcast);
        return;
      }

      // Extract meter name
      const meterName = extractMeterName(topic);
      if (!meterName) return;

      const now = Date.now();

      // Handle test mode
      const testState = state.areaTests[area.id];
      if (testState?.active) {
        handleTestMessage(testState, meterName, data, now);
      }

      // Handle monitoring mode
      for (const [sessionId, session] of state.monitoringSessions.entries()) {
        if (session.active && session.areaIds.includes(parseInt(area.id))) {
          await handleMonitoringMessage(session, meterName, data, now);
        }
      }
    } catch (error) {
      console.error('[MQTT] Error processing message:', error);
    }
  });

  return mqttClient;
}

// Handle bridge events (device_joined, device_interview)
function handleBridgeEvent(data, area, state, broadcast) {
  if (data.type === 'device_joined') {
    console.log(`[${area.name}] Device joined: ${data.data.friendly_name}`);
    state.areaStates[area.id].status = 'device_joined';
    state.areaStates[area.id].currentDevice = {
      ieee_address: data.data.ieee_address,
      friendly_name: data.data.friendly_name,
      model: data.data.definition?.model || 'Unknown'
    };
    broadcast(area.id, state.areaStates[area.id]);
  } else if (data.type === 'device_interview') {
    const status = data.data.status === 'successful' ? 'interview_ok' : 'interview_failed';
    console.log(`[${area.name}] Interview ${data.data.status}: ${data.data.friendly_name}`);
    state.areaStates[area.id].status = status;
    broadcast(area.id, state.areaStates[area.id]);
  }
}

// Handle test mode messages
function handleTestMessage(testState, meterName, data, now) {
  // Initialize meter data if needed
  if (!testState.metersData.has(meterName)) {
    testState.metersData.set(meterName, []);
    testState.lqiHistory.set(meterName, []);
    testState.stateChanges.set(meterName, 0);
    testState.gaps.set(meterName, []);
  }

  // Store message
  testState.metersData.get(meterName).push({
    timestamp: now,
    payload: data
  });

  // Track LQI
  if (data.linkquality !== undefined) {
    testState.lqiHistory.get(meterName).push(data.linkquality);
  }

  // Track state changes
  if (data.state !== undefined) {
    const prevState = testState.lastState?.get(meterName);
    if (prevState && prevState !== data.state) {
      testState.stateChanges.set(meterName, testState.stateChanges.get(meterName) + 1);
    }
    if (!testState.lastState) {
      testState.lastState = new Map();
    }
    testState.lastState.set(meterName, data.state);
  }

  // Check for gaps (> 90 seconds)
  const lastSeen = testState.lastSeen.get(meterName);
  if (lastSeen) {
    const gap = now - lastSeen;
    if (gap > 90000) {
      testState.gaps.get(meterName).push({
        duration: gap,
        timestamp: lastSeen
      });
      console.log(`[TEST] Gap detected for ${meterName}: ${Math.round(gap / 1000)}s`);
    }
  }
  testState.lastSeen.set(meterName, now);
}

// Handle monitoring mode messages
async function handleMonitoringMessage(session, meterName, data, now) {
  // Insert data to Supabase
  await insertMonitoringData({
    monitoring_id: session.id,
    meter_number: meterName,
    timestamp: new Date(now).toISOString(),
    lqi: data.linkquality || null,
    voltage: data.voltage || null,
    current: data.current || null,
    power: data.power || null,
    energy: data.energy || null,
    state: data.state || null,
    raw_data: data
  });

  // Track state changes
  if (data.state !== undefined) {
    if (!session.stateChanges) session.stateChanges = new Map();
    if (!session.lastState) session.lastState = new Map();
    
    const prevState = session.lastState.get(meterName);
    if (prevState && prevState !== data.state) {
      const count = (session.stateChanges.get(meterName) || 0) + 1;
      session.stateChanges.set(meterName, count);
      
      await insertMonitoringEvent({
        monitoring_id: session.id,
        meter_number: meterName,
        event_type: 'state_change',
        timestamp: new Date(now).toISOString(),
        details: {
          from: prevState,
          to: data.state,
          count
        }
      });
    }
    session.lastState.set(meterName, data.state);
  }

  // Check for gaps
  if (!session.lastSeen) session.lastSeen = new Map();
  const lastSeen = session.lastSeen.get(meterName);
  if (lastSeen) {
    const gap = now - lastSeen;
    if (gap > 90000) {
      await insertMonitoringEvent({
        monitoring_id: session.id,
        meter_number: meterName,
        event_type: 'gap',
        timestamp: new Date(now).toISOString(),
        details: {
          gap_ms: gap,
          last_seen: new Date(lastSeen).toISOString()
        }
      });
      console.log(`[MONITORING] Gap detected for ${meterName}: ${Math.round(gap / 1000)}s`);
    }
  }
  session.lastSeen.set(meterName, now);

  // Check for low LQI
  if (data.linkquality !== undefined && data.linkquality < 80) {
    await insertMonitoringEvent({
      monitoring_id: session.id,
      meter_number: meterName,
      event_type: 'low_lqi',
      timestamp: new Date(now).toISOString(),
      details: { lqi: data.linkquality }
    });
  }
}

export function getMqttClient() {
  return mqttClient;
}
