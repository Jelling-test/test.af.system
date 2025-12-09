// =====================================================
// VALIDATE-MAGIC-LINK Edge Function
// Validerer magic link og returnerer gæstedata
// =====================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { booking_id, token } = await req.json();

    if (!booking_id || !token) {
      return new Response(
        JSON.stringify({ valid: false, error: 'booking_id og token er påkrævet' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Opret Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find kunde i regular_customers
    let { data: customer } = await supabase
      .from('regular_customers')
      .select('*')
      .eq('booking_id', booking_id)
      .eq('magic_token', token)
      .maybeSingle();

    let bookingType = 'camping';

    // Hvis ikke fundet, prøv seasonal_customers
    if (!customer) {
      const result = await supabase
        .from('seasonal_customers')
        .select('*')
        .eq('booking_id', booking_id)
        .eq('magic_token', token)
        .maybeSingle();
      
      customer = result.data;
      bookingType = 'seasonal';
    }

    // Tjek om kunden er en hytte-gæst
    if (customer && customer.spot_number) {
      const spotNum = parseInt(customer.spot_number);
      if (spotNum >= 26 && spotNum <= 42) {
        bookingType = 'cabin';
      }
    }

    if (!customer) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Ugyldigt link' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Bestem gæstestatus
    let guestStatus = 'upcoming'; // Kommende
    if (customer.checked_out) {
      guestStatus = 'departed'; // Afrejst
    } else if (customer.checked_in) {
      guestStatus = 'checked_in'; // Indlogeret
    }

    // Returner gæstedata
    const guestData = {
      valid: true,
      guest: {
        firstName: customer.first_name,
        lastName: customer.last_name,
        email: customer.email,
        phone: customer.phone,
        language: customer.language || 'da',
        country: customer.country || 'DK',
        arrivalDate: customer.arrival_date,
        departureDate: customer.departure_date,
        spotNumber: customer.spot_number,
        meterId: customer.meter_id,
        checkedIn: customer.checked_in || false,
        checkedOut: customer.checked_out || false,
        bookingType: bookingType,
        bookingId: customer.booking_id,
        guestStatus: guestStatus,
        previousVisits: customer.previous_visits || 0
      }
    };

    return new Response(
      JSON.stringify(guestData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error validating magic link:', error);
    return new Response(
      JSON.stringify({ valid: false, error: error.message || 'Ukendt fejl' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
