// Multi-provider Email Function
// Understøtter SMTP (Gmail, Simply, etc.) og REST API (Brevo, Mailgun, Resend, etc.)
// Henter aktiv provider fra email_provider_config tabellen
// Backup: Se index.ts.backup for original Brevo-only version

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Fallback API keys fra environment (bruges hvis ikke gemt i DB)
const ENV_BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const ENV_MAILGUN_API_KEY = Deno.env.get("MAILGUN_API_KEY");
const ENV_RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

interface EmailRequest {
  to: string;
  to_name?: string;
  subject: string;
  html: string;
  text?: string;
  from_email?: string;
  from_name?: string;
  reply_to?: string;
}

interface EmailProviderConfig {
  id: string;
  name: string;
  provider_type: "smtp" | "rest_api";
  from_email: string;
  from_name: string;
  reply_to_email: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_password_encrypted: string | null;
  smtp_secure: "tls" | "ssl" | "none" | null;
  api_endpoint: string | null;
  api_key_encrypted: string | null;
  api_headers: Record<string, string> | null;
  api_payload_template: string | null;
}

// Hent aktiv email provider fra database
async function getActiveProvider(supabase: any): Promise<EmailProviderConfig | null> {
  const { data, error } = await supabase
    .from("email_provider_config")
    .select("*")
    .eq("is_active", true)
    .single();

  if (error) {
    console.error("Error fetching email provider:", error);
    return null;
  }

  return data;
}

// Send via SMTP (Gmail, Simply, etc.)
async function sendViaSMTP(
  config: EmailProviderConfig,
  email: EmailRequest
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const secureSettings: Record<string, any> = {
      tls: { secure: false, requireTLS: true },
      ssl: { secure: true },
      none: { secure: false },
    };

    const security = secureSettings[config.smtp_secure || "tls"];

    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port,
      ...security,
      auth: {
        user: config.smtp_user,
        pass: config.smtp_password_encrypted,
      },
    });

    const result = await transporter.sendMail({
      from: `"${email.from_name || config.from_name}" <${email.from_email || config.from_email}>`,
      to: email.to,
      replyTo: email.reply_to || config.reply_to_email || undefined,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    return { success: true, messageId: result.messageId };
  } catch (err: unknown) {
    const error = err as Error;
    console.error("SMTP error:", error);
    return { success: false, error: error.message };
  }
}

// Send via REST API (Brevo, Mailgun, Resend, custom)
async function sendViaRestAPI(
  config: EmailProviderConfig,
  email: EmailRequest
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Hent API key (fra config eller environment som fallback)
    let apiKey = config.api_key_encrypted;
    
    // Tjek for environment variable placeholders
    if (apiKey === "{{BREVO_API_KEY}}") {
      apiKey = ENV_BREVO_API_KEY || null;
    } else if (apiKey === "{{MAILGUN_API_KEY}}") {
      apiKey = ENV_MAILGUN_API_KEY || null;
    } else if (apiKey === "{{RESEND_API_KEY}}") {
      apiKey = ENV_RESEND_API_KEY || null;
    }

    if (!apiKey) {
      return { success: false, error: "API key not configured" };
    }

    // Byg headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(config.api_headers || {}),
    };

    // Tilføj API key til headers baseret på provider
    if (config.api_endpoint?.includes("brevo.com")) {
      headers["api-key"] = apiKey;
    } else if (config.api_endpoint?.includes("mailgun.net")) {
      headers["Authorization"] = `Basic ${btoa(`api:${apiKey}`)}`;
    } else if (config.api_endpoint?.includes("resend.com")) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    } else {
      // Custom provider - antag api-key header
      headers["api-key"] = apiKey;
    }

    // Byg payload fra template
    let payload = config.api_payload_template || "{}";
    
    // Erstat placeholders
    const fromEmail = email.from_email || config.from_email;
    const fromName = email.from_name || config.from_name;
    const replyTo = email.reply_to || config.reply_to_email || fromEmail;

    payload = payload
      .replace(/\{\{TO\}\}/g, email.to)
      .replace(/\{\{TO_NAME\}\}/g, email.to_name || email.to)
      .replace(/\{\{SUBJECT\}\}/g, email.subject)
      .replace(/\{\{HTML\}\}/g, JSON.stringify(email.html).slice(1, -1))
      .replace(/\{\{TEXT\}\}/g, email.text || "")
      .replace(/\{\{FROM_EMAIL\}\}/g, fromEmail)
      .replace(/\{\{FROM_NAME\}\}/g, fromName)
      .replace(/\{\{REPLY_TO\}\}/g, replyTo);

    console.log("Sending to:", config.api_endpoint);

    const response = await fetch(config.api_endpoint!, {
      method: "POST",
      headers,
      body: payload,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API error:", errorText);
      return { success: false, error: `API error: ${errorText}` };
    }

    const result = await response.json();
    return { 
      success: true, 
      messageId: result.messageId || result.id || "sent" 
    };
  } catch (err: unknown) {
    const error = err as Error;
    console.error("REST API error:", error);
    return { success: false, error: error.message };
  }
}

// Hovedfunktion
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const emailRequest: EmailRequest = await req.json();

    console.log("Email request received:", { 
      to: emailRequest.to, 
      subject: emailRequest.subject 
    });

    // Valider input
    if (!emailRequest.to || !emailRequest.subject || !emailRequest.html) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing required fields: to, subject, html" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Hent aktiv provider
    const provider = await getActiveProvider(supabase);

    if (!provider) {
      console.error("No active email provider configured");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No active email provider configured" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    console.log("Using provider:", provider.name, provider.provider_type);

    // Send email baseret på provider type
    let result;
    if (provider.provider_type === "smtp") {
      result = await sendViaSMTP(provider, emailRequest);
    } else {
      result = await sendViaRestAPI(provider, emailRequest);
    }

    if (!result.success) {
      console.error("Email send failed:", result.error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.error 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    console.log("Email sent successfully via", provider.name, "messageId:", result.messageId);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Email sendt via ${provider.name}`,
        messageId: result.messageId,
        provider: provider.name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Error in send-email:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Unknown error" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
