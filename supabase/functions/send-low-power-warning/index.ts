import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface WarningRequest {
  pakke_id: string;
  booking_nummer: string;
  enheder_tilbage: number;
  kunde_type: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { pakke_id, booking_nummer, enheder_tilbage, kunde_type }: WarningRequest = await req.json();

    console.log('Processing low power warning:', { pakke_id, booking_nummer, enheder_tilbage, kunde_type });

    // Hent kunde info
    const tableName = kunde_type === 'sæson' ? 'seasonal_customers' : 'regular_customers';
    const { data: customer, error: customerError } = await supabase
      .from(tableName)
      .select('first_name, last_name, email')
      .eq('booking_id', booking_nummer)
      .single();

    if (customerError || !customer) {
      console.error('Customer not found:', customerError);
      
      // Log email error - kunde ikke fundet
      await supabase.from('plugin_data').insert({
        organization_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        module: 'email_errors',
        ref_id: crypto.randomUUID(),
        key: `email_error_${pakke_id}_${Date.now()}`,
        data: {
          booking_nummer: booking_nummer,
          pakke_id: pakke_id,
          error_reason: 'Kunde ikke fundet',
          timestamp: new Date().toISOString(),
        },
      });

      return new Response(
        JSON.stringify({ error: 'Customer not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Tjek om kunde har email
    if (!customer.email || customer.email.trim() === '') {
      console.log('Customer has no email address');
      
      // Log email error - ingen email adresse
      await supabase.from('plugin_data').insert({
        organization_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        module: 'email_errors',
        ref_id: crypto.randomUUID(),
        key: `email_error_${pakke_id}_${Date.now()}`,
        data: {
          booking_nummer: booking_nummer,
          pakke_id: pakke_id,
          error_reason: 'Ingen email adresse',
          timestamp: new Date().toISOString(),
        },
      });

      return new Response(
        JSON.stringify({ error: 'No email address' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Hent email template
    const templateType = kunde_type === 'sæson' ? 'advarsel_saeson' : 'advarsel_koerende';
    const { data: template, error: templateError } = await supabase
      .from('plugin_data')
      .select('data')
      .eq('organization_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
      .eq('module', 'email_templates')
      .eq('ref_id', templateType)
      .single();

    if (templateError || !template) {
      console.error('Template not found:', templateError);
      
      // Log email error - template ikke fundet
      await supabase.from('plugin_data').insert({
        organization_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        module: 'email_errors',
        ref_id: crypto.randomUUID(),
        key: `email_error_${pakke_id}_${Date.now()}`,
        data: {
          booking_nummer: booking_nummer,
          pakke_id: pakke_id,
          error_reason: 'Email template ikke fundet',
          timestamp: new Date().toISOString(),
        },
      });

      return new Response(
        JSON.stringify({ error: 'Template not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Erstat placeholders
    const kundeNavn = `${customer.first_name} ${customer.last_name || ''}`.trim();
    const emne = template.data.emne;
    const besked = template.data.besked
      .replace(/#navn#/g, kundeNavn)
      .replace(/#enheder_tilbage#/g, enheder_tilbage.toFixed(1));

    // Send email via Brevo
    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: 'Jelling Camping',
          email: 'peter@jellingcamping.dk',
        },
        to: [{ email: customer.email, name: kundeNavn }],
        subject: emne,
        htmlContent: besked.replace(/\n/g, '<br>'),
      }),
    });

    if (!brevoResponse.ok) {
      const errorText = await brevoResponse.text();
      console.error('Brevo API error:', errorText);
      
      // Log email error - Brevo fejl
      await supabase.from('plugin_data').insert({
        organization_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        module: 'email_errors',
        ref_id: crypto.randomUUID(),
        key: `email_error_${pakke_id}_${Date.now()}`,
        data: {
          booking_nummer: booking_nummer,
          pakke_id: pakke_id,
          error_reason: `Brevo fejl: ${errorText}`,
          timestamp: new Date().toISOString(),
        },
      });

      throw new Error(`Brevo API error: ${errorText}`);
    }

    // Log email som sendt
    await supabase.from('plugin_data').insert({
      organization_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      module: 'email_log',
      ref_id: crypto.randomUUID(),
      key: `email_log_${pakke_id}_${Date.now()}`,
      data: {
        email_type: 'advarsel',
        pakke_id: pakke_id,
        booking_nummer: booking_nummer,
        to_email: customer.email,
        enheder_tilbage: enheder_tilbage,
        sent_at: new Date().toISOString(),
      },
    });

    console.log('Warning email sent successfully to:', customer.email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Warning email sent',
        to: customer.email,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error sending warning email:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
