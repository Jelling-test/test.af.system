import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Cron: Kører kl. 10:00 hver dag
// Tænder strøm på hytter med checkout i dag for rengøring

console.log("Start-cleaning-power funktion startet");

Deno.serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const today = new Date().toISOString().split('T')[0];
    console.log(`Checker rengørings-schedule for ${today}`);

    // Find alle scheduled cleaning sessions for i dag
    const { data: scheduledCleanings, error: fetchError } = await supabaseClient
      .from('cabin_cleaning_schedule')
      .select('*, cabins(*)')
      .eq('checkout_date', today)
      .eq('status', 'scheduled');

    if (fetchError) {
      console.error('Fejl ved hentning af rengørings-schedule:', fetchError);
      throw fetchError;
    }

    if (!scheduledCleanings || scheduledCleanings.length === 0) {
      console.log('Ingen rengøring planlagt for i dag');
      return new Response(JSON.stringify({
        success: true,
        message: 'Ingen rengøring planlagt',
        date: today,
        count: 0
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`Fandt ${scheduledCleanings.length} hytter til rengøring`);

    let successCount = 0;
    let errorCount = 0;

    for (const cleaning of scheduledCleanings) {
      try {
        // Tænd strøm
        const { error: powerOnError } = await supabaseClient
          .from('meter_commands')
          .insert({
            meter_id: cleaning.meter_id,
            command: 'set_state',
            value: 'ON',
            status: 'pending'
          });

        if (powerOnError) {
          console.error(`Fejl ved tænd-kommando for måler ${cleaning.meter_id}:`, powerOnError);
          errorCount++;
          continue;
        }

        // Opdater status til 'active'
        await supabaseClient
          .from('cabin_cleaning_schedule')
          .update({ status: 'active' })
          .eq('id', cleaning.id);

        console.log(`Rengørings-strøm TÆNDT for ${cleaning.cabins?.name || cleaning.meter_id}`);
        successCount++;

      } catch (err) {
        console.error(`Fejl for cleaning ${cleaning.id}:`, err);
        errorCount++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Rengørings-strøm tændt`,
      date: today,
      total: scheduledCleanings.length,
      success_count: successCount,
      error_count: errorCount
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Fejl i start-cleaning-power:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
