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

    // GET SETTINGS
    if ((action === 'settings' || action === 'get-settings') && req.method === 'GET') {
      const { data: settings } = await supabase
        .from('bakery_settings')
        .select('*')
        .single();

      // Returner default settings hvis ikke fundet
      const defaultSettings = {
        order_open_time: '10:00',
        order_close_time: '22:00',
        pickup_start_time: '07:00',
        pickup_end_time: '09:00',
        is_closed: false,
        closed_until: null,
        closed_message_da: 'Bageriet er lukket',
        closed_message_en: 'Bakery is closed',
        closed_message_de: 'Bäckerei geschlossen',
        pickup_location_da: 'Receptionen',
        pickup_location_en: 'Reception',
        pickup_location_de: 'Rezeption'
      };

      return new Response(
        JSON.stringify({ success: true, settings: settings || defaultSettings }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SAVE SETTINGS (Admin)
    if (action === 'save-settings' && req.method === 'POST') {
      const newSettings = await req.json();
      
      const { error } = await supabase
        .from('bakery_settings')
        .upsert({
          id: 'default',
          ...newSettings,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, message: 'Indstillinger gemt' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET PRODUCTS
    if ((action === 'products' || action === 'get-products') && req.method === 'GET') {
      const { data: products, error } = await supabase
        .from('bakery_products')
        .select('*')
        .eq('is_available', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      // Map felter til hvad gæstesiden forventer
      const mappedProducts = (products || []).map(p => ({
        id: p.id,
        name_da: p.name,
        name_en: p.name_en || p.name,
        name_de: p.name_de || p.name,
        description_da: p.description || '',
        description_en: p.description_en || p.description || '',
        description_de: p.description_de || p.description || '',
        price: p.price,
        max_per_order: p.max_per_order || 10,
        image_url: p.image_url,
        is_active: p.is_available,
        sort_order: p.sort_order || 0
      }));

      return new Response(
        JSON.stringify({ success: true, products: mappedProducts }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET ALL PRODUCTS (Admin - includes inactive)
    if (action === 'admin-get-products' && req.method === 'GET') {
      const { data: products, error } = await supabase
        .from('bakery_products')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;

      const mappedProducts = (products || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        name_da: p.name,
        name_en: p.name_en || '',
        name_de: p.name_de || '',
        description_da: p.description || '',
        description_en: p.description_en || '',
        description_de: p.description_de || '',
        price: p.price,
        max_per_order: p.max_per_order || 10,
        image_url: p.image_url,
        is_available: p.is_available,
        is_active: p.is_available,
        sort_order: p.sort_order || 0,
        category: p.category || 'bread'
      }));

      return new Response(
        JSON.stringify({ success: true, products: mappedProducts }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SAVE PRODUCT (Admin - create or update)
    if (action === 'admin-save-product' && req.method === 'POST') {
      const productData = await req.json();
      
      const dbData = {
        name: productData.name_da || productData.name,
        name_en: productData.name_en || null,
        name_de: productData.name_de || null,
        description: productData.description_da || null,
        description_en: productData.description_en || null,
        description_de: productData.description_de || null,
        price: productData.price || 0,
        max_per_order: productData.max_per_order || 10,
        image_url: productData.image_url || null,
        is_available: productData.is_active ?? true,
        sort_order: productData.sort_order || 99,
        category: productData.category || 'bread',
        updated_at: new Date().toISOString()
      };

      let result;
      if (productData.id) {
        // Update existing
        result = await supabase
          .from('bakery_products')
          .update(dbData)
          .eq('id', productData.id)
          .select()
          .single();
      } else {
        // Create new
        result = await supabase
          .from('bakery_products')
          .insert(dbData)
          .select()
          .single();
      }

      if (result.error) throw result.error;

      return new Response(
        JSON.stringify({ success: true, product: result.data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE PRODUCT (Admin)
    if (action === 'admin-delete-product' && req.method === 'POST') {
      const { id } = await req.json();
      
      if (!id) {
        return new Response(
          JSON.stringify({ error: 'Product ID required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabase
        .from('bakery_products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, message: 'Produkt slettet' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET ORDERS for a booking
    if ((action === 'orders' || action === 'get-orders') && req.method === 'GET') {
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
    if ((action === 'order' || action === 'create-order') && req.method === 'POST') {
      const body = await req.json();
      
      // Accepter forskellige feltnavne
      const booking_id = body.booking_id || body.booking_nummer;
      const customer_name = body.customer_name || body.guest_name;
      const email = body.email || body.guest_email;
      const phone = body.phone || body.guest_phone;
      const items = body.items;
      const pickup_date = body.pickup_date;

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
          booking_type: 'regular',
          customer_name: customer_name || 'Gæst',
          email,
          phone,
          items,
          total_price: total,
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

    // GET ALL ORDERS (Admin)
    if (action === 'admin-orders' && req.method === 'GET') {
      const dateFilter = url.searchParams.get('date'); // Optional: filter by pickup_date
      const statusFilter = url.searchParams.get('status'); // Optional: filter by status
      
      let query = supabase
        .from('bakery_orders')
        .select('*')
        .order('pickup_date', { ascending: true })
        .order('created_at', { ascending: false });
      
      if (dateFilter) {
        query = query.eq('pickup_date', dateFilter);
      }
      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data: orders, error } = await query;

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, orders: orders || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // UPDATE ORDER STATUS (Admin)
    if (action === 'update-status' && req.method === 'POST') {
      const { order_id, status } = await req.json();

      if (!order_id || !status) {
        return new Response(
          JSON.stringify({ error: 'order_id and status required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const validStatuses = ['pending', 'confirmed', 'ready', 'collected', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return new Response(
          JSON.stringify({ error: 'Invalid status' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const updateData: any = { status };
      if (status === 'collected') {
        updateData.collected_at = new Date().toISOString();
      }
      if (status === 'cancelled') {
        updateData.cancelled_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('bakery_orders')
        .update(updateData)
        .eq('id', order_id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, message: `Status opdateret til ${status}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CANCEL ORDER
    if ((action === 'cancel' || action === 'cancel-order') && req.method === 'POST') {
      const body = await req.json();
      const order_id = body.order_id;
      const booking_id = body.booking_id || body.booking_nummer;

      if (!order_id || !booking_id) {
        return new Response(
          JSON.stringify({ error: 'order_id and booking_id required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabase
        .from('bakery_orders')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
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
