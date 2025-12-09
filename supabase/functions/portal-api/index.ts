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
