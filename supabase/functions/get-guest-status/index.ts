// GET-GUEST-STATUS Edge Function
// Henter frisk guest data baseret på bookingId
// Bruges af GuestContext til at opdatere cached data

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { booking_id } = await req.json();

    if (!booking_id) {
      return new Response(
        JSON.stringify({ error: "booking_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Søg i regular_customers først
    let { data: customer, error } = await supabase
      .from("regular_customers")
      .select("*")
      .eq("booking_id", booking_id)
      .single();

    // Hvis ikke fundet, søg i seasonal_customers
    if (!customer) {
      const result = await supabase
        .from("seasonal_customers")
        .select("*")
        .eq("booking_id", booking_id)
        .single();
      
      customer = result.data;
      error = result.error;
    }

    if (!customer) {
      return new Response(
        JSON.stringify({ error: "Booking not found", valid: false }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map customer data til GuestData format
    const guestData = {
      firstName: customer.first_name || "",
      lastName: customer.last_name || "",
      email: customer.email || "",
      language: customer.language || "da",
      country: customer.country || "DK",
      arrivalDate: customer.arrival_date || "",
      departureDate: customer.departure_date || "",
      checkedIn: customer.checked_in || false,
      checkedOut: customer.checked_out || false,
      bookingType: customer.booking_type || "camping",
      previousVisits: customer.previous_visits || 0,
      meterId: customer.meter_id || null,
      spotNumber: customer.spot_number || customer.pitch_number || "",
      bookingId: customer.booking_id,
      booking_nummer: customer.booking_id,
      phone: customer.phone || "",
    };

    return new Response(
      JSON.stringify({ 
        valid: true, 
        guest: guestData 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Error in get-guest-status:", err);
    return new Response(
      JSON.stringify({ error: err.message, valid: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
