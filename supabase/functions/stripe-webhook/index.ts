import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeSecretKey || !stripeWebhookSecret) {
      throw new Error("Missing Stripe configuration");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    // Get the signature from headers
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      throw new Error("No signature found");
    }

    // Get the raw body
    const body = await req.text();

    // Verify the webhook signature (async version for Deno/Edge Functions)
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      console.error("Error details:", err instanceof Error ? err.message : String(err));
      return new Response(
        JSON.stringify({ error: "Invalid signature", details: err instanceof Error ? err.message : String(err) }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Webhook event received:", event.type);
    console.log("Event data:", JSON.stringify(event.data.object).substring(0, 200));

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("Checkout session completed:", session.id);

        const metadata = session.metadata;
        if (!metadata) {
          console.error("No metadata found in session");
          break;
        }

        const { organization_id, booking_nummer, pakke_type_id, maaler_id } = metadata;

        // Get package details
        const { data: packageData, error: packageError } = await supabase
          .from("plugin_data")
          .select("*")
          .eq("organization_id", organization_id)
          .eq("module", "pakke_typer")
          .eq("ref_id", pakke_type_id)
          .single();

        if (packageError || !packageData) {
          console.error("Package not found:", packageError);
          break;
        }

        const pkgData = packageData.data;

        // SECURITY: Validate that meter belongs to this customer or is available
        // maaler_id is the friendly name (meter_number), not UUID
        const meterNumber = maaler_id;
        
        // If not 'default', validate meter ownership
        if (meterNumber !== 'default') {
          // Check if customer already has this meter assigned
          const { data: customerData } = await supabase
            .from('regular_customers')
            .select('meter_id')
            .eq('booking_id', booking_nummer)
            .maybeSingle();

          const { data: seasonalData } = await supabase
            .from('seasonal_customers')
            .select('meter_id')
            .eq('booking_id', booking_nummer)
            .maybeSingle();

          const existingMeter = customerData?.meter_id || seasonalData?.meter_id;

          // If customer has a meter, it MUST match the one in metadata
          if (existingMeter && existingMeter !== meterNumber) {
            console.error(`Security: Customer ${booking_nummer} tried to use meter ${meterNumber} but owns ${existingMeter}`);
            break;
          }

          // If customer has no meter, verify the meter is available
          if (!existingMeter) {
            const { data: meterData } = await supabase
              .from('power_meters')
              .select('is_available, current_customer_id')
              .eq('meter_number', meterNumber)
              .maybeSingle();

            if (!meterData?.is_available) {
              console.error(`Security: Meter ${meterNumber} is not available for customer ${booking_nummer}`);
              break;
            }
          }
        }
        
        console.log(`Using meter: ${meterNumber}`);

        // Get current meter reading for start energy using meter_number
        const { data: meterReading } = await supabase
          .from("meter_readings")
          .select("energy, time")
          .eq("meter_id", meterNumber)
          .order("time", { ascending: false })
          .limit(1)
          .single();

        const startEnergy = meterReading?.energy || 0;
        console.log(`Meter ${meterNumber} current energy: ${startEnergy} kWh`);

        // Create package record
        const packageId = crypto.randomUUID();
        const now = new Date().toISOString();

        // Determine pakke_type based on varighed_timer
        const varighedTimer = pkgData.varighed_timer || null;
        const pakkeType = varighedTimer ? "dags" : "tillæg";

        const { error: insertError } = await supabase
          .from("plugin_data")
          .insert({
            organization_id,
            module: "pakker",
            ref_id: packageId,
            key: `pakke_${booking_nummer}_${Date.now()}`,
            data: {
              booking_nummer,
              pakke_navn: pkgData.navn,
              pakke_type_id,
              pakke_type: pakkeType,
              enheder: pkgData.enheder,
              varighed_timer: varighedTimer,
              pris: pkgData.pris,
              kategori: pkgData.kategori,
              status: "aktiv",
              pakke_start_energy: startEnergy,
              oprettet: now,
              betaling_metode: "stripe",
              stripe_session_id: session.id,
              stripe_payment_intent: session.payment_intent,
            },
          });

        if (insertError) {
          console.error("Error creating package:", insertError);
          break;
        }

        // Opdater daily_package_stats med salg
        const { data: customerData } = await supabase
          .from('regular_customers')
          .select('customer_type')
          .eq('booking_id', booking_nummer)
          .maybeSingle();
        
        const { data: seasonalData } = await supabase
          .from('seasonal_customers')
          .select('customer_type')
          .eq('booking_id', booking_nummer)
          .maybeSingle();
        
        const kundeType = customerData ? 'kørende' : (seasonalData ? 'sæson' : 'kørende');
        const today = new Date().toISOString().split('T')[0];
        const kwhSold = parseFloat(pkgData.enheder || '0');
        const revenue = parseFloat(pkgData.pris_dkk || pkgData.pris || '0');
        
        // Brug raw SQL til at incrementere værdier
        const { error: statsError } = await supabase.rpc('increment_package_stats', {
          p_organization_id: organization_id,
          p_date: today,
          p_kunde_type: kundeType,
          p_betalings_metode: 'stripe',
          p_packages_sold: 1,
          p_kwh_sold: kwhSold,
          p_revenue: revenue
        });
        
        if (statsError) {
          console.error('Fejl ved opdatering af salgsstatistik:', statsError);
        } else {
          console.log(`Salgsstatistik opdateret: ${kwhSold} kWh solgt for ${revenue} DKK`);
        }

        // Log payment in betalinger
        const paymentId = crypto.randomUUID();
        const beloeb = pkgData.pris_dkk || pkgData.pris || 0;
        await supabase
          .from("plugin_data")
          .insert({
            organization_id,
            module: "betalinger",
            ref_id: paymentId,
            key: `betaling_${booking_nummer}_${Date.now()}`,
            data: {
              booking_nummer,
              pakke_navn: pkgData.navn,
              beloeb: parseFloat(beloeb),
              metode: "stripe",
              tidspunkt: now,
              stripe_session_id: session.id,
              stripe_payment_intent: session.payment_intent,
              status: "completed",
            },
          });

        // Lock meter if this is first package for customer + reset payment failures
        if (maaler_id && maaler_id !== 'default') {
          // Check if customer exists and get their UUID
          const { data: customerData } = await supabase
            .from('regular_customers')
            .select('id, meter_id')
            .eq('booking_id', booking_nummer)
            .maybeSingle();

          if (!customerData) {
            const { data: seasonalData } = await supabase
              .from('seasonal_customers')
              .select('id, meter_id')
              .eq('booking_id', booking_nummer)
              .maybeSingle();
            
            if (seasonalData) {
              // Lock meter for seasonal customer
              await supabase
                .from('power_meters')
                .update({
                  is_available: false,
                  current_customer_id: seasonalData.id,
                  updated_at: new Date().toISOString()
                })
                .eq('id', maaler_id);
              
              // Reset payment failed attempts
              await supabase
                .from('seasonal_customers')
                .update({
                  payment_failed_attempts: 0,
                  updated_at: new Date().toISOString()
                })
                .eq('id', seasonalData.id);
              
              console.log(`Måler ${maaler_id} låst til sæson kunde ${booking_nummer}, payment attempts reset`);
            }
          } else {
            // Lock meter for regular customer
            await supabase
              .from('power_meters')
              .update({
                is_available: false,
                current_customer_id: customerData.id,
                updated_at: new Date().toISOString()
              })
              .eq('id', maaler_id);
            
            // Reset payment failed attempts
            await supabase
              .from('regular_customers')
              .update({
                payment_failed_attempts: 0,
                updated_at: new Date().toISOString()
              })
              .eq('id', customerData.id);
            
            console.log(`Måler ${maaler_id} låst til kunde ${booking_nummer}, payment attempts reset`);
          }
        }

        console.log("Package created successfully for booking:", booking_nummer);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log("Payment failed:", paymentIntent.id);
        
        // Log failed payment
        const failedPaymentId = crypto.randomUUID();
        await supabase
          .from("plugin_data")
          .insert({
            organization_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            module: "betalinger",
            ref_id: failedPaymentId,
            key: `betaling_failed_${Date.now()}`,
            data: {
              stripe_payment_intent: paymentIntent.id,
              status: "failed",
              error: paymentIntent.last_payment_error?.message || "Unknown error",
              tidspunkt: new Date().toISOString(),
            },
          });
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in stripe-webhook function:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
