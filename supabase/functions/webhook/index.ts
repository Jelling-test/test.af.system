import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

console.log("Webhook funktion startet");

Deno.serve(async (req) => {
  try {
    console.log(`${req.method} request modtaget`);

    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    const payload = await req.json();
    console.log('Webhook data modtaget:', JSON.stringify(payload, null, 2));

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Gem webhook data
    const { data: webhookData, error: webhookError } = await supabaseClient
      .from('webhook_data')
      .insert({
        source: 'sirvoy',
        json_payload: payload,
        raw_payload: JSON.stringify(payload)
      })
      .select();

    if (webhookError) {
      console.error('Database fejl:', webhookError);
      throw new Error(`Database fejl: ${webhookError.message}`);
    }

    console.log('Webhook data gemt med ID:', webhookData[0]?.id);

    // Udtræk kunde data
    const bookingId = payload.bookingId;
    const firstName = payload.guest?.firstName || '';
    const lastName = payload.guest?.lastName || '';
    const email = payload.guest?.email || null;
    const phone = payload.guest?.phone || null;
    const arrivalDate = payload.arrivalDate;
    const departureDate = payload.departureDate;
    const checkedIn = payload.bookingIsCheckedIn || false;
    const checkedOut = payload.bookingIsCheckedOut || false;
    const numberOfPersons = payload.totalAdults || 0;
    const spotNumber = payload.rooms?.[0]?.RoomName || null;

    // Udtræk nummerplader
    const licensePlateField = payload.customFields?.find(f => 
      f.name?.toLowerCase().includes('licen')
    );
    const licensePlates = licensePlateField?.value 
      ? licensePlateField.value.split(',').map(p => p.trim().toUpperCase())
      : [];

    // Bestem kunde type (0 gæster = sæson, >0 = kørende)
    const isSeasonalCustomer = numberOfPersons === 0;
    const customerType = isSeasonalCustomer ? 'sæson' : 'kørende';

    if (checkedOut) {
      console.log(`Kunde ${bookingId} er checked out - sletter`);

      // Find og slet kunde
      let customer = null;
      const { data: seasonalCustomer } = await supabaseClient
        .from('seasonal_customers')
        .select('meter_id')
        .eq('booking_id', bookingId)
        .single();

      if (seasonalCustomer) {
        customer = seasonalCustomer;
        await supabaseClient
          .from('seasonal_customers')
          .delete()
          .eq('booking_id', bookingId);
        console.log(`Sæson kunde ${bookingId} slettet`);
      } else {
        const { data: regularCustomer } = await supabaseClient
          .from('regular_customers')
          .select('meter_id')
          .eq('booking_id', bookingId)
          .single();

        if (regularCustomer) {
          customer = regularCustomer;
          await supabaseClient
            .from('regular_customers')
            .delete()
            .eq('booking_id', bookingId);
          console.log(`Almindelig kunde ${bookingId} slettet`);
        }
      }

      // Hent pakke data FØR sletning for at logge checkout statistik
      const { data: customerPackages } = await supabaseClient
        .from('plugin_data')
        .select('*')
        .eq('module', 'pakker')
        .filter('data->>booking_nummer', 'eq', bookingId)
        .eq('data->>status', 'aktiv');

      // Beregn checkout statistik
      if (customerPackages && customerPackages.length > 0) {
        let totalKwhBought = 0;
        let totalKwhConsumed = 0;
        
        for (const pkg of customerPackages) {
          const kwhBought = parseFloat(pkg.data.enheder || '0');
          const accumulated = parseFloat(pkg.data.accumulated_usage || '0');
          
          // Hent nuværende meter reading hvis kunden har en måler
          let currentConsumption = 0;
          if (customer?.meter_id) {
            const { data: meterData } = await supabaseClient
              .from('power_meters')
              .select('meter_number')
              .eq('id', customer.meter_id)
              .single();
            
            if (meterData?.meter_number) {
              const { data: meterReading } = await supabaseClient
                .from('meter_readings')
                .select('energy')
                .eq('meter_id', meterData.meter_number)
                .order('time', { ascending: false })
                .limit(1)
                .single();
              
              const pakkeStartEnergy = pkg.data.pakke_start_energy || 0;
              currentConsumption = (meterReading?.energy || 0) - pakkeStartEnergy;
            }
          }
          
          const totalConsumption = accumulated + currentConsumption;
          totalKwhBought += kwhBought;
          totalKwhConsumed += totalConsumption;
        }
        
        const totalKwhForfeited = Math.max(0, totalKwhBought - totalKwhConsumed);
        
        // UPSERT til daily_package_stats
        const today = new Date().toISOString().split('T')[0];
        const betalingsMetode = customerPackages[0].data.betaling_metode || 'reception';
        
        const { error: statsError } = await supabaseClient.rpc('increment_package_stats', {
          p_organization_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          p_date: today,
          p_kunde_type: customerType,
          p_betalings_metode: betalingsMetode,
          p_checkouts_count: 1,
          p_kwh_bought_total: totalKwhBought,
          p_kwh_consumed_total: totalKwhConsumed,
          p_kwh_forfeited_total: totalKwhForfeited
        });
        
        if (statsError) {
          console.error('Fejl ved opdatering af checkout statistik:', statsError);
        } else {
          console.log(`Checkout statistik opdateret: ${totalKwhBought} købt, ${totalKwhConsumed} brugt, ${totalKwhForfeited} fragivet`);
        }
      }

      // Slet alle pakker for kunden
      const { error: deletePackagesError } = await supabaseClient
        .from('plugin_data')
        .delete()
        .eq('module', 'pakker')
        .filter('data->>booking_nummer', 'eq', bookingId);

      if (deletePackagesError) {
        console.error('Fejl ved sletning af pakker:', deletePackagesError);
      } else {
        console.log(`Slettede alle pakker for booking ${bookingId}`);
      }

      // Frigør måler og sluk strøm
      if (customer?.meter_id) {
        // Hent meter_number fra power_meters
        const { data: meterData } = await supabaseClient
          .from('power_meters')
          .select('meter_number')
          .eq('id', customer.meter_id)
          .single();

        if (meterData?.meter_number) {
          // Indsæt OFF kommando
          await supabaseClient
            .from('meter_commands')
            .insert({
              meter_id: meterData.meter_number,
              command: 'set_state',
              value: 'OFF',
              status: 'pending'
            });
          console.log(`OFF kommando sendt til måler ${meterData.meter_number}`);
        }

        // Frigør måler i database
        await supabaseClient
          .from('power_meters')
          .update({
            is_available: true,
            current_customer_id: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', customer.meter_id);
        console.log(`Måler ${customer.meter_id} frigivet`);
      }

      // Slet nummerplader
      const { error: deleteAllError } = await supabaseClient
        .from('approved_plates')
        .delete()
        .eq('booking_id', bookingId);

      if (deleteAllError) {
        console.error('Fejl ved sletning af nummerplader:', deleteAllError);
      } else {
        console.log(`Slettede alle nummerplader for booking ${bookingId}`);
      }

    } else {
      // Opret eller opdater kunde
      let movedCustomer = false;

      if (isSeasonalCustomer) {
        // Tjek om kunden findes som regular customer
        const { data: existingRegular } = await supabaseClient
          .from('regular_customers')
          .select('*')
          .eq('booking_id', bookingId)
          .single();

        if (existingRegular) {
          console.log(`Flytter kunde ${bookingId} fra regular til seasonal`);
          await supabaseClient
            .from('regular_customers')
            .delete()
            .eq('booking_id', bookingId);
          movedCustomer = true;
        }

        // Gem som sæson kunde MED email og phone
        const seasonalData = {
          booking_id: bookingId,
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: phone,
          customer_type: customerType,
          arrival_date: arrivalDate,
          departure_date: departureDate,
          checked_in: checkedIn,
          checked_out: checkedOut,
          spot_number: spotNumber,
          license_plates: licensePlates,
          meter_id: existingRegular?.meter_id || null,
          updated_at: new Date().toISOString()
        };

        const { error: customerError } = await supabaseClient
          .from('seasonal_customers')
          .upsert(seasonalData, { onConflict: 'booking_id' });

        if (customerError) {
          console.error('Fejl ved gem af sæson kunde:', customerError);
        } else {
          console.log(`Sæson kunde ${bookingId} ${movedCustomer ? 'flyttet' : 'gemt'} med email: ${email}`);
        }

      } else {
        // Tjek om kunden findes som seasonal customer
        const { data: existingSeasonal } = await supabaseClient
          .from('seasonal_customers')
          .select('*')
          .eq('booking_id', bookingId)
          .single();

        if (existingSeasonal) {
          console.log(`Flytter kunde ${bookingId} fra seasonal til regular`);
          await supabaseClient
            .from('seasonal_customers')
            .delete()
            .eq('booking_id', bookingId);
          movedCustomer = true;
        }

        // Gem som kørende kunde MED email og phone
        const regularData = {
          booking_id: bookingId,
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: phone,
          customer_type: customerType,
          arrival_date: arrivalDate,
          departure_date: departureDate,
          checked_in: checkedIn,
          checked_out: checkedOut,
          number_of_persons: numberOfPersons,
          spot_number: spotNumber,
          license_plates: licensePlates,
          meter_id: existingSeasonal?.meter_id || null,
          updated_at: new Date().toISOString()
        };

        const { error: customerError } = await supabaseClient
          .from('regular_customers')
          .upsert(regularData, { onConflict: 'booking_id' });

        if (customerError) {
          console.error('Fejl ved gem af almindelig kunde:', customerError);
        } else {
          console.log(`Almindelig kunde ${bookingId} ${movedCustomer ? 'flyttet' : 'gemt'} med email: ${email}`);
        }
      }

      // Håndter nummerplader
      const { data: existingPlates } = await supabaseClient
        .from('approved_plates')
        .select('id, plate_text')
        .eq('booking_id', bookingId);

      const existingPlateTexts = existingPlates?.map(p => p.plate_text) || [];
      const platesToDelete = existingPlateTexts.filter(plate => !licensePlates.includes(plate));
      const platesToAdd = licensePlates.filter(plate => !existingPlateTexts.includes(plate));

      // Slet nummerplader der ikke længere er i bookingen
      if (platesToDelete.length > 0) {
        const { error: deleteError } = await supabaseClient
          .from('approved_plates')
          .delete()
          .eq('booking_id', bookingId)
          .in('plate_text', platesToDelete);

        if (deleteError) {
          console.error('Fejl ved sletning af nummerplader:', deleteError);
        } else {
          console.log(`Slettede ${platesToDelete.length} nummerplader:`, platesToDelete);
        }
      }

      // Tilføj nye nummerplader
      if (platesToAdd.length > 0) {
        const newPlates = platesToAdd.map(plate => ({
          plate_text: plate,
          customer_name: `${firstName} ${lastName}`.trim(),
          booking_id: bookingId,
          source: 'sirvoy_webhook',
          checked_in: checkedIn,
          checked_out: checkedOut,
          arrival_date: arrivalDate,
          departure_date: departureDate,
          notes: `${isSeasonalCustomer ? 'Sæson' : 'Almindelig'} kunde - Booking #${bookingId}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

        const { error: insertError } = await supabaseClient
          .from('approved_plates')
          .insert(newPlates);

        if (insertError) {
          console.error('Fejl ved tilføjelse af nummerplader:', insertError);
        } else {
          console.log(`Tilføjede ${platesToAdd.length} nummerplader:`, platesToAdd);
        }
      }

      // Opdater eksisterende nummerplader hvis ingen ændringer
      if (existingPlates && existingPlates.length > 0 && platesToDelete.length === 0 && platesToAdd.length === 0) {
        const { error: updateError } = await supabaseClient
          .from('approved_plates')
          .update({
            checked_in: checkedIn,
            checked_out: checkedOut,
            arrival_date: arrivalDate,
            departure_date: departureDate,
            customer_name: `${firstName} ${lastName}`.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('booking_id', bookingId);

        if (updateError) {
          console.error('Fejl ved opdatering af nummerplader:', updateError);
        } else {
          console.log(`Opdaterede ${existingPlates.length} nummerplader`);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Webhook modtaget og gemt',
      timestamp: new Date().toISOString(),
      id: webhookData[0]?.id,
      booking_id: bookingId,
      customer_type: customerType,
      email: email,
      phone: phone,
      action: checkedOut ? 'deleted' : 'upserted'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Fejl i webhook:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
});
