import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: Missing Supabase credentials in .env file');
  console.error('Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Helper: Get device count for an area
export async function getDeviceCountForArea(mqttTopic) {
  try {
    // For 'zigbee2mqtt' (area 1), match only 'zigbee2mqtt/' not 'zigbee2mqtt_area*'
    // For 'zigbee2mqtt_area2', match 'zigbee2mqtt_area2/'
    const searchPattern = mqttTopic === 'zigbee2mqtt' 
      ? 'zigbee2mqtt/%'
      : `${mqttTopic}/%`;

    const { count, error } = await supabase
      .from('power_meters')
      .select('*', { count: 'exact', head: true })
      .like('mqtt_topic', searchPattern)
      .not('mqtt_topic', 'like', mqttTopic === 'zigbee2mqtt' ? 'zigbee2mqtt_area%' : 'no-match');

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error(`Error getting device count for ${mqttTopic}:`, error);
    return 0;
  }
}

// Helper: Get device stats (total, online, offline) for an area
export async function getDeviceStatsForArea(area) {
  try {
    const mqttTopic = typeof area === 'string' ? area : area.mqtt_topic;
    
    const searchPattern = mqttTopic === 'zigbee2mqtt' 
      ? 'zigbee2mqtt/%'
      : `${mqttTopic}/%`;

    let query = supabase
      .from('power_meters')
      .select('power_status')
      .like('mqtt_topic', searchPattern);

    // For area 1, exclude area2/area3/etc
    if (mqttTopic === 'zigbee2mqtt') {
      query = query.not('mqtt_topic', 'like', 'zigbee2mqtt_area%');
    }

    const { data, error } = await query;

    if (error) throw error;

    const total = data?.length || 0;
    const online = data?.filter(d => d.power_status === 'ON').length || 0;
    const offline = total - online;

    return { 
      deviceCount: total, 
      devicesOnline: online, 
      devicesOffline: offline 
    };
  } catch (error) {
    console.error(`Error getting device stats for ${mqttTopic}:`, error);
    return { 
      deviceCount: 0, 
      devicesOnline: 0, 
      devicesOffline: 0 
    };
  }
}

// Helper: Insert monitoring data
export async function insertMonitoringData(data) {
  try {
    const { error } = await supabase
      .from('monitoring_data')
      .insert(data);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error inserting monitoring data:', error);
    return false;
  }
}

// Helper: Insert monitoring event
export async function insertMonitoringEvent(event) {
  try {
    const { error } = await supabase
      .from('monitoring_events')
      .insert(event);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error inserting monitoring event:', error);
    return false;
  }
}
