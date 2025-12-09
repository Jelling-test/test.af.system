// =====================================================
// GENERATE-MAGIC-TOKEN Edge Function
// Genererer unik 32-tegns token for en kunde
// =====================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Portal URL - opdater til Vercel app
const PORTAL_URL = 'https://jelling.vercel.app';

// Generer random alphanumerisk token
function generateToken(length: number = 32): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { booking_id } = await req.json();

    if (!booking_id) {
      return new Response(
        JSON.stringify({ error: 'booking_id er påkrævet' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Opret Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find kunde i regular_customers
    let { data: customer, error } = await supabase
      .from('regular_customers')
      .select('id, booking_id, magic_token, first_name, last_name')
      .eq('booking_id', booking_id)
      .maybeSingle();

    let customerType = 'regular';

    // Hvis ikke fundet, prøv seasonal_customers
    if (!customer) {
      const result = await supabase
        .from('seasonal_customers')
        .select('id, booking_id, magic_token, first_name, last_name')
        .eq('booking_id', booking_id)
        .maybeSingle();
      
      customer = result.data;
      error = result.error;
      customerType = 'seasonal';
    }

    if (error) {
      throw error;
    }

    if (!customer) {
      return new Response(
        JSON.stringify({ error: 'Kunde ikke fundet', booking_id }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Hvis kunden allerede har token, returner den
    if (customer.magic_token) {
      const portalUrl = `${PORTAL_URL}/m/${booking_id}/${customer.magic_token}`;
      return new Response(
        JSON.stringify({
          success: true,
          token: customer.magic_token,
          magic_link: portalUrl,
          customer_name: `${customer.first_name} ${customer.last_name}`,
          already_existed: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generer ny unik token
    let token = generateToken(32);
    let attempts = 0;
    const maxAttempts = 5;

    // Sikr at token er unik
    while (attempts < maxAttempts) {
      const { data: existing } = await supabase
        .from(customerType === 'regular' ? 'regular_customers' : 'seasonal_customers')
        .select('id')
        .eq('magic_token', token)
        .maybeSingle();

      if (!existing) break;
      token = generateToken(32);
      attempts++;
    }

    // Gem token på kunden
    const table = customerType === 'regular' ? 'regular_customers' : 'seasonal_customers';
    const { error: updateError } = await supabase
      .from(table)
      .update({ magic_token: token })
      .eq('booking_id', booking_id);

    if (updateError) {
      throw updateError;
    }

    const portalUrl = `${PORTAL_URL}/m/${booking_id}/${token}`;

    return new Response(
      JSON.stringify({
        success: true,
        token: token,
        magic_link: portalUrl,
        customer_name: `${customer.first_name} ${customer.last_name}`,
        already_existed: false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error generating magic token:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Ukendt fejl' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
