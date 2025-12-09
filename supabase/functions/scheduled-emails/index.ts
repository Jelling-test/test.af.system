// =====================================================
// SCHEDULED-EMAILS Edge Function
// Kald dagligt via cron - sender emails baseret på triggers
// Køres IKKE automatisk endnu - kun manuelt
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

    // Hent alle aktive templates med trigger_days_before
    const { data: templates } = await supabase
      .from('email_templates')
      .select('*')
      .eq('is_active', true)
      .not('trigger_days_before', 'is', null)
      .order('priority', { ascending: true });

    if (!templates || templates.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Ingen aktive email triggers fundet', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const today = new Date();
    const results: any[] = [];

    for (const template of templates) {
      // Beregn target dato (ankomst dato)
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + template.trigger_days_before);
      const targetDateStr = targetDate.toISOString().split('T')[0];

      console.log(`Checking template ${template.name} for arrival date ${targetDateStr}`);

      // Find kunder med ankomst på target dato (som ikke allerede har fået email)
      const { data: regularCustomers } = await supabase
        .from('regular_customers')
        .select('booking_id, first_name, last_name, email, magic_token')
        .eq('arrival_date', targetDateStr)
        .not('email', 'is', null);

      const { data: seasonalCustomers } = await supabase
        .from('seasonal_customers')
        .select('booking_id, first_name, last_name, email, magic_token')
        .eq('arrival_date', targetDateStr)
        .not('email', 'is', null);

      const allCustomers = [...(regularCustomers || []), ...(seasonalCustomers || [])];

      for (const customer of allCustomers) {
        // Tjek om email allerede er sendt for denne template + booking
        const { data: existingLog } = await supabase
          .from('email_logs')
          .select('id')
          .eq('booking_id', customer.booking_id)
          .eq('template_name', template.name)
          .maybeSingle();

        if (existingLog) {
          console.log(`Email allerede sendt til booking ${customer.booking_id} for template ${template.name}`);
          continue;
        }

        // Send email via send-welcome-email function
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/send-welcome-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ booking_id: customer.booking_id })
          });

          const result = await response.json();
          results.push({
            booking_id: customer.booking_id,
            customer: `${customer.first_name} ${customer.last_name}`,
            template: template.name,
            success: result.success,
            error: result.error
          });

          console.log(`Email result for ${customer.booking_id}:`, result.success ? 'sent' : result.error);
        } catch (err) {
          console.error(`Error sending to ${customer.booking_id}:`, err);
          results.push({
            booking_id: customer.booking_id,
            customer: `${customer.first_name} ${customer.last_name}`,
            template: template.name,
            success: false,
            error: (err as Error).message
          });
        }
      }
    }

    const sentCount = results.filter(r => r.success).length;

    return new Response(
      JSON.stringify({
        message: `Scheduled emails processed`,
        total_checked: results.length,
        sent: sentCount,
        failed: results.length - sentCount,
        details: results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in scheduled-emails:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Ukendt fejl' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
