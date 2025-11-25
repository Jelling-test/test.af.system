import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validering for kørende gæster (dagspakke med udløb)
async function validateRegularCustomer(supabase: any, booking_nummer: number) {
  // Hent ALLE pakker for kunden
  const { data: allePakker } = await supabase
    .from('plugin_data')
    .select('*')
    .eq('organization_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    .eq('module', 'pakker')
    .eq('data->>booking_nummer', booking_nummer.toString());

  if (!allePakker || allePakker.length === 0) {
    throw new Error('Du skal købe en dagspakke før du kan tænde strømmen');
  }

  // Find dagspakke (har varighed_timer)
  const dagspakke = allePakker.find((p: any) => 
    p.data.varighed_timer !== null && p.data.varighed_timer !== undefined
  );

  if (!dagspakke || dagspakke.data.status !== 'aktiv') {
    throw new Error('Din dagspakke er udløbet eller opbrugt. Køb en ny pakke for at tænde strømmen.');
  }

  // Tjek om dagspakke er udløbet på tid
  const packageStartTime = new Date(dagspakke.created_at);
  const now = new Date();
  const hoursElapsed = (now.getTime() - packageStartTime.getTime()) / (1000 * 60 * 60);
  
  if (hoursElapsed >= dagspakke.data.varighed_timer) {
    throw new Error('Din dagspakke er udløbet. Køb en ny pakke for at tænde strømmen.');
  }

  // Tjek om enheder er opbrugt
  await checkUnitsRemaining(supabase, booking_nummer, 'regular_customers', allePakker);
}

// Validering for sæson gæster (startpakke uden udløb)
async function validateSeasonalCustomer(supabase: any, booking_nummer: number) {
  // Hent ALLE pakker for kunden
  const { data: allePakker } = await supabase
    .from('plugin_data')
    .select('*')
    .eq('organization_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    .eq('module', 'pakker')
    .eq('data->>booking_nummer', booking_nummer.toString());

  if (!allePakker || allePakker.length === 0) {
    throw new Error('Du skal købe en aktiverings pakke før du kan tænde strømmen');
  }

  // For sæson gæster: Tjek KUN om der er enheder tilbage
  // Status på pakker er irrelevant - kun total enheder tæller
  await checkUnitsRemaining(supabase, booking_nummer, 'seasonal_customers', allePakker);
}

// Fælles funktion til at tjekke om enheder er tilbage
async function checkUnitsRemaining(supabase: any, booking_nummer: number, customerTable: string, allePakker: any[]) {
  // Brug kun aktive pakker til beregning
  const aktivePakker = allePakker.filter((p: any) => p.data.status === 'aktiv');

  if (aktivePakker.length === 0) {
    throw new Error('Du har ingen aktive pakker. Køb en tillægspakke for at tænde strømmen.');
  }

  // Hent kunde info
  const { data: kunde } = await supabase
    .from(customerTable)
    .select('meter_start_energy, meter_id')
    .eq('booking_id', booking_nummer)
    .maybeSingle();

  if (!kunde || !kunde.meter_id) {
    return; // Ingen måler = kan ikke tjekke forbrug
  }

  // Hent seneste meter reading
  const { data: latestReading } = await supabase
    .from('meter_readings')
    .select('energy')
    .eq('meter_id', kunde.meter_id)
    .order('time', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestReading) {
    return; // Ingen reading = kan ikke tjekke forbrug
  }

  // Beregn forbrug
  const currentEnergy = latestReading.energy;
  const startEnergy = parseFloat(kunde.meter_start_energy || '0');
  const usage = currentEnergy - startEnergy;

  // Sum alle pakke enheder
  const totalUnits = aktivePakker.reduce((sum: number, pkg: any) => 
    sum + (parseFloat(pkg.data.enheder) || 0), 0
  );

  if (usage >= totalUnits) {
    throw new Error('Du har brugt alle dine enheder. Køb en tillægspakke for at tænde strømmen.');
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { maaler_id, action, booking_nummer } = await req.json();

    console.log('Toggle power request:', { maaler_id, action, booking_nummer });

    if (!maaler_id || !action || !booking_nummer) {
      throw new Error('Missing required parameters');
    }

    // Hvis action er 'on', valider at kunden kan tænde strømmen
    if (action === 'on') {
      // Tjek om kunden er kørende eller sæson
      const { data: regularCustomer } = await supabase
        .from('regular_customers')
        .select('booking_id')
        .eq('booking_id', booking_nummer)
        .maybeSingle();

      const kundeType = regularCustomer ? 'kørende' : 'sæson';

      if (kundeType === 'kørende') {
        await validateRegularCustomer(supabase, booking_nummer);
      } else {
        await validateSeasonalCustomer(supabase, booking_nummer);
      }
    }

    // Insert command into meter_commands table (same as Dashboard and Admin)
    const { error: insertError } = await supabase
      .from('meter_commands')
      .insert({
        meter_id: maaler_id,
        command: 'set_state',
        value: action === 'on' ? 'ON' : 'OFF',
        status: 'pending'
      });

    if (insertError) throw insertError;

    console.log('Power toggled successfully:', { maaler_id, action });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Power ${action === 'on' ? 'turned on' : 'turned off'}`,
        maaler_id,
        action,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error toggling power:', error);
    console.error('Error type:', typeof error);
    console.error('Error instanceof Error:', error instanceof Error);
    console.error('Error stringified:', JSON.stringify(error));
    
    let errorMessage = 'An unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object' && 'message' in error) {
      errorMessage = String(error.message);
    }
    
    // Returner status 200 med error i body så Supabase client kan parse det
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  }
});
