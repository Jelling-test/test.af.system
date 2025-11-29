import express from 'express';
import { getDeviceStatsForArea } from '../utils/supabase.js';

const router = express.Router();

export function createAreasRouter(config, state) {
  router.get('/', async (req, res) => {
    try {
      const areasWithCounts = await Promise.all(
        config.areas.map(async (area) => {
          const deviceStats = await getDeviceStatsForArea(area.mqtt_topic);
          
          return {
            ...area,
            deviceCount: deviceStats.total,
            devicesOnline: deviceStats.online,
            devicesOffline: deviceStats.offline,
            state: state.areaStates[area.id]
          };
        })
      );

      res.json({ areas: areasWithCounts });
    } catch (error) {
      console.error('Error fetching areas:', error);
      res.status(500).json({ error: 'Failed to fetch areas' });
    }
  });

  return router;
}
