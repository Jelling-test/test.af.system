import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')!;

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  from_email?: string;
  from_name?: string;
  reply_to?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    const { to, subject, html, from_email, from_name, reply_to }: EmailRequest = await req.json();

    console.log('Sending email via Brevo:', { to, subject, from: from_email });

    if (!to || !subject || !html) {
      throw new Error('Missing required fields: to, subject, html');
    }

    // Send email directly via Brevo API
    const payload: any = {
      sender: {
        name: from_name || 'Jelling Camping',
        email: from_email || 'peter@jellingcamping.dk'
      },
      to: [{ email: to }],
      subject: subject,
      htmlContent: html
    };

    if (reply_to) {
      payload.replyTo = { email: reply_to };
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Brevo API error: ${error}`);
    }

    const result = await response.json();
    console.log('Email sent successfully via Brevo:', result.messageId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email sendt via Brevo',
        messageId: result.messageId,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error sending email:', error);
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
