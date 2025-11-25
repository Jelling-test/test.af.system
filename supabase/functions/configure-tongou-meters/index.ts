import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ConfigureMeterRequest {
  meters: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { meters }: ConfigureMeterRequest = await req.json();

    console.log(`Received request to configure ${meters.length} meters`);

    // Edge Functions cannot directly connect to MQTT from Supabase
    // Return success and let the client-side script handle it
    return new Response(
      JSON.stringify({
        success: true,
        message: "Configuration request received. Please use the standalone script instead.",
        configured: 0,
        failed: 0,
        total: meters.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in configure-tongou-meters function:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
