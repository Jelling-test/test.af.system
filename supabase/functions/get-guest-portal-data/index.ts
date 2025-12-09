// =====================================================
// GET-GUEST-PORTAL-DATA Edge Function
// Henter portal data for en gæst (strøm, events, bageri, info)
// =====================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { booking_id, data_type } = await req.json();

    if (!booking_id) {
      return new Response(
        JSON.stringify({ error: 'booking_id er påkrævet' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find kunde
    let { data: customer } = await supabase
      .from('regular_customers')
      .select('*')
      .eq('booking_id', booking_id)
      .maybeSingle();

    let customerType = 'regular';
    if (!customer) {
      const result = await supabase
        .from('seasonal_customers')
        .select('*')
        .eq('booking_id', booking_id)
        .maybeSingle();
      customer = result.data;
      customerType = 'seasonal';
    }

    if (!customer) {
      return new Response(
        JSON.stringify({ error: 'Kunde ikke fundet' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response: any = { booking_id };

    // Hent specifik data baseret på data_type
    if (!data_type || data_type === 'all' || data_type === 'power') {
      // Hent strømdata
      const meters: any[] = [];
      
      // Primær måler
      if (customer.meter_id) {
        const { data: reading } = await supabase
          .from('meter_readings')
          .select('state, energy, power, voltage, current')
          .eq('meter_id', customer.meter_id)
          .order('time', { ascending: false })
          .limit(1)
          .maybeSingle();

        meters.push({
          id: customer.meter_id,
          name: customer.meter_id,
          isPrimary: true,
          isPowerOn: reading?.state === 'ON',
          energy: reading?.energy || 0,
          power: reading?.power || 0,
          voltage: reading?.voltage || 0,
          current: reading?.current || 0,
          startEnergy: parseFloat(customer.meter_start_energy) || 0
        });
      }

      // Ekstra målere
      const { data: extraMeters } = await supabase
        .from('booking_extra_meters')
        .select('*')
        .eq('booking_id', customer.id)
        .eq('booking_type', customerType);

      for (const extra of extraMeters || []) {
        const { data: reading } = await supabase
          .from('meter_readings')
          .select('state, energy, power, voltage, current')
          .eq('meter_id', extra.meter_id)
          .order('time', { ascending: false })
          .limit(1)
          .maybeSingle();

        meters.push({
          id: extra.meter_id,
          name: extra.meter_id,
          isPrimary: false,
          isPowerOn: reading?.state === 'ON',
          energy: reading?.energy || 0,
          power: reading?.power || 0,
          voltage: reading?.voltage || 0,
          current: reading?.current || 0,
          startEnergy: parseFloat(extra.meter_start_energy) || 0
        });
      }

      // Hent pakker
      const { data: pakker } = await supabase
        .from('plugin_data')
        .select('*')
        .eq('module', 'pakker')
        .eq('data->>booking_nummer', booking_id.toString())
        .eq('data->>status', 'aktiv');

      response.power = {
        meters,
        packages: pakker?.map(p => ({
          id: p.id,
          name: p.data.pakke_navn,
          totalEnheder: parseFloat(p.data.enheder) || 0,
          startEnergy: parseFloat(p.data.pakke_start_energy) || 0,
          varighedTimer: p.data.varighed_timer,
          createdAt: p.created_at
        })) || []
      };
    }

    if (!data_type || data_type === 'all' || data_type === 'events') {
      // Hent events (camp + external)
      const today = new Date().toISOString().split('T')[0];
      
      const { data: campEvents } = await supabase
        .from('camp_events')
        .select('*')
        .eq('is_active', true)
        .gte('event_date', today)
        .order('event_date', { ascending: true })
        .limit(10);

      const { data: externalEvents } = await supabase
        .from('external_events')
        .select('*')
        .eq('is_active', true)
        .gte('event_date', today)
        .order('event_date', { ascending: true })
        .limit(10);

      response.events = {
        campEvents: campEvents || [],
        externalEvents: externalEvents || []
      };
    }

    if (!data_type || data_type === 'all' || data_type === 'bakery') {
      // Hent bageri produkter + kundens ordrer
      const { data: products } = await supabase
        .from('bakery_products')
        .select('*')
        .eq('is_available', true)
        .order('sort_order', { ascending: true });

      const { data: orders } = await supabase
        .from('bakery_orders')
        .select('*')
        .eq('booking_id', booking_id)
        .order('pickup_date', { ascending: false })
        .limit(5);

      response.bakery = {
        products: products || [],
        orders: orders || []
      };
    }

    if (!data_type || data_type === 'all' || data_type === 'info') {
      // Hent praktisk info
      const { data: info } = await supabase
        .from('portal_info')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      response.info = info || [];
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error getting portal data:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Ukendt fejl' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
