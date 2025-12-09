// =====================================================
// BAKERY-API Edge Function
// Håndterer bageri produkter og bestillinger
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
    const action = url.searchParams.get('action') || 'products';

    // GET PRODUCTS
    if (action === 'products' && req.method === 'GET') {
      const { data: products, error } = await supabase
        .from('bakery_products')
        .select('*')
        .eq('is_available', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, products }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET ORDERS for a booking
    if (action === 'orders' && req.method === 'GET') {
      const bookingId = url.searchParams.get('booking_id');
      if (!bookingId) {
        return new Response(
          JSON.stringify({ error: 'booking_id required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: orders, error } = await supabase
        .from('bakery_orders')
        .select('*')
        .eq('booking_id', parseInt(bookingId))
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, orders }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CREATE ORDER
    if (action === 'order' && req.method === 'POST') {
      const { booking_id, items, pickup_date, customer_name } = await req.json();

      if (!booking_id || !items || items.length === 0 || !pickup_date) {
        return new Response(
          JSON.stringify({ error: 'booking_id, items and pickup_date are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Calculate total
      let total = 0;
      for (const item of items) {
        total += item.price * item.quantity;
      }

      // Generate order number
      const orderNumber = `B${Date.now().toString().slice(-6)}`;

      // Create order
      const { data: order, error } = await supabase
        .from('bakery_orders')
        .insert({
          booking_id,
          customer_name,
          order_number: orderNumber,
          items,
          total,
          pickup_date,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`Bakery order created: ${orderNumber} for booking ${booking_id}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          order,
          message: `Bestilling ${orderNumber} oprettet`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CANCEL ORDER
    if (action === 'cancel' && req.method === 'POST') {
      const { order_id, booking_id } = await req.json();

      if (!order_id || !booking_id) {
        return new Response(
          JSON.stringify({ error: 'order_id and booking_id required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabase
        .from('bakery_orders')
        .update({ status: 'cancelled' })
        .eq('id', order_id)
        .eq('booking_id', booking_id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, message: 'Bestilling annulleret' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in bakery-api:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Ukendt fejl' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
