import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split('T')[0];
    console.log("=== Daily Package Snapshot for " + today + " ===");

    // Hent ALLE aktive pakker
    const { data: allPackages, error: pkgError } = await supabase
      .from('plugin_data')
      .select('*')
      .eq('module', 'pakker')
      .eq('data->>status', 'aktiv');

    if (pkgError) throw pkgError;
    console.log(`Found ${allPackages?.length || 0} active packages`);

    // Gruppér pakker efter booking_nummer for at summere enheder per kunde
    const customerPackages: Record<string, any[]> = {};
    for (const pkg of allPackages || []) {
      const bookingNummer = pkg.data.booking_nummer?.toString();
      if (!bookingNummer) continue;
      if (!customerPackages[bookingNummer]) {
        customerPackages[bookingNummer] = [];
      }
      customerPackages[bookingNummer].push(pkg);
    }

    // Beregn faktisk forbrug for hver kunde (samme logik som check-low-power)
    const results: Record<string, { bought: number, consumed: number, remaining: number, kundeType: string, betalingsMetode: string }> = {};

    for (const [bookingNummer, packages] of Object.entries(customerPackages)) {
      // Hent kundens måler
      let meterId: string | null = null;
      let startEnergy = 0;

      const { data: regCust } = await supabase
        .from('regular_customers')
        .select('meter_id, meter_start_energy')
        .eq('booking_id', bookingNummer)
        .maybeSingle();

      if (regCust?.meter_id) {
        meterId = regCust.meter_id;
        startEnergy = regCust.meter_start_energy || 0;
      } else {
        const { data: seaCust } = await supabase
          .from('seasonal_customers')
          .select('meter_id, meter_start_energy')
          .eq('booking_id', bookingNummer)
          .maybeSingle();
        if (seaCust?.meter_id) {
          meterId = seaCust.meter_id;
          startEnergy = seaCust.meter_start_energy || 0;
        }
      }

      // Beregn total købte enheder for denne kunde
      let totalBought = 0;
      let kundeType = 'kørende';
      let betalingsMetode = 'reception';

      for (const pkg of packages) {
        totalBought += parseFloat(pkg.data.enheder || '0');
        kundeType = pkg.data.kunde_type || 'kørende';
        betalingsMetode = pkg.data.betaling_metode || 'reception';
      }

      // Beregn forbrug fra måler
      let consumed = 0;
      if (meterId) {
        const { data: reading } = await supabase
          .from('meter_readings')
          .select('energy')
          .eq('meter_id', meterId)
          .order('time', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (reading) {
          const currentEnergy = parseFloat(reading.energy || '0');
          consumed = Math.max(0, currentEnergy - startEnergy);
        }
      }

      // Tilføj accumulated_usage fra pakker (fra tidligere målere ved flytning)
      for (const pkg of packages) {
        consumed += parseFloat(pkg.data.accumulated_usage || '0');
      }

      const remaining = Math.max(0, totalBought - consumed);

      results[bookingNummer] = {
        bought: totalBought,
        consumed,
        remaining,
        kundeType,
        betalingsMetode
      };

      console.log(`Kunde ${bookingNummer}: Købt=${totalBought}, Forbrugt=${consumed.toFixed(2)}, Tilbage=${remaining.toFixed(2)}`);
    }

    // Aggregér per kunde_type og betalings_metode
    const aggregated: Record<string, { 
      activePackages: number, 
      totalBought: number, 
      totalConsumed: number, 
      totalRemaining: number 
    }> = {};

    for (const [_, data] of Object.entries(results)) {
      const key = `${data.kundeType}|${data.betalingsMetode}`;
      if (!aggregated[key]) {
        aggregated[key] = { activePackages: 0, totalBought: 0, totalConsumed: 0, totalRemaining: 0 };
      }
      aggregated[key].activePackages++;
      aggregated[key].totalBought += data.bought;
      aggregated[key].totalConsumed += data.consumed;
      aggregated[key].totalRemaining += data.remaining;
    }

    // Gem til daily_package_stats
    for (const [key, stats] of Object.entries(aggregated)) {
      const [kundeType, betalingsMetode] = key.split('|');

      const { data: existing } = await supabase
        .from('daily_package_stats')
        .select('*')
        .eq('organization_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('date', today)
        .eq('kunde_type', kundeType)
        .eq('betalings_metode', betalingsMetode)
        .maybeSingle();

      const snapshotData = {
        active_packages: stats.activePackages,
        kwh_bought_total: stats.totalBought,
        kwh_consumed_total: stats.totalConsumed,
        kwh_remaining_total: stats.totalRemaining,
        updated_at: new Date().toISOString()
      };

      let error;
      if (existing) {
        const result = await supabase
          .from('daily_package_stats')
          .update(snapshotData)
          .eq('organization_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
          .eq('date', today)
          .eq('kunde_type', kundeType)
          .eq('betalings_metode', betalingsMetode);
        error = result.error;
      } else {
        const result = await supabase
          .from('daily_package_stats')
          .insert({
            organization_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            date: today,
            kunde_type: kundeType,
            betalings_metode: betalingsMetode,
            ...snapshotData
          });
        error = result.error;
      }

      if (error) {
        console.error(`Error saving ${kundeType}/${betalingsMetode}:`, error);
      } else {
        console.log(`Saved ${kundeType}/${betalingsMetode}: ${stats.activePackages} kunder, Købt=${stats.totalBought}, Forbrugt=${stats.totalConsumed.toFixed(2)}, Tilbage=${stats.totalRemaining.toFixed(2)}`);
      }
    }

    // Beregn total måler-forbrug fra meter_readings_history for sammenligning
    const { data: meterHistory } = await supabase
      .from('meter_readings_history')
      .select('meter_id, energy')
      .eq('snapshot_time', '23:59')
      .gte('time', `${today}T00:00:00`)
      .lt('time', `${today}T23:59:59`);

    // Hent gårsdagens data for at beregne dagligt forbrug
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const { data: yesterdayHistory } = await supabase
      .from('meter_readings_history')
      .select('meter_id, energy')
      .eq('snapshot_time', '23:59')
      .gte('time', `${yesterdayStr}T00:00:00`)
      .lt('time', `${yesterdayStr}T23:59:59`);

    let totalMeterConsumption = 0;
    if (meterHistory && yesterdayHistory) {
      const yesterdayMap = new Map(yesterdayHistory.map(m => [m.meter_id, m.energy]));
      for (const meter of meterHistory) {
        const yesterdayEnergy = yesterdayMap.get(meter.meter_id) || 0;
        totalMeterConsumption += Math.max(0, meter.energy - yesterdayEnergy);
      }
    }

    // Total pakke-forbrug
    const totalPackageConsumed = Object.values(results).reduce((sum, r) => sum + r.consumed, 0);
    const driftConsumption = Math.max(0, totalMeterConsumption - totalPackageConsumed);

    console.log(`=== TOTALER ===`);
    console.log(`Total måler-forbrug i dag: ${totalMeterConsumption.toFixed(2)} kWh`);
    console.log(`Total pakke-forbrug: ${totalPackageConsumed.toFixed(2)} kWh`);
    console.log(`Drift-forbrug (kontor, fælleshus osv.): ${driftConsumption.toFixed(2)} kWh`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        date: today,
        summary: {
          total_customers: Object.keys(results).length,
          total_meter_kwh: totalMeterConsumption,
          total_package_kwh: totalPackageConsumed,
          drift_kwh: driftConsumption
        },
        details: aggregated
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Error in daily-package-snapshot:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
