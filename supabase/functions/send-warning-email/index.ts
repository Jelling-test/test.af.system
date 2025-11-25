import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Hent pending emails fra queue
    const { data: pendingEmails, error: fetchError } = await supabase
      .from('plugin_data')
      .select('*')
      .eq('module', 'email_queue')
      .eq('data->>status', 'pending')
      .limit(10);

    if (fetchError) throw fetchError;
    if (!pendingEmails || pendingEmails.length === 0) {
      return new Response(JSON.stringify({ message: 'No pending emails' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const results = [];

    for (const emailJob of pendingEmails) {
      try {
        const { kunde_type, to_email, kunde_navn, pakke_id, enheder_tilbage } = emailJob.data;

        // Hent email template baseret på kunde type
        const templateType = kunde_type === 'sæson' ? 'advarsel_saeson' : 'advarsel_koerende';
        const { data: template } = await supabase
          .from('plugin_data')
          .select('data')
          .eq('module', 'email_templates')
          .eq('ref_id', templateType)
          .single();

        if (!template) {
          console.error(`Template not found: ${templateType}`);
          continue;
        }

        // Erstat placeholders
        const emne = template.data.emne;
        const besked = template.data.besked
          .replace(/#navn#/g, kunde_navn)
          .replace(/#enheder_tilbage#/g, enheder_tilbage);

        // Send email via Brevo
        const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'api-key': BREVO_API_KEY!,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            sender: {
              name: 'Jelling Camping',
              email: 'peter@jellingcamping.dk',
            },
            to: [{ email: to_email, name: kunde_navn }],
            subject: emne,
            textContent: besked,
          }),
        });

        if (!brevoResponse.ok) {
          throw new Error(`Brevo API error: ${await brevoResponse.text()}`);
        }

        // Marker email som sent
        await supabase
          .from('plugin_data')
          .update({
            data: {
              ...emailJob.data,
              status: 'sent',
              sent_at: new Date().toISOString(),
            },
          })
          .eq('id', emailJob.id);

        // Log email som sent (for at undgå duplikater)
        await supabase
          .from('plugin_data')
          .insert({
            organization_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            module: 'email_log',
            ref_id: crypto.randomUUID(),
            key: `email_log_${pakke_id}_${Date.now()}`,
            data: {
              email_type: 'advarsel',
              pakke_id: pakke_id,
              to_email: to_email,
              sent_at: new Date().toISOString(),
            },
          });

        results.push({ email: to_email, status: 'sent' });
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        
        // Marker email som failed
        await supabase
          .from('plugin_data')
          .update({
            data: {
              ...emailJob.data,
              status: 'failed',
              error: emailError.message,
            },
          })
          .eq('id', emailJob.id);

        results.push({ email: emailJob.data.to_email, status: 'failed', error: emailError.message });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in send-warning-email function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
