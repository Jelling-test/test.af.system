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

    // Portal kasse - tilføjes til bunden af email hvis include_portal_box er true
    const portalBoxHtml = `
      <div style="margin-top: 30px; padding: 20px; background-color: #f8f9fa; border: 2px solid #28a745; border-radius: 10px; text-align: center;">
        <h3 style="color: #28a745; margin: 0 0 15px 0;">🏕️ Din personlige side hos Jelling Camping</h3>
        <p style="margin: 0 0 15px 0; color: #333;">Tryk på linket eller scan QR-koden for at tilgå din side:</p>
        <p style="margin: 0 0 20px 0;">
          <a href="${magicLink}" style="display: inline-block; padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Åbn din gæsteside →
          </a>
        </p>
        <div style="margin-top: 15px;">
          <img src="${qrCodeUrl}" alt="QR Code" style="width: 150px; height: 150px;" />
        </div>
        <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">
          Scan med din telefon for nem adgang
        </p>
      </div>
    `;

    // Erstat placeholders i template body
    let bodyContent = template.body_html
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

    // Konverter simpel tekst til HTML hvis ikke allerede HTML
    const isHtml = bodyContent.trim().startsWith('<') || bodyContent.includes('<p>') || bodyContent.includes('<div>');
    
    let htmlBody: string;
    if (isHtml) {
      htmlBody = bodyContent;
    } else {
      // Wrap i pæn email template
      const formattedContent = bodyContent
        .split('\n\n').map(p => `<p style="margin: 0 0 15px 0;">${p.replace(/\n/g, '<br>')}</p>`).join('');
      
      htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #2563eb; color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="margin: 0; font-size: 24px;">🏕️ Jelling Camping</h1>
    </div>
    <div style="background: white; padding: 30px; border: 1px solid #e2e8f0;">
      ${formattedContent}
    </div>
    <div style="background: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-radius: 0 0 8px 8px;">
      <p style="margin: 0;">Jelling Camping | Mølvangvej 7 | 7300 Jelling</p>
      <p style="margin: 5px 0 0 0;">Tlf: 75 87 13 44 | info@jellingcamping.dk</p>
    </div>
  </div>
</body>
</html>`;
    }

    // Tilføj portal kasse til bunden hvis aktiveret
    if (template.include_portal_box !== false) {
      htmlBody += portalBoxHtml;
    }

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
