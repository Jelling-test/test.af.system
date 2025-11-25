import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { meter_id } = await req.json();

    if (!meter_id) {
      return new Response(
        JSON.stringify({ error: "meter_id er påkrævet" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    console.log(`Sletter måler: ${meter_id}`);

    // 1. Find måleren i power_meters
    const { data: meter, error: fetchError } = await supabaseAdmin
      .from("power_meters")
      .select("id, meter_number")
      .eq("meter_number", meter_id)
      .single();

    if (fetchError || !meter) {
      console.error("Måler ikke fundet:", fetchError);
      return new Response(
        JSON.stringify({ error: "Måleren blev ikke fundet" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Fundet måler:`, meter);

    // 2. Slet fra meter_readings_history (hvis den findes)
    const { error: historyError } = await supabaseAdmin
      .from("meter_readings_history")
      .delete()
      .eq("meter_id", meter_id);

    if (historyError) {
      console.warn("History delete fejlede (måske ikke eksisterer):", historyError);
    } else {
      console.log("History slettet");
    }

    // 3. Slet fra meter_readings
    const { error: readingsError } = await supabaseAdmin
      .from("meter_readings")
      .delete()
      .eq("meter_id", meter_id);

    if (readingsError) {
      console.error("Readings delete fejlede:", readingsError);
      throw readingsError;
    }

    console.log("Readings slettet");

    // 4. Slet fra power_meters
    const { error: meterError } = await supabaseAdmin
      .from("power_meters")
      .delete()
      .eq("id", meter.id);

    if (meterError) {
      console.error("Power meter delete fejlede:", meterError);
      throw meterError;
    }

    console.log("Måler slettet fra power_meters");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Måler "${meter_id}" slettet permanent`,
        deleted_meter: meter
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error i delete-meter:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
