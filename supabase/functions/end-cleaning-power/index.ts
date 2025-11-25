import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Cron: Kører kl. 15:00 hver dag
// Slukker strøm på hytter hvor rengøring er færdig (ingen ny gæst ankommet)

console.log("End-cleaning-power funktion startet");

Deno.serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const today = new Date().toISOString().split('T')[0];
    console.log(`Afslutter rengørings-strøm for ${today}`);

    // Find alle aktive cleaning sessions (status = 'active')
    const { data: activeCleanings, error: fetchError } = await supabaseClient
      .from('cabin_cleaning_schedule')
      .select('*, cabins(*)')
      .eq('status', 'active');

    if (fetchError) {
      console.error('Fejl ved hentning af aktive rengørings-sessions:', fetchError);
      throw fetchError;
    }

    if (!activeCleanings || activeCleanings.length === 0) {
      console.log('Ingen aktive rengørings-sessions at afslutte');
      return new Response(JSON.stringify({
        success: true,
        message: 'Ingen aktive rengørings-sessions',
        date: today,
        count: 0
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`Fandt ${activeCleanings.length} aktive rengørings-sessions`);

    let successCount = 0;
    let errorCount = 0;

    for (const cleaning of activeCleanings) {
      try {
        // Sluk strøm
        const { error: powerOffError } = await supabaseClient
          .from('meter_commands')
          .insert({
            meter_id: cleaning.meter_id,
            command: 'set_state',
            value: 'OFF',
            status: 'pending'
          });

        if (powerOffError) {
          console.error(`Fejl ved sluk-kommando for måler ${cleaning.meter_id}:`, powerOffError);
          errorCount++;
          continue;
        }

        // Opdater status til 'completed'
        await supabaseClient
          .from('cabin_cleaning_schedule')
          .update({ status: 'completed' })
          .eq('id', cleaning.id);

        console.log(`Rengørings-strøm SLUKKET for ${cleaning.cabins?.name || cleaning.meter_id}`);
        successCount++;

      } catch (err) {
        console.error(`Fejl for cleaning ${cleaning.id}:`, err);
        errorCount++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Rengørings-strøm slukket`,
      date: today,
      total: activeCleanings.length,
      success_count: successCount,
      error_count: errorCount
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Fejl i end-cleaning-power:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
