// =====================================================
// SEND-WELCOME-EMAIL Edge Function
// Sender velkomst email med magic link til gæster
// =====================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PORTAL_URL = 'https://jelling.vercel.app';

// Generer random token
function generateToken(length: number = 32): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { booking_id, force_send } = await req.json();

    if (!booking_id) {
      return new Response(
        JSON.stringify({ error: 'booking_id er påkrævet' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find kunde
    let { data: customer } = await supabase
      .from('regular_customers')
      .select('*')
      .eq('booking_id', booking_id)
      .maybeSingle();

    let customerType = 'regular';
    if (!customer) {
      const result = await supabase
        .from('seasonal_customers')
        .select('*')
        .eq('booking_id', booking_id)
        .maybeSingle();
      customer = result.data;
      customerType = 'seasonal';
    }

    if (!customer) {
      return new Response(
        JSON.stringify({ error: 'Kunde ikke fundet', booking_id }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Tjek om kunde har email
    if (!customer.email) {
      return new Response(
        JSON.stringify({ error: 'Kunde har ingen email', booking_id }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generer magic token hvis ikke eksisterer
    let magicToken = customer.magic_token;
    if (!magicToken) {
      magicToken = generateToken(32);
      const table = customerType === 'regular' ? 'regular_customers' : 'seasonal_customers';
      await supabase
        .from(table)
        .update({ magic_token: magicToken })
        .eq('booking_id', booking_id);
    }

    // Hent email template
    const { data: template } = await supabase
      .from('email_templates')
      .select('*')
      .eq('name', 'welcome_email')
      .eq('is_active', true)
      .maybeSingle();

    if (!template) {
      return new Response(
        JSON.stringify({ error: 'Email template ikke fundet' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Bestem sprog
    const lang = customer.language || 'da';
    let subject = template.subject_da;
    if (lang === 'en' && template.subject_en) subject = template.subject_en;
    if (lang === 'de' && template.subject_de) subject = template.subject_de;

    // Byg magic link
    const magicLink = `${PORTAL_URL}/m/${booking_id}/${magicToken}`;

    // Generer QR kode URL (bruger gratis QR API)
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(magicLink)}`;
    const qrCodeHtml = `<img src="${qrCodeUrl}" alt="QR Code til gæsteportal" style="width:200px;height:200px;" />`;

    // Bestem gæstenavn baseret på sprog
    const guestName = `${customer.first_name || 'Gæst'} ${customer.last_name || ''}`.trim();

    // Erstat placeholders i template
    let htmlBody = template.body_html
      .replace(/\{\{FIRST_NAME\}\}/g, customer.first_name || 'Gæst')
      .replace(/\{\{LAST_NAME\}\}/g, customer.last_name || '')
      .replace(/\{\{guest_name\}\}/g, guestName)
      .replace(/\{\{ARRIVAL_DATE\}\}/g, customer.arrival_date || '')
      .replace(/\{\{arrival_date\}\}/g, customer.arrival_date || '')
      .replace(/\{\{DEPARTURE_DATE\}\}/g, customer.departure_date || '')
      .replace(/\{\{departure_date\}\}/g, customer.departure_date || '')
      .replace(/\{\{SPOT_NUMBER\}\}/g, customer.spot_number || '')
      .replace(/\{\{BOOKING_ID\}\}/g, booking_id.toString())
      .replace(/\{\{booking_id\}\}/g, booking_id.toString())
      .replace(/\{\{MAGIC_LINK\}\}/g, magicLink)
      .replace(/\{\{magic_link\}\}/g, magicLink)
      .replace(/\{\{QR_CODE\}\}/g, qrCodeHtml)
      .replace(/\{\{qr_code\}\}/g, qrCodeHtml);

    // Send email via send-email function
    const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        to: customer.email,
        to_name: `${customer.first_name} ${customer.last_name}`,
        subject: subject,
        html: htmlBody
      })
    });

    const emailResult = await emailResponse.json();

    if (!emailResult.success) {
      console.error('Email send failed:', emailResult.error);
      return new Response(
        JSON.stringify({ error: 'Email kunne ikke sendes', details: emailResult.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log email sendt
    await supabase.from('email_logs').insert({
      recipient_email: customer.email,
      recipient_name: `${customer.first_name} ${customer.last_name}`,
      subject: subject,
      template_name: 'welcome_email',
      booking_id: booking_id,
      status: 'sent',
      sent_at: new Date().toISOString()
    });

    console.log(`Welcome email sent to ${customer.email} for booking ${booking_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Velkomst email sendt',
        email: customer.email,
        magic_link: magicLink
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error sending welcome email:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Ukendt fejl' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
