// =====================================================
// PORTAL-API Edge Function
// Håndterer events og praktisk info til gæsteportalen
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'events';

    // GET EVENTS (kommende events)
    if (action === 'events') {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: events, error } = await supabase
        .from('camp_events')
        .select('*')
        .eq('is_active', true)
        .gte('event_date', today)
        .order('event_date', { ascending: true })
        .order('event_time', { ascending: true })
        .limit(20);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, events }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET PORTAL INFO
    if (action === 'info') {
      const { data: info, error } = await supabase
        .from('portal_info')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, info }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SEARCH AVAILABLE METERS
    // Samme logik som VaelgMaaler.tsx i main systemet
    if (action === 'search-meters') {
      const query = url.searchParams.get('query') || '';
      
      if (query.length === 0) {
        return new Response(
          JSON.stringify({ success: true, meters: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 1. Hent målere der matcher søgning og er markeret ledige
      const { data: meters, error } = await supabase
        .from('power_meters')
        .select('id, meter_number, spot_number, is_online')
        .eq('is_available', true)
        .ilike('meter_number', `%${query}%`)
        .limit(20);

      if (error) throw error;

      // 2. HYTTE-FILTER: Hent alle målere der er låst til hytter
      const { data: cabinMeters } = await supabase
        .from('cabins')
        .select('meter_id')
        .not('meter_id', 'is', null);

      const cabinMeterIds = new Set(cabinMeters?.map((c: any) => c.meter_id) || []);

      // 3. Hent alle tildelte målere fra kunder (checked ind)
      const { data: seasonalCustomers } = await supabase
        .from('seasonal_customers')
        .select('meter_id')
        .eq('checked_in', true)
        .not('meter_id', 'is', null);

      const { data: regularCustomers } = await supabase
        .from('regular_customers')
        .select('meter_id')
        .eq('checked_in', true)
        .not('meter_id', 'is', null);

      // 4. Hent ekstra målere (tilknyttet bookinger)
      const { data: extraMeters } = await supabase
        .from('booking_extra_meters')
        .select('meter_id');

      // 5. Opret set af tildelte måler IDs
      const assignedMeterIds = new Set([
        ...(seasonalCustomers?.map((c: any) => c.meter_id) || []),
        ...(regularCustomers?.map((c: any) => c.meter_id) || []),
        ...(extraMeters?.map((m: any) => m.meter_id) || []),
      ]);

      // 6. Filtrer: kun online, ikke tildelt, ikke hytte-måler
      const availableMeters = (meters || [])
        .filter((meter: any) => {
          // Skip hvis måler er tildelt en kunde
          if (assignedMeterIds.has(meter.meter_number)) {
            return false;
          }
          // Skip hvis måler er låst til en hytte
          if (cabinMeterIds.has(meter.meter_number)) {
            return false;
          }
          // Kun inkluder online målere
          return meter.is_online === true;
        })
        .map((meter: any) => ({
          id: meter.id,
          meter_number: meter.meter_number,
          spot_number: meter.spot_number,
        }));

      return new Response(
        JSON.stringify({ success: true, meters: availableMeters }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET ALL (events + info)
    if (action === 'all') {
      const today = new Date().toISOString().split('T')[0];

      const [eventsResult, infoResult] = await Promise.all([
        supabase
          .from('camp_events')
          .select('*')
          .eq('is_active', true)
          .gte('event_date', today)
          .order('event_date', { ascending: true })
          .limit(10),
        supabase
          .from('portal_info')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
      ]);

      return new Response(
        JSON.stringify({ 
          success: true, 
          events: eventsResult.data || [],
          info: infoResult.data || []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in portal-api:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Ukendt fejl' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
