import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1); // Production: hent i går's data
    yesterday.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Format date for email subject (DD.MM.YYYY)
    const dateStr = yesterday.toLocaleDateString('da-DK', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    console.log(`Generating report for ${dateStr}`);

    // Fetch all payments from yesterday
    const { data: payments, error } = await supabase
      .from("plugin_data")
      .select("*")
      .eq("organization_id", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
      .eq("module", "betalinger")
      .gte("created_at", yesterday.toISOString())
      .lt("created_at", today.toISOString())
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching payments:", error);
      throw error;
    }

    console.log(`Found ${payments?.length || 0} payments`);

    // Always send email, even if 0 transactions
    
    // Calculate totals
    const totalTransactions = payments?.length || 0;
    let totalAmount = 0;
    const packageBreakdown: { [key: string]: { count: number; amount: number } } = {};

    payments?.forEach((payment: any) => {
      const amount = parseFloat(payment.data.beloeb || 0);
      totalAmount += amount;

      const packageName = payment.data.pakke_navn || "Ukendt";
      if (!packageBreakdown[packageName]) {
        packageBreakdown[packageName] = { count: 0, amount: 0 };
      }
      packageBreakdown[packageName].count++;
      packageBreakdown[packageName].amount += amount;
    });

    // Generate CSV content
    let csvContent = "Tidspunkt,Booking Nummer,Pakke,Beløb (kr),Metode,Status\n";
    payments?.forEach((payment: any) => {
      const timestamp = new Date(payment.created_at).toLocaleString('da-DK');
      const bookingNummer = payment.data.booking_nummer || "";
      const pakkeNavn = payment.data.pakke_navn || "";
      const beloeb = payment.data.beloeb || 0;
      const metode = payment.data.metode || "";
      const status = payment.data.status || "";
      
      csvContent += `"${timestamp}","${bookingNummer}","${pakkeNavn}",${beloeb},"${metode}","${status}"\n`;
    });

    // Generate HTML email
    let packageBreakdownHtml = "";
    for (const [packageName, data] of Object.entries(packageBreakdown)) {
      packageBreakdownHtml += `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${packageName}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${data.count}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${data.amount.toFixed(2)} kr</td>
        </tr>
      `;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .summary { background-color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          .summary-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .summary-item:last-child { border-bottom: none; }
          .label { font-weight: bold; }
          .value { color: #2563eb; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; background-color: white; margin-top: 20px; }
          th { background-color: #2563eb; color: white; padding: 12px; text-align: left; }
          td { padding: 8px; border: 1px solid #ddd; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>PowerHub Stripe Salgsrapport</h1>
            <p>${dateStr}</p>
          </div>
          <div class="content">
            <div class="summary">
              <h2>Oversigt</h2>
              <div class="summary-item">
                <span class="label">Antal transaktioner:</span>
                <span class="value">${totalTransactions}</span>
              </div>
              <div class="summary-item">
                <span class="label">Total omsætning:</span>
                <span class="value">${totalAmount.toFixed(2)} kr</span>
              </div>
            </div>

            <h3>Opdeling per pakke type</h3>
            <table>
              <thead>
                <tr>
                  <th>Pakke</th>
                  <th style="text-align: center;">Antal</th>
                  <th style="text-align: right;">Beløb</th>
                </tr>
              </thead>
              <tbody>
                ${packageBreakdownHtml}
              </tbody>
            </table>

            <p style="margin-top: 20px;">
              <strong>Vedhæftet fil:</strong> Detaljeret CSV rapport med alle transaktioner
            </p>
          </div>
          <div class="footer">
            <p>Dette er en automatisk genereret rapport fra PowerHub</p>
            <p>Jelling Camping</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email via Brevo
    const emailResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": BREVO_API_KEY!,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: "PowerHub",
          email: "peter@jellingcamping.dk",
        },
        to: [
          {
            email: "bogholderi@jellingcamping.dk",
            name: "Bogholderi",
          },
          {
            email: "peter@jellingcamping.dk",
            name: "Peter (CC)",
          },
        ],
        subject: `Rapport fra powerhub stripe salg d. ${dateStr}`,
        htmlContent: htmlContent,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend error:", errorText);
      throw new Error(`Failed to send email: ${errorText}`);
    }

    const emailResult = await emailResponse.json();
    console.log("Email sent successfully:", emailResult);

    return new Response(
      JSON.stringify({
        success: true,
        date: dateStr,
        transactions: totalTransactions,
        totalAmount: totalAmount,
        emailId: emailResult.id,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in daily-accounting-report:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
