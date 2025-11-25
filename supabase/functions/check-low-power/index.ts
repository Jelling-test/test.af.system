import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') || 'check-low-power-secret-2024';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    // Tillad både webhook secret og authorization header (eller ingen auth for cron jobs)
    const webhookSecret = req.headers.get('x-webhook-secret');
    const authHeader = req.headers.get('authorization');
    
    // Log for debugging
    console.log('Auth check:', { 
      hasWebhookSecret: !!webhookSecret, 
      webhookSecretMatch: webhookSecret === WEBHOOK_SECRET,
      hasAuthHeader: !!authHeader 
    });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('Checking for low power packages...');

    // Hent email templates med thresholds
    const { data: templates } = await supabase
      .from('plugin_data')
      .select('*')
      .eq('organization_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
      .eq('module', 'email_templates')
      .in('ref_id', ['advarsel_koerende', 'advarsel_saeson']);

    const thresholds: any = {};
    templates?.forEach((t: any) => {
      const type = t.ref_id === 'advarsel_koerende' ? 'kørende' : 'sæson';
      thresholds[type] = t.data.threshold_enheder || (type === 'kørende' ? 2 : 10);
    });

    console.log('Thresholds:', thresholds);

    // Hent alle aktive pakker
    const { data: pakker, error: pakkerError } = await supabase
      .from('plugin_data')
      .select('*')
      .eq('organization_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
      .eq('module', 'pakker')
      .eq('data->>status', 'aktiv');

    if (pakkerError) throw pakkerError;

    console.log(`Found ${pakker?.length || 0} active packages`);

    let emailsSent = 0;
    let emailsSkipped = 0;
    let emailsFailed = 0;

    // Tjek for lav strøm og send advarsler (beregn dynamisk fra meter)
    for (const pakke of pakker || []) {
      const bookingNummer = pakke.data.booking_nummer;
      const kundeType = pakke.data.kunde_type || 'kørende';
      const threshold = thresholds[kundeType] || 5;
      const advarselSendt = pakke.data.advarsel_sendt === true;

      // Hent kunde for at få meter_start_energy
      const { data: kunde } = await supabase
        .from('regular_customers')
        .select('meter_id, meter_start_energy')
        .eq('booking_id', bookingNummer)
        .maybeSingle();

      let actualKunde = kunde;
      
      if (!actualKunde || !actualKunde.meter_id) {
        // Prøv sæson kunde
        const { data: seasonKunde } = await supabase
          .from('seasonal_customers')
          .select('meter_id, meter_start_energy')
          .eq('booking_id', bookingNummer)
          .maybeSingle();
        
        if (!seasonKunde || !seasonKunde.meter_id) continue;
        actualKunde = seasonKunde;
      }

      // Hent nuværende meter reading
      const { data: meterReading } = await supabase
        .from('meter_readings')
        .select('energy')
        .eq('meter_id', actualKunde.meter_id)
        .order('time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!meterReading) continue;

      // Beregn forbrug
      const currentEnergy = meterReading.energy;
      const startEnergy = actualKunde.meter_start_energy || 0;
      const forbrugt = currentEnergy - startEnergy;

      // Hent ALLE aktive pakker for kunden (dagspakke + tillæg)
      const { data: allePakker } = await supabase
        .from('plugin_data')
        .select('*')
        .eq('organization_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('module', 'pakker')
        .eq('data->>booking_nummer', bookingNummer.toString())
        .eq('data->>status', 'aktiv');

      // Beregn total enheder
      let totalEnheder = 0;
      for (const p of allePakker || []) {
        const enheder = parseFloat(p.data.enheder_total || p.data.enheder || '0');
        totalEnheder += enheder;
      }

      const enhederTilbage = totalEnheder - forbrugt;

      // Tjek om pakke er under threshold og advarsel ikke er sendt
      if (enhederTilbage < threshold && !advarselSendt) {
        console.log(`Package ${pakke.id} below threshold (${enhederTilbage} < ${threshold}), sending warning...`);

        try {
          // Kald send-low-power-warning Edge Function
          const response = await fetch(`${SUPABASE_URL}/functions/v1/send-low-power-warning`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              pakke_id: pakke.id,
              booking_nummer: bookingNummer,
              enheder_tilbage: enhederTilbage,
              kunde_type: kundeType,
            }),
          });

          if (response.ok) {
            // Marker advarsel som sendt
            await supabase
              .from('plugin_data')
              .update({
                data: {
                  ...pakke.data,
                  advarsel_sendt: true,
                  advarsel_sendt_dato: new Date().toISOString(),
                },
              })
              .eq('id', pakke.id);

            emailsSent++;
            console.log(`Warning sent for package ${pakke.id}`);
          } else {
            const errorText = await response.text();
            console.error(`Failed to send warning for package ${pakke.id}:`, errorText);
            emailsFailed++;
          }
        } catch (error) {
          console.error(`Error sending warning for package ${pakke.id}:`, error);
          emailsFailed++;
        }
      } else {
        emailsSkipped++;
      }
    }

    console.log(`Summary: ${emailsSent} emails sent, ${emailsSkipped} skipped, ${emailsFailed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true,
        summary: {
          total_packages: pakker?.length || 0,
          emails_sent: emailsSent,
          emails_skipped: emailsSkipped,
          emails_failed: emailsFailed,
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in check-low-power:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
