import express from 'express';

const router = express.Router();

export function createTestRouter(config, state, broadcast) {
  // Start 10-minute test
  router.post('/start-test', (req, res) => {
    const { areaId } = req.body;

    if (!areaId) {
      return res.status(400).json({ error: 'Missing areaId' });
    }

    const area = config.areas.find(a => a.id === areaId);
    if (!area) {
      return res.status(404).json({ error: 'Area not found' });
    }

    const testState = state.areaTests[areaId];
    if (testState?.active) {
      return res.status(400).json({ error: 'Test already running for this area' });
    }

    // Initialize test state
    const duration = 600; // 10 minutes
    state.areaTests[areaId] = {
      active: true,
      startTime: Date.now(),
      duration,
      metersData: new Map(),
      lqiHistory: new Map(),
      stateChanges: new Map(),
      lastSeen: new Map(),
      gaps: new Map(),
      lastState: new Map()
    };

    // Update area status
    state.areaStates[areaId].status = 'test_running';
    broadcast(areaId, state.areaStates[areaId]);

    // Auto-stop after duration
    setTimeout(() => {
      const test = state.areaTests[areaId];
      if (test?.active) {
        test.active = false;
        state.areaStates[areaId].status = 'idle';
        broadcast(areaId, { 
          ...state.areaStates[areaId], 
          testCompleted: true 
        });
        console.log(`[TEST] Auto-stopped test for ${area.name}`);
      }
    }, duration * 1000);

    console.log(`[TEST] Started 10-minute test for ${area.name}`);
    res.json({ 
      success: true, 
      duration,
      startTime: new Date().toISOString()
    });
  });

  // Stop test
  router.post('/stop-test', (req, res) => {
    const { areaId } = req.body;

    if (!areaId) {
      return res.status(400).json({ error: 'Missing areaId' });
    }

    const testState = state.areaTests[areaId];
    if (!testState?.active) {
      return res.status(400).json({ error: 'No test running for this area' });
    }

    // Stop test
    testState.active = false;
    state.areaStates[areaId].status = 'idle';
    broadcast(areaId, state.areaStates[areaId]);

    console.log(`[TEST] Stopped test for area ${areaId}`);
    res.json({ success: true });
  });

  // Get test result
  router.get('/test-result', (req, res) => {
    const { areaId } = req.query;

    if (!areaId) {
      return res.status(400).json({ error: 'Missing areaId parameter' });
    }

    const area = config.areas.find(a => a.id === areaId);
    if (!area) {
      return res.status(404).json({ error: 'Area not found' });
    }

    const testState = state.areaTests[areaId];
    if (!testState || !testState.startTime) {
      return res.status(400).json({ error: 'No test data for this area yet' });
    }

    // Calculate actual duration
    const now = Date.now();
    const endTime = testState.active 
      ? now 
      : Math.min(now, testState.startTime + testState.duration * 1000);
    const durationSeconds = Math.round((endTime - testState.startTime) / 1000);

    // Process meter data
    const meters = [];
    for (const [meterName, messages] of testState.metersData.entries()) {
      const lqiValues = testState.lqiHistory.get(meterName) || [];
      const avgLqi = lqiValues.length > 0
        ? lqiValues.reduce((sum, val) => sum + val, 0) / lqiValues.length
        : null;

      const gaps = testState.gaps.get(meterName) || [];
      const maxGapMs = gaps.length > 0
        ? Math.max(...gaps.map(g => g.duration))
        : 0;

      meters.push({
        meterName,
        messageCount: messages.length,
        avgLqi: avgLqi ? Math.round(avgLqi * 10) / 10 : null,
        stateChanges: testState.stateChanges.get(meterName) || 0,
        gapCount: gaps.length,
        maxGapMs
      });
    }

    res.json({
      area: {
        id: area.id,
        name: area.name
      },
      startedAt: new Date(testState.startTime).toISOString(),
      durationSeconds,
      active: testState.active,
      meters
    });
  });

  return router;
}
