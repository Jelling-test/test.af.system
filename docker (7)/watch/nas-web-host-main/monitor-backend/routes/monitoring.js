import express from 'express';
import { supabase } from '../utils/supabase.js';

const router = express.Router();

export function createMonitoringRouter(config, state, broadcast) {
  // Start monitoring
  router.post('/start', async (req, res) => {
    const { areaIds, duration } = req.body;

    if (!areaIds || !Array.isArray(areaIds) || areaIds.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid areaIds' });
    }

    if (!duration || duration < 1 || duration > 12) {
      return res.status(400).json({ error: 'Duration must be between 1 and 12 hours' });
    }

    // Verify all areas exist
    const validAreaIds = areaIds.filter(id => 
      config.areas.some(a => a.id === String(id))
    );

    if (validAreaIds.length !== areaIds.length) {
      return res.status(400).json({ error: 'One or more invalid area IDs' });
    }

    // Check for existing active monitoring sessions on these areas
    try {
      const { data: activeSessions, error: activeError } = await supabase
        .from('monitoring_sessions')
        .select('id, area_ids, status')
        .eq('status', 'active');

      if (activeError) {
        console.error('Error checking active monitoring sessions:', activeError);
        return res.status(500).json({ error: 'Failed to check existing monitoring sessions' });
      }

      if (activeSessions && activeSessions.length > 0) {
        const conflict = activeSessions.some(session =>
          Array.isArray(session.area_ids) && session.area_ids.some(id => areaIds.includes(String(id)) || areaIds.includes(id))
        );

        if (conflict) {
          return res.status(400).json({ error: 'Monitoring already active for one or more selected areas' });
        }
      }
    } catch (checkError) {
      console.error('Unexpected error when checking monitoring sessions:', checkError);
      return res.status(500).json({ error: 'Failed to validate monitoring sessions' });
    }

    const monitoringId = `mon_${Date.now()}`;
    const startTime = new Date();
    const durationSeconds = duration * 3600;

    try {
      // Create session in Supabase
      const { data, error } = await supabase
        .from('monitoring_sessions')
        .insert({
          id: monitoringId,
          area_ids: areaIds,
          start_time: startTime.toISOString(),
          duration_seconds: durationSeconds,
          status: 'active'
        })
        .select()
        .single();

      if (error) throw error;

      // Create session in memory
      state.monitoringSessions.set(monitoringId, {
        id: monitoringId,
        areaIds: areaIds.map(id => parseInt(id)),
        startTime: Date.now(),
        duration: durationSeconds,
        active: true,
        lastSeen: new Map(),
        stateChanges: new Map(),
        lastState: new Map()
      });

      // Update area states
      areaIds.forEach(id => {
        state.areaStates[id].status = 'monitoring';
        state.areaStates[id].monitoringId = monitoringId;
        broadcast(id, { ...state.areaStates[id], monitoringId });
      });

      // Auto-stop after duration
      setTimeout(async () => {
        const session = state.monitoringSessions.get(monitoringId);
        if (session?.active) {
          await stopMonitoring(monitoringId, state, broadcast);
        }
      }, durationSeconds * 1000);

      console.log(`[MONITORING] Started session ${monitoringId} for ${duration}h`);
      
      res.json({
        success: true,
        monitoringId,
        startTime: data.start_time,
        estimatedEndTime: new Date(Date.now() + durationSeconds * 1000).toISOString()
      });
    } catch (error) {
      console.error('Error starting monitoring:', error);
      res.status(500).json({ error: 'Failed to start monitoring session' });
    }
  });

  // Stop monitoring
  router.post('/stop/:monitoringId', async (req, res) => {
    const { monitoringId } = req.params;

    try {
      const stopped = await stopMonitoring(monitoringId, state, broadcast);
      if (stopped) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Monitoring session not found or already stopped' });
      }
    } catch (error) {
      console.error('Error stopping monitoring:', error);
      res.status(500).json({ error: 'Failed to stop monitoring session' });
    }
  });

  // Get all monitoring sessions
  router.get('/sessions', async (req, res) => {
    try {
      const { data: sessions, error } = await supabase
        .from('monitoring_sessions')
        .select('*')
        .order('start_time', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Enrich with area names from config
      const enrichedSessions = sessions.map(session => {
        const areaNames = session.area_ids.map(id => {
          const area = config.areas.find(a => a.id === String(id));
          return area ? area.name : `Area ${id}`;
        });

        return {
          ...session,
          areaNames
        };
      });

      res.json({ sessions: enrichedSessions });
    } catch (error) {
      console.error('Error fetching monitoring sessions:', error);
      res.status(500).json({ error: 'Failed to fetch monitoring sessions' });
    }
  });

  // Get monitoring session data (aggregated like test results)
  router.get('/sessions/:monitoringId', async (req, res) => {
    const { monitoringId } = req.params;

    try {
      // Get session info
      const { data: session, error: sessionError } = await supabase
        .from('monitoring_sessions')
        .select('*')
        .eq('id', monitoringId)
        .single();

      if (sessionError) throw sessionError;
      if (!session) {
        return res.status(404).json({ error: 'Monitoring session not found' });
      }

      // Get monitoring data for this session
      const { data: monitoringData, error: dataError } = await supabase
        .from('monitoring_data')
        .select('meter_number, lqi, state, timestamp')
        .eq('monitoring_id', monitoringId)
        .order('timestamp', { ascending: true });

      if (dataError) throw dataError;

      // Aggregate data per meter (like test results)
      const meterStats = {};
      
      monitoringData.forEach(record => {
        const meter = record.meter_number;
        
        if (!meterStats[meter]) {
          meterStats[meter] = {
            messageCount: 0,
            lqiValues: [],
            stateChanges: 0,
            lastState: null,
            lastSeen: null,
            firstSeen: null,
            gaps: []
          };
        }

        const stats = meterStats[meter];
        stats.messageCount++;
        
        if (record.lqi) stats.lqiValues.push(record.lqi);
        
        // Track state changes
        if (stats.lastState && stats.lastState !== record.state) {
          stats.stateChanges++;
        }
        stats.lastState = record.state;

        // Track gaps (>90s)
        const currentTime = new Date(record.timestamp).getTime();
        if (stats.lastSeen) {
          const gap = currentTime - stats.lastSeen;
          if (gap > 90000) {
            stats.gaps.push(gap);
          }
        }
        
        stats.lastSeen = currentTime;
        if (!stats.firstSeen) stats.firstSeen = currentTime;
      });

      // Format results
      const meters = Object.entries(meterStats).map(([meterName, stats]) => ({
        meterName,
        messageCount: stats.messageCount,
        avgLqi: stats.lqiValues.length > 0
          ? stats.lqiValues.reduce((sum, val) => sum + val, 0) / stats.lqiValues.length
          : null,
        stateChanges: stats.stateChanges,
        gapCount: stats.gaps.length,
        maxGapMs: stats.gaps.length > 0 ? Math.max(...stats.gaps) : 0
      }));

      // Calculate duration
      const startTime = new Date(session.start_time).getTime();
      const endTime = session.end_time 
        ? new Date(session.end_time).getTime()
        : Date.now();
      const durationSeconds = Math.round((endTime - startTime) / 1000);

      // Get area names
      const areaNames = session.area_ids.map(id => {
        const area = config.areas.find(a => a.id === String(id));
        return area ? area.name : `Area ${id}`;
      });

      res.json({
        session: {
          id: session.id,
          areaIds: session.area_ids,
          areaNames,
          startedAt: session.start_time,
          endedAt: session.end_time,
          durationSeconds,
          status: session.status
        },
        meters
      });
    } catch (error) {
      console.error('Error fetching monitoring session data:', error);
      res.status(500).json({ error: 'Failed to fetch monitoring session data' });
    }
  });

  return router;
}

// Helper function to stop monitoring
async function stopMonitoring(monitoringId, state, broadcast) {
  try {
    // Get session from Supabase
    const { data: session, error: fetchError } = await supabase
      .from('monitoring_sessions')
      .select('*')
      .eq('id', monitoringId)
      .single();

    if (fetchError || !session || session.status !== 'active') {
      return false;
    }

    // Update in Supabase
    const { error: updateError } = await supabase
      .from('monitoring_sessions')
      .update({
        end_time: new Date().toISOString(),
        status: 'stopped'
      })
      .eq('id', monitoringId);

    if (updateError) throw updateError;

    // Update in-memory state
    const memSession = state.monitoringSessions.get(monitoringId);
    if (memSession) {
      memSession.active = false;
      state.monitoringSessions.delete(monitoringId);
    }

    // Update area states
    session.area_ids.forEach(id => {
      const areaId = String(id);
      if (state.areaStates[areaId]) {
        state.areaStates[areaId].status = 'idle';
        delete state.areaStates[areaId].monitoringId;
        broadcast(areaId, state.areaStates[areaId]);
      }
    });

    console.log(`[MONITORING] Stopped session ${monitoringId}`);
    return true;
  } catch (error) {
    console.error('Error in stopMonitoring:', error);
    throw error;
  }
}
