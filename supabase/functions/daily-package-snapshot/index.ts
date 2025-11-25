import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split('T')[0];
    console.log(`Running daily package snapshot for ${today}`);

    // Process for each kunde_type and betalings_metode combination
    const kundeTypes = ['kørende', 'sæson'];
    const betalingsMetoder = ['stripe', 'reception', 'gratis'];

    for (const kundeType of kundeTypes) {
      for (const betalingsMetode of betalingsMetoder) {
        console.log(`Processing ${kundeType} - ${betalingsMetode}`);

        // Get all active packages for this kunde_type
        const { data: packages } = await supabase
          .from('plugin_data')
          .select('*')
          .eq('module', 'pakker')
          .eq('data->>status', 'aktiv')
          .eq('data->>kunde_type', kundeType)
          .eq('data->>betaling_metode', betalingsMetode);

        if (!packages || packages.length === 0) {
          console.log(`No active packages for ${kundeType} - ${betalingsMetode}`);
          continue;
        }

        // Simply sum up all enheder from active packages
        let totalKwhRemaining = 0;
        const activePackagesCount = packages.length;

        for (const pkg of packages) {
          const kwhBought = parseFloat(pkg.data.enheder || '0');
          totalKwhRemaining += kwhBought;
        }

        // Check if row exists, then UPDATE only snapshot fields
        const { data: existing } = await supabase
          .from('daily_package_stats')
          .select('*')
          .eq('organization_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
          .eq('date', today)
          .eq('kunde_type', kundeType)
          .eq('betalings_metode', betalingsMetode)
          .maybeSingle();
        
        let snapshotError;
        if (existing) {
          // UPDATE - only update snapshot fields
          const { error } = await supabase
            .from('daily_package_stats')
            .update({
              active_packages: activePackagesCount,
              kwh_remaining_total: totalKwhRemaining,
              kwh_consumed_today: 0,
              updated_at: new Date().toISOString()
            })
            .eq('organization_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
            .eq('date', today)
            .eq('kunde_type', kundeType)
            .eq('betalings_metode', betalingsMetode);
          snapshotError = error;
        } else {
          // INSERT - create new row with all fields
          const { error } = await supabase
            .from('daily_package_stats')
            .insert({
              organization_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
              date: today,
              kunde_type: kundeType,
              betalings_metode: betalingsMetode,
              active_packages: activePackagesCount,
              kwh_remaining_total: totalKwhRemaining,
              kwh_consumed_today: 0,
              updated_at: new Date().toISOString()
            });
          snapshotError = error;
        }

        if (snapshotError) {
          console.error(`Error updating snapshot for ${kundeType} - ${betalingsMetode}:`, snapshotError);
        } else {
          console.log(`Snapshot updated: ${activePackagesCount} packages, ${totalKwhRemaining.toFixed(2)} kWh remaining`);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Daily package snapshot completed for ${today}` 
      }),
      { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Error in daily-package-snapshot:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
});
