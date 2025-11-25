import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyPlateRequest {
  plate_raw: string;
  camera_serial?: string;
  direction?: string;
  source?: string;
}

// Normalize plate: UPPERCASE, remove whitespace and special chars
function normalizePlate(plate: string): string {
  return plate.toUpperCase().replace(/[\s\.\-]/g, '');
}

// Generate rate limit bucket key
function getRateLimitBucket(plate_norm: string, camera_serial?: string): string {
  return `${plate_norm}:${camera_serial || 'unknown'}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Security: Check shared token
    const authHeader = req.headers.get('authorization');
    const sharedToken = Deno.env.get('EDGE_SHARED_TOKEN');
    
    if (sharedToken && authHeader !== `Bearer ${sharedToken}`) {
      console.warn('Unauthorized access attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { plate_raw, camera_serial, direction, source = 'api' }: VerifyPlateRequest = await req.json();

    if (!plate_raw) {
      return new Response(
        JSON.stringify({ error: 'plate_raw is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const plate_norm = normalizePlate(plate_raw);
    const ts = new Date().toISOString();
    const rl_bucket = getRateLimitBucket(plate_norm, camera_serial);

    console.log('Verify plate request:', { plate_raw, plate_norm, camera_serial, direction, source });

    // Rate limit check: reject if same plate+camera within last 5 seconds
    const fiveSecsAgo = new Date(Date.now() - 5000).toISOString();
    const { data: recentLogs, error: rlError } = await (supabase as any)
      .schema('access')
      .from('barrier_logs')
      .select('id')
      .eq('plate_norm', plate_norm)
      .eq('camera_serial', camera_serial || '')
      .gte('ts', fiveSecsAgo)
      .limit(1);

    if (rlError) {
      console.error('Rate limit check error:', rlError);
    }

    if (recentLogs && recentLogs.length > 0) {
      console.log('Rate limit hit for:', rl_bucket);
      return new Response(
        JSON.stringify({ 
          allowed: false, 
          reason: 'rate_limited',
          message: 'Too many requests. Please wait 5 seconds.' 
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check against manual.customers (whitel ist)
    const { data: manualCustomer, error: manualError } = await supabase
      .schema('manual')
      .from('customers')
      .select('id, name, category, valid_from, valid_to')
      .eq('plate_norm', plate_norm)
      .maybeSingle();

    let allowed = false;
    let reason = 'unknown_plate';
    let manual_id: string | undefined;

    if (manualCustomer) {
      const now = new Date();
      const validFrom = new Date(manualCustomer.valid_from);
      const validTo = manualCustomer.valid_to ? new Date(manualCustomer.valid_to) : null;

      if (now >= validFrom && (!validTo || now <= validTo)) {
        allowed = true;
        reason = 'manual_whitelist';
        manual_id = manualCustomer.id;
        console.log('Plate allowed via manual whitelist:', plate_norm, manualCustomer.name);
      } else {
        reason = 'manual_expired';
        console.log('Plate found but expired:', plate_norm);
      }
    } else {
      // TODO: Check against bookings table if needed
      // For now, we only check manual customers
      console.log('Plate not found in whitelist:', plate_norm);
    }

    // Insert barrier log
    const { data: logData, error: logError } = await (supabase as any)
      .schema('access')
      .from('barrier_logs')
      .insert({
        ts,
        source,
        plate_raw,
        plate_norm,
        allowed,
        reason,
        camera_serial,
        direction,
        manual_id,
        meta: { checked_at: ts }
      })
      .select()
      .single();

    if (logError) {
      console.error('Error inserting barrier log:', logError);
      throw logError;
    }

    console.log('Barrier log created:', logData.id);

    // If allowed, create control request to open barrier
    if (allowed) {
      const { data: controlData, error: controlError } = await (supabase as any)
        .schema('access')
        .from('control_requests')
        .insert({
          requested_at: ts,
          source: 'auto',
          action: 'open',
          camera_serial,
          status: 'pending',
          meta: { 
            triggered_by_plate: plate_norm,
            log_id: logData.id 
          },
          rl_bucket
        })
        .select()
        .single();

      if (controlError) {
        console.error('Error creating control request:', controlError);
      } else {
        console.log('Control request created:', controlData.id);
      }
    }

    return new Response(
      JSON.stringify({ 
        allowed, 
        reason,
        plate_norm,
        log_id: logData.id,
        message: allowed ? 'Access granted' : 'Access denied'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in verify-plate:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
