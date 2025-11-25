import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

console.log("Monitor power usage function started");

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting power usage monitoring...');

    // Get all checked-in customers with meters
    const { data: seasonalCustomers } = await supabase
      .from('seasonal_customers')
      .select('*')
      .eq('checked_in', true)
      .not('meter_id', 'is', null)
      .not('meter_start_energy', 'is', null);

    const { data: regularCustomers } = await supabase
      .from('regular_customers')
      .select('*')
      .eq('checked_in', true)
      .not('meter_id', 'is', null)
      .not('meter_start_energy', 'is', null);

    const allCustomers = [
      ...(seasonalCustomers || []).map(c => ({ ...c, type: 'seasonal' })),
      ...(regularCustomers || []).map(c => ({ ...c, type: 'regular' }))
    ];

    console.log(`Found ${allCustomers.length} customers with meters`);

    let turnedOff = 0;

    for (const customer of allCustomers) {
      try {
        // Get active packages for this customer
        const { data: packages } = await supabase
          .from('plugin_data')
          .select('*')
          .eq('organization_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
          .eq('module', 'pakker')
          .eq('data->>booking_nummer', customer.booking_id.toString())
          .eq('data->>status', 'aktiv');

        if (!packages || packages.length === 0) {
          console.log(`No active packages for booking ${customer.booking_id}`);
          continue;
        }

        // Sort packages: dagspakke first (has varighed_timer), then tillæg
        const sortedPackages = [...packages].sort((a, b) => {
          const aHasDuration = a.data.varighed_timer !== null && a.data.varighed_timer !== undefined;
          const bHasDuration = b.data.varighed_timer !== null && b.data.varighed_timer !== undefined;
          if (aHasDuration && !bHasDuration) return -1;
          if (!aHasDuration && bHasDuration) return 1;
          return 0;
        });

        // Find dagspakke (first package with varighed_timer)
        const dagspakke = sortedPackages.find(p => 
          p.data.varighed_timer !== null && p.data.varighed_timer !== undefined
        );

        // Get latest meter reading
        const { data: latestReading } = await supabase
          .from('meter_readings')
          .select('energy, time')
          .eq('meter_id', customer.meter_id)
          .order('time', { ascending: false })
          .limit(1)
          .single();

        if (!latestReading) {
          console.log(`No meter reading for ${customer.meter_id}`);
          continue;
        }

        // Calculate usage
        const currentEnergy = latestReading.energy;
        const startEnergy = parseFloat(customer.meter_start_energy || '0');
        const usage = currentEnergy - startEnergy;

        // Sum all package units
        const totalUnits = packages.reduce((sum, pkg) => sum + (parseFloat(pkg.data.enheder) || 0), 0);

        console.log(`Booking ${customer.booking_id}: Usage ${usage.toFixed(2)} kWh / ${totalUnits} kWh`);

        // Check if usage exceeded
        if (usage >= totalUnits) {
          console.log(`⚠️ Usage exceeded for booking ${customer.booking_id} - turning off meter`);

          // Turn off meter via meter_commands table (same as Dashboard and Admin)
          try {
            await supabase
              .from('meter_commands')
              .insert({
                meter_id: customer.meter_id,
                command: 'set_state',
                value: 'OFF',
                status: 'pending'
              });
            console.log(`Meter command inserted for ${customer.meter_id}`);
          } catch (mqttError) {
            console.error('Failed to insert meter command:', mqttError);
          }

          // Mark ONLY dagspakke as depleted, NOT tillægspakker
          // Tillægspakker skal forblive 'aktiv' - de bliver bare inaktive i frontend
          if (dagspakke) {
            await supabase
              .from('plugin_data')
              .update({
                data: {
                  ...dagspakke.data,
                  status: 'opbrugt',
                  depleted_at: new Date().toISOString()
                }
              })
              .eq('id', dagspakke.id);
          }

          turnedOff++;
        }

        // For regular customers with dagspakke, check time limit
        if (customer.type === 'regular' && dagspakke) {
          // FIX: Use dagspakke created_at instead of meter_start_time
          const packageStartTime = new Date(dagspakke.created_at);
          const now = new Date();
          const hoursElapsed = (now.getTime() - packageStartTime.getTime()) / (1000 * 60 * 60);
          const timeLimit = dagspakke.data.varighed_timer;

          if (hoursElapsed >= timeLimit) {
            console.log(`⏰ Time limit exceeded for booking ${customer.booking_id} - turning off meter`);

            // Turn off meter via meter_commands table (same as Dashboard and Admin)
            try {
              await supabase
                .from('meter_commands')
                .insert({
                  meter_id: customer.meter_id,
                  command: 'set_state',
                  value: 'OFF',
                  status: 'pending'
                });
              console.log(`Meter command inserted for ${customer.meter_id}`);
            } catch (mqttError) {
              console.error('Failed to insert meter command:', mqttError);
            }

            // FIX: Mark ONLY dagspakke as expired, NOT tillægspakker
            await supabase
              .from('plugin_data')
              .update({
                data: {
                  ...dagspakke.data,
                  status: 'udløbet',
                  expired_at: new Date().toISOString()
                }
              })
              .eq('id', dagspakke.id);

            turnedOff++;
          }
        }

      } catch (error) {
        console.error(`Error processing customer ${customer.booking_id}:`, error);
      }
    }

    console.log(`Monitoring complete. Turned off ${turnedOff} meters.`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Power usage monitoring complete',
        customers_checked: allCustomers.length,
        meters_turned_off: turnedOff,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in monitor-power-usage:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
