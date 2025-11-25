import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("create-checkout function called");

    const { organization_id, booking_nummer, pakke_type_id, maaler_id } = await req.json();

    console.log("Request params:", {
      organization_id,
      booking_nummer,
      pakke_type_id,
      maaler_id,
    });

    // Validate required parameters
    if (!organization_id || !booking_nummer || !pakke_type_id || !maaler_id) {
      throw new Error("Missing required parameters");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get package details from plugin_data
    const { data: packageData, error: packageError } = await supabase
      .from("plugin_data")
      .select("*")
      .eq("organization_id", organization_id)
      .eq("module", "pakke_typer")
      .eq("ref_id", pakke_type_id)
      .single();

    if (packageError || !packageData) {
      console.error("Package not found:", packageError);
      throw new Error("Package not found");
    }

    const pkgData = packageData.data;
    console.log("Package data:", pkgData);

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("Stripe secret key not configured");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "dkk",
            product_data: {
              name: `${pkgData.navn} - ${pkgData.enheder} enheder`,
              description: pkgData.beskrivelse || `Strømpakke til booking ${booking_nummer}`,
              metadata: {
                booking_nummer,
                maaler_id,
                pakke_type_id,
              },
            },
            unit_amount: Math.round(parseFloat(pkgData.pris_dkk || pkgData.pris || 0) * 100), // Convert to øre
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/betaling-gennemfoert?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/betaling-annulleret`,
      metadata: {
        organization_id,
        booking_nummer,
        pakke_type_id,
        maaler_id,
      },
    });

    console.log("Checkout session created:", session.id);

    return new Response(
      JSON.stringify({
        checkout_url: session.url,
        session_id: session.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in create-checkout function:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
