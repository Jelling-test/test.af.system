import { supabase } from "@/integrations/supabase/client";

/**
 * Gem kunde email i email_subscribers når de checker ind
 * Undgår duplikater via UNIQUE constraint på (email, year, customer_type)
 */
export const saveEmailSubscriber = async (
  customerName: string,
  email: string | null,
  customerType: "kørende" | "sæson",
  bookingNumber: string | number,
  year?: number
) => {
  // Skip hvis ingen email
  if (!email || !email.trim()) {
    console.log("No email provided, skipping email subscriber save");
    return;
  }

  try {
    const currentYear = year || new Date().getFullYear();

    const { error } = await (supabase as any)
      .from("email_subscribers")
      .insert({
        customer_name: customerName,
        email: email.trim().toLowerCase(),
        customer_type: customerType,
        year: currentYear,
        booking_number: bookingNumber.toString(),
        checked_in_at: new Date().toISOString(),
      });

    // Ignorer duplikat fejl (constraint violation)
    if (error && error.code !== "23505") {
      console.error("Error saving email subscriber:", error);
    } else if (!error) {
      console.log(`Email subscriber saved: ${email} (${customerType}, ${currentYear})`);
    }
  } catch (error) {
    console.error("Error in saveEmailSubscriber:", error);
  }
};
