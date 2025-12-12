import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

console.log("Webhook funktion startet");

// ==================== HJÆLPEFUNKTION: Dansk tid ====================
function getDanishTime(): Date {
  // Få nuværende tid i dansk tidzone
  const now = new Date();
  const danishTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Copenhagen' }));
  return danishTime;
}

function getDanishHour(): number {
  return getDanishTime().getHours();
}

function getTodayDanish(): string {
  const danish = getDanishTime();
  return danish.toISOString().split('T')[0];
}

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
    const isCancelled = payload.cancelled === true || payload.event === 'cancelled';
    const numberOfPersons = payload.totalAdults || 0;
    // Udtræk ALLE pladser fra booking (flere pladser per kunde)
    const spotNumbers = payload.rooms?.map((r: any) => r.RoomName).filter(Boolean) || [];
    const spotNumber = spotNumbers[0] || null; // Bagudkompatibilitet

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

    // ==================== HYTTE-LOGIK ====================
    // Tjek om RoomName matcher en hytte i cabins tabellen
    const { data: cabin } = await supabaseClient
      .from('cabins')
      .select('*')
      .eq('cabin_number', spotNumber)
      .eq('is_active', true)
      .maybeSingle();

    const isCabinBooking = !!cabin;
    let cabinMeterId = cabin?.meter_id || null;

    if (isCabinBooking) {
      console.log(`HYTTE BOOKING identificeret: ${cabin.name} (nummer ${cabin.cabin_number}), måler: ${cabinMeterId}`);
    }

    if (checkedOut || isCancelled) {
      console.log(`Kunde ${bookingId} er ${isCancelled ? 'annulleret' : 'checked out'} - sletter`);

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

      // Beregn checkout statistik (variabler bruges også til checkout_log)
      let totalKwhBought = 0;
      let totalKwhConsumed = 0;
      let totalKwhForfeited = 0;
      
      if (customerPackages && customerPackages.length > 0) {
        for (const pkg of customerPackages) {
          const kwhBought = parseFloat(pkg.data.enheder || '0');
          const accumulated = parseFloat(pkg.data.accumulated_usage || '0');
          
          // Hent nuværende meter reading hvis kunden har en måler
          let currentConsumption = 0;
          if (customer?.meter_id) {
            const { data: meterReading } = await supabaseClient
              .from('meter_readings')
              .select('energy')
              .eq('meter_id', customer.meter_id)
              .order('time', { ascending: false })
              .limit(1)
              .single();
            
            const pakkeStartEnergy = pkg.data.pakke_start_energy || 0;
            currentConsumption = (meterReading?.energy || 0) - pakkeStartEnergy;
          }
          
          const totalConsumption = accumulated + currentConsumption;
          totalKwhBought += kwhBought;
          totalKwhConsumed += totalConsumption;
        }
        
        totalKwhForfeited = Math.max(0, totalKwhBought - totalKwhConsumed);
        
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

      // Log individuel checkout til audit_log (ALTID - også uden pakker)
      await supabaseClient
        .from('plugin_data')
        .insert({
          organization_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          module: 'checkout_log',
          ref_id: bookingId.toString(),
          key: 'checkout_' + bookingId + '_' + Date.now(),
          data: {
            booking_nummer: bookingId,
            kunde_navn: (firstName + ' ' + (lastName || '')).trim() || 'Ukendt',
            kunde_type: customerType,
            kwh_bought: totalKwhBought,
            kwh_consumed: totalKwhConsumed,
            kwh_forfeited: totalKwhForfeited,
            had_packages: customerPackages && customerPackages.length > 0,
            checkout_time: new Date().toISOString()
          }
        });
      console.log('Checkout log oprettet for booking ' + bookingId);

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
        // customer.meter_id indeholder meter_number (f.eks. "Kontor test", "F43")
        // Indsæt OFF kommando direkte med meter_number
        await supabaseClient
          .from('meter_commands')
          .insert({
            meter_id: customer.meter_id,
            command: 'set_state',
            value: 'OFF',
            status: 'pending'
          });
        console.log(`OFF kommando sendt til måler ${customer.meter_id}`);

        // Frigør måler i database (søg på meter_number, ikke id)
        await supabaseClient
          .from('power_meters')
          .update({
            is_available: true,
            current_customer_id: null,
            updated_at: new Date().toISOString()
          })
          .eq('meter_number', customer.meter_id);
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

      // ==================== HYTTE CHECKOUT: Opret rengørings-schedule ====================
      if (isCabinBooking && cabinMeterId) {
        // Opret cleaning schedule for SAMME dag
        const cleaningDate = getTodayDanish();
        const currentHour = getDanishHour();
        
        const cleaningStart = new Date(`${cleaningDate}T10:00:00+01:00`);
        const cleaningEnd = new Date(`${cleaningDate}T15:00:00+01:00`);
        
        // Bestem status baseret på klokkeslæt
        // Før 10:00 = scheduled (cron tænder)
        // 10:00-13:00 = active (tænd strøm med det samme)
        const cleaningStatus = (currentHour >= 10 && currentHour < 15) ? 'active' : 'scheduled';

        const { error: cleaningError } = await supabaseClient
          .from('cabin_cleaning_schedule')
          .insert({
            cabin_id: cabin.id,
            meter_id: cabinMeterId,
            checkout_date: cleaningDate,
            cleaning_start: cleaningStart.toISOString(),
            cleaning_end: cleaningEnd.toISOString(),
            status: cleaningStatus
          });

        if (cleaningError) {
          console.error('Fejl ved oprettelse af rengørings-schedule:', cleaningError);
        } else {
          console.log(`Rengørings-schedule oprettet for ${cabin.name} d. ${cleaningDate} kl. 10:00-15:00 (status: ${cleaningStatus})`);
          
          // Hvis aktiv status, tænd strøm med det samme (rengøring starter nu)
          if (cleaningStatus === 'active') {
            await supabaseClient
              .from('meter_commands')
              .insert({
                meter_id: cabinMeterId,
                command: 'set_state',
                value: 'ON',
                status: 'pending'
              });
            console.log(`Rengørings-strøm TÆNDT for ${cabin.name} (kl. ${currentHour}:xx)`);
          }
        }
      }

    } else {
      // Opret eller opdater kunde
      let movedCustomer = false;

      // ==================== FLYTNING: Find eksisterende kunde og måler ====================
      const { data: existingRegularForMove } = await supabaseClient
        .from('regular_customers')
        .select('meter_id')
        .eq('booking_id', bookingId)
        .maybeSingle();
      
      const { data: existingSeasonalForMove } = await supabaseClient
        .from('seasonal_customers')
        .select('meter_id')
        .eq('booking_id', bookingId)
        .maybeSingle();
      
      const existingMeterId = existingRegularForMove?.meter_id || existingSeasonalForMove?.meter_id;
      const isExistingCabinMeter = existingMeterId && existingMeterId.toLowerCase().startsWith('hytte');
      const isNewCabinBooking = isCabinBooking && cabinMeterId;
      const meterChanged = existingMeterId && existingMeterId !== cabinMeterId;

      // ==================== FRAFLYTNING FRA HYTTE ====================
      // Trigger: Eksisterende måler er hytte OG (ny destination er anden hytte ELLER ikke-hytte)
      if (isExistingCabinMeter && meterChanged) {
        console.log(`HYTTE FRAFLYTNING: Kunde ${bookingId} forlader ${existingMeterId}`);
        
        // Find den gamle hytte for rengøring
        const { data: oldCabin } = await supabaseClient
          .from('cabins')
          .select('id, name')
          .eq('meter_id', existingMeterId)
          .maybeSingle();
        
        // 1. Sluk strøm på gammel hytte
        await supabaseClient
          .from('meter_commands')
          .insert({
            meter_id: existingMeterId,
            command: 'set_state',
            value: 'OFF',
            status: 'pending'
          });
        console.log(`OFF kommando sendt til gammel hytte: ${existingMeterId}`);
        
        // 2. Opret rengørings-schedule for gammel hytte (SAMME dag)
        if (oldCabin) {
          const cleaningDate = getTodayDanish();
          const currentHour = getDanishHour();
          const cleaningStart = new Date(`${cleaningDate}T10:00:00+01:00`);
          const cleaningEnd = new Date(`${cleaningDate}T15:00:00+01:00`);
          const cleaningStatus = (currentHour >= 10 && currentHour < 15) ? 'active' : 'scheduled';
          
          await supabaseClient
            .from('cabin_cleaning_schedule')
            .insert({
              cabin_id: oldCabin.id,
              meter_id: existingMeterId,
              checkout_date: cleaningDate,
              cleaning_start: cleaningStart.toISOString(),
              cleaning_end: cleaningEnd.toISOString(),
              status: cleaningStatus
            });
          console.log(`Rengørings-schedule oprettet for ${oldCabin.name} (fraflytning) - status: ${cleaningStatus}`);
          
          // Tænd rengørings-strøm hvis inden for vindue
          if (cleaningStatus === 'active') {
            await supabaseClient
              .from('meter_commands')
              .insert({
                meter_id: existingMeterId,
                command: 'set_state',
                value: 'ON',
                status: 'pending'
              });
            console.log(`Rengørings-strøm TÆNDT for ${oldCabin.name}`);
          }
        }
        
        // 3. Akkumuler forbrug fra gammel måler og opdater pakke
        const { data: existingPackages } = await supabaseClient
          .from('plugin_data')
          .select('id, data')
          .eq('module', 'pakker')
          .filter('data->>booking_nummer', 'eq', bookingId.toString())
          .eq('data->>status', 'aktiv');
        
        if (existingPackages && existingPackages.length > 0) {
          // Hent forbrug fra gammel måler
          const { data: oldMeterReading } = await supabaseClient
            .from('meter_readings')
            .select('energy')
            .eq('meter_id', existingMeterId)
            .order('time', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          for (const pkg of existingPackages) {
            const oldStartEnergy = pkg.data.pakke_start_energy || 0;
            const currentEnergy = oldMeterReading?.energy || 0;
            const consumedOnOldMeter = Math.max(0, currentEnergy - oldStartEnergy);
            const previousAccumulated = parseFloat(pkg.data.accumulated_usage || '0');
            const newAccumulated = previousAccumulated + consumedOnOldMeter;
            
            // Hent startstand for NY måler (hvis der er en)
            let newStartEnergy = 0;
            if (cabinMeterId || existingMeterId !== cabinMeterId) {
              const newMeterId = cabinMeterId || null;
              if (newMeterId) {
                const { data: newMeterReading } = await supabaseClient
                  .from('meter_readings')
                  .select('energy')
                  .eq('meter_id', newMeterId)
                  .order('time', { ascending: false })
                  .limit(1)
                  .maybeSingle();
                newStartEnergy = newMeterReading?.energy || 0;
              }
            }
            
            // Opdater pakke
            const updatedData = {
              ...pkg.data,
              accumulated_usage: newAccumulated.toFixed(2),
              pakke_start_energy: newStartEnergy,
              previous_meter: existingMeterId,
              moved_at: new Date().toISOString()
            };
            
            // Hvis flytning fra hytte til camping: Konverter pakke-kategori
            if (!isNewCabinBooking) {
              updatedData.pakke_kategori = 'standard';
              updatedData.kunde_type = customerType;
              console.log(`Pakke konverteret fra hytte_prepaid til standard`);
            }
            
            await supabaseClient
              .from('plugin_data')
              .update({ data: updatedData })
              .eq('id', pkg.id);
            
            console.log(`Pakke opdateret: Akkumuleret ${newAccumulated.toFixed(2)} kWh, ny start: ${newStartEnergy}`);
          }
        }
        
        // 4. Hvis ny destination er hytte OG kunden er checked ind: Tænd strøm
        if (isNewCabinBooking && checkedIn) {
          await supabaseClient
            .from('meter_commands')
            .insert({
              meter_id: cabinMeterId,
              command: 'set_state',
              value: 'ON',
              status: 'pending'
            });
          console.log(`ON kommando sendt til ny hytte: ${cabinMeterId}`);
        }
      }

      // ==================== TILFLYTNING TIL HYTTE (fra camping) ====================
      // Trigger: Ny destination er hytte OG kunden er checked ind OG (ingen eksisterende måler ELLER eksisterende er ikke hytte)
      // VIGTIGT: Kun ved check-in for at undgå at tænde strøm for fremtidige bookinger
      if (isNewCabinBooking && checkedIn && (!existingMeterId || !isExistingCabinMeter)) {
        console.log(`HYTTE TILFLYTNING: Kunde ${bookingId} flytter til ${cabinMeterId} fra ${existingMeterId || 'ingen måler'}`);
        
        // 1. Akkumuler forbrug fra gammel måler (hvis findes)
        if (existingMeterId) {
          const { data: oldMeterReading } = await supabaseClient
            .from('meter_readings')
            .select('energy')
            .eq('meter_id', existingMeterId)
            .order('time', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          const { data: existingPackages } = await supabaseClient
            .from('plugin_data')
            .select('id, data')
            .eq('module', 'pakker')
            .filter('data->>booking_nummer', 'eq', bookingId.toString())
            .eq('data->>status', 'aktiv');
          
          if (existingPackages && existingPackages.length > 0) {
            // Hent startstand for ny hytte-måler (kun én gang)
            const { data: newMeterReading } = await supabaseClient
              .from('meter_readings')
              .select('energy')
              .eq('meter_id', cabinMeterId)
              .order('time', { ascending: false })
              .limit(1)
              .maybeSingle();
            const newStartEnergy = newMeterReading?.energy || 0;
            
            // Beregn hytte-dage (fra nu til afrejse) - kun én gang
            const today = new Date(getTodayDanish());
            const departure = new Date(departureDate);
            const remainingDays = Math.max(1, Math.ceil((departure.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
            const additionalUnits = remainingDays * 10;
            
            // Kun tilføj hytte-dage til den PRIMÆRE pakke (første/ældste)
            // Andre pakker får kun akkumulering og ny startstand
            let primaryPackageUpdated = false;
            
            for (const pkg of existingPackages) {
              const oldStartEnergy = pkg.data.pakke_start_energy || 0;
              const currentEnergy = oldMeterReading?.energy || 0;
              const consumedOnOldMeter = Math.max(0, currentEnergy - oldStartEnergy);
              const previousAccumulated = parseFloat(pkg.data.accumulated_usage || '0');
              const newAccumulated = previousAccumulated + consumedOnOldMeter;
              
              const currentUnits = parseFloat(pkg.data.enheder || '0');
              
              // Opdater pakke: Akkumuler + konverter til hytte
              const updatedData = {
                ...pkg.data,
                accumulated_usage: newAccumulated.toFixed(2),
                pakke_start_energy: newStartEnergy,
                pakke_kategori: 'hytte_prepaid',
                kunde_type: 'hytte',
                previous_meter: existingMeterId,
                moved_at: new Date().toISOString()
              };
              
              // Kun tilføj hytte-enheder til den FØRSTE pakke
              if (!primaryPackageUpdated) {
                updatedData.enheder = currentUnits + additionalUnits;
                updatedData.cabin_days_added = remainingDays;
                primaryPackageUpdated = true;
                console.log(`PRIMÆR pakke opgraderet til hytte: +${additionalUnits} enheder (${remainingDays} dage), total: ${currentUnits + additionalUnits}`);
              } else {
                console.log(`Sekundær pakke opdateret (ingen ekstra enheder): ${currentUnits} enheder`);
              }
              
              await supabaseClient
                .from('plugin_data')
                .update({ data: updatedData })
                .eq('id', pkg.id);
            }
          }
        }
        
        // 2. Tænd strøm på ny hytte
        await supabaseClient
          .from('meter_commands')
          .insert({
            meter_id: cabinMeterId,
            command: 'set_state',
            value: 'ON',
            status: 'pending'
          });
        console.log(`ON kommando sendt til hytte: ${cabinMeterId}`);
      }

      if (isSeasonalCustomer) {
        // KRITISK: Hent eksisterende sæsonkunde data FØRST for at bevare måler-info
        const { data: existingSeasonalSelf } = await supabaseClient
          .from('seasonal_customers')
          .select('meter_id, meter_start_energy, meter_start_time')
          .eq('booking_id', bookingId)
          .maybeSingle();

        // Tjek om kunden findes som regular customer (for flytning)
        const { data: existingRegular } = await supabaseClient
          .from('regular_customers')
          .select('*')
          .eq('booking_id', bookingId)
          .maybeSingle();

        if (existingRegular) {
          console.log(`Flytter kunde ${bookingId} fra regular til seasonal`);
          await supabaseClient
            .from('regular_customers')
            .delete()
            .eq('booking_id', bookingId);
          movedCustomer = true;
        }

        // Bestem meter_id: 
        // 1) Hytte booking OG checked_in → brug hyttens måler
        // 2) Hytte booking men IKKE checked_in → gem IKKE måler (venter på check-in)
        // 3) Flytning FRA hytte → nulstil (kunden vælger selv ny måler)
        // 4) Ellers → behold eksisterende
        // VIGTIGT: Hytte-måler tildeles KUN ved check-in for at undgå problemer med fremtidige/annullerede bookinger
        const existingMeter = existingSeasonalSelf?.meter_id || existingRegular?.meter_id || null;
        const isMovingFromCabin = existingMeter && existingMeter.toLowerCase().startsWith('hytte') && !isCabinBooking;
        const resolvedMeterId = (isCabinBooking && checkedIn)
          ? cabinMeterId 
          : (isMovingFromCabin ? null : existingMeter);

        // Gem som sæson kunde - BEVAR eksisterende måler-data!
        const seasonalData = {
          booking_id: bookingId,
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: phone,
          customer_type: isCabinBooking ? 'hytte' : customerType,
          arrival_date: arrivalDate,
          departure_date: departureDate,
          checked_in: checkedIn,
          checked_out: checkedOut,
          spot_number: spotNumber,
          spot_numbers: spotNumbers, // ALLE pladser fra booking
          license_plates: licensePlates,
          meter_id: resolvedMeterId,
          // KRITISK: Bevar eksisterende måler start-data!
          meter_start_energy: existingSeasonalSelf?.meter_start_energy || existingRegular?.meter_start_energy || null,
          meter_start_time: existingSeasonalSelf?.meter_start_time || existingRegular?.meter_start_time || null,
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
        // KRITISK: Hent eksisterende regular kunde data FØRST for at bevare måler-info
        const { data: existingRegularSelf } = await supabaseClient
          .from('regular_customers')
          .select('meter_id, meter_start_energy, meter_start_time')
          .eq('booking_id', bookingId)
          .maybeSingle();

        // Tjek om kunden findes som seasonal customer (for flytning)
        const { data: existingSeasonal } = await supabaseClient
          .from('seasonal_customers')
          .select('*')
          .eq('booking_id', bookingId)
          .maybeSingle();

        if (existingSeasonal) {
          console.log(`Flytter kunde ${bookingId} fra seasonal til regular`);
          await supabaseClient
            .from('seasonal_customers')
            .delete()
            .eq('booking_id', bookingId);
          movedCustomer = true;
        }

        // Bestem meter_id: 
        // 1) Hytte booking OG checked_in → brug hyttens måler
        // 2) Hytte booking men IKKE checked_in → gem IKKE måler (venter på check-in)
        // 3) Flytning FRA hytte → nulstil (kunden vælger selv ny måler)
        // 4) Ellers → behold eksisterende
        // VIGTIGT: Hytte-måler tildeles KUN ved check-in for at undgå problemer med fremtidige/annullerede bookinger
        const existingMeter = existingRegularSelf?.meter_id || existingSeasonal?.meter_id || null;
        const isMovingFromCabin = existingMeter && existingMeter.toLowerCase().startsWith('hytte') && !isCabinBooking;
        const resolvedMeterId = (isCabinBooking && checkedIn)
          ? cabinMeterId 
          : (isMovingFromCabin ? null : existingMeter);

        // Gem som kørende kunde - BEVAR eksisterende måler-data!
        const regularData = {
          booking_id: bookingId,
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: phone,
          customer_type: isCabinBooking ? 'hytte' : customerType,
          arrival_date: arrivalDate,
          departure_date: departureDate,
          checked_in: checkedIn,
          checked_out: checkedOut,
          number_of_persons: numberOfPersons,
          spot_number: spotNumber,
          spot_numbers: spotNumbers, // ALLE pladser fra booking
          license_plates: licensePlates,
          meter_id: resolvedMeterId,
          // KRITISK: Bevar eksisterende måler start-data!
          meter_start_energy: existingRegularSelf?.meter_start_energy || existingSeasonal?.meter_start_energy || null,
          meter_start_time: existingRegularSelf?.meter_start_time || existingSeasonal?.meter_start_time || null,
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

      // ==================== AUTO-SEND VELKOMST EMAIL ====================
      // Send email straks hvis ankomst er inden for X dage (variabel fra admin)
      // Kun hvis kunde har email og ikke allerede har modtaget welcome_email
      // VIGTIGT: Tjek FØRST om magic_token allerede eksisterer (robust mod race conditions)
      if (email && !checkedIn && !checkedOut) {
        // Tjek om kunden allerede har magic_token (= email proces er startet)
        const customerTable = isSeasonalCustomer ? 'seasonal_customers' : 'regular_customers';
        const { data: customerWithToken } = await supabaseClient
          .from(customerTable)
          .select('magic_token')
          .eq('booking_id', bookingId)
          .maybeSingle();

        // Hvis magic_token allerede eksisterer, er email allerede sendt/under afsendelse
        if (customerWithToken?.magic_token) {
          console.log(`Magic token eksisterer allerede for booking ${bookingId} - skipper email`);
        } else {
          // Hent trigger_days_before fra welcome_email template
          const { data: emailTemplate } = await supabaseClient
            .from('email_templates')
            .select('trigger_days_before')
            .eq('name', 'welcome_email')
            .eq('is_active', true)
            .maybeSingle();

          if (emailTemplate?.trigger_days_before !== null) {
            const triggerDays = emailTemplate.trigger_days_before;
            const today = new Date(getDanishTime());
            const arrival = new Date(arrivalDate);
            const daysUntilArrival = Math.ceil((arrival.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            // Send email hvis ankomst er inden for trigger_days_before dage
            if (daysUntilArrival <= triggerDays && daysUntilArrival >= 0) {
              // Dobbelttjek: email_logs (backup check)
              const { data: existingEmailLog } = await supabaseClient
                .from('email_logs')
                .select('id')
                .eq('booking_id', bookingId)
                .eq('template_name', 'welcome_email')
                .maybeSingle();

              if (!existingEmailLog) {
                // Send welcome email via Edge Function
                try {
                  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
                  const response = await fetch(`${supabaseUrl}/functions/v1/send-welcome-email`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ booking_id: bookingId })
                  });
                  const result = await response.json();
                  
                  if (result.success) {
                    console.log(`✅ Velkomst email AUTO-SENDT til ${email} (ankomst om ${daysUntilArrival} dage, trigger: ${triggerDays} dage)`);
                  } else {
                    console.error(`Fejl ved auto-send af velkomst email:`, result.error);
                  }
                } catch (emailError) {
                  console.error(`Fejl ved kald af send-welcome-email:`, emailError);
                }
              } else {
                console.log(`Velkomst email allerede sendt til booking ${bookingId} (fundet i email_logs)`);
              }
            }
          }
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

      // ==================== KØRENDE CAMPIST: Energy supplemt → Dagspakke ====================
      // Logik: Kun kørende campister (ikke sæson, ikke hytte), kun ved check-in
      // Energy supplemt fra Sirvoy = quantity × 10 enheder
      if (!isCabinBooking && !isSeasonalCustomer && checkedIn) {
        const energyItem = payload.additionalItems?.find((item: any) => 
          item.description?.toLowerCase().includes('energy')
        );

        if (energyItem && energyItem.quantity > 0) {
          const enheder = energyItem.quantity * 10;
          
          // Tjek om pakke allerede findes (duplikat-beskyttelse)
          // Tjek for sirvoy-betalte pakker for denne booking
          const { data: existingEnergyPackage } = await supabaseClient
            .from('plugin_data')
            .select('id')
            .eq('module', 'pakker')
            .filter('data->>booking_nummer', 'eq', bookingId.toString())
            .filter('data->>betaling_metode', 'eq', 'sirvoy')
            .maybeSingle();

          if (!existingEnergyPackage) {
            // Hent kundens måler (hvis tildelt)
            const { data: customer } = await supabaseClient
              .from('regular_customers')
              .select('meter_id')
              .eq('booking_id', bookingId)
              .maybeSingle();

            let startEnergy = 0;
            if (customer?.meter_id) {
              const { data: meterReading } = await supabaseClient
                .from('meter_readings')
                .select('energy')
                .eq('meter_id', customer.meter_id)
                .order('time', { ascending: false })
                .limit(1)
                .maybeSingle();
              startEnergy = meterReading?.energy || 0;
            }

            // Beregn varighed i timer (quantity = antal dage)
            const varighedTimer = energyItem.quantity * 24;

            // Opret dagspakke med SAMME struktur som stripe-webhook
            const { error: packageError } = await supabaseClient
              .from('plugin_data')
              .insert({
                organization_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                module: 'pakker',
                ref_id: bookingId.toString(),
                key: `pakke_sirvoy_${bookingId}_${Date.now()}`,
                data: {
                  booking_nummer: bookingId,
                  pakke_navn: `Dagspakke ${energyItem.quantity} dage (Sirvoy)`,
                  pakke_type: 'dags',
                  enheder: enheder,
                  varighed_timer: varighedTimer,
                  pakke_start_energy: startEnergy,
                  status: 'aktiv',
                  betaling_metode: 'sirvoy',
                  oprettet: new Date().toISOString(),
                  sirvoy_quantity: energyItem.quantity,
                  sirvoy_price: energyItem.itemTotal
                }
              });

            if (packageError) {
              console.error('Fejl ved oprettelse af Sirvoy energy pakke:', packageError);
            } else {
              console.log(`✅ Sirvoy Energy pakke OPRETTET: ${enheder} enheder (${energyItem.quantity} stk) for booking ${bookingId}`);
            }
          } else {
            console.log(`Sirvoy Energy pakke eksisterer allerede for booking ${bookingId} - ignorerer duplikat`);
          }
        }
      }

      // ==================== HYTTE: Prepaid pakke + Auto-tænd ====================
      // VIGTIGT: Kun opret prepaid pakke ved CHECK-IN for at undgå problemer med fremtidige/annullerede bookinger
      if (isCabinBooking && cabinMeterId && checkedIn) {
        // Beregn antal dage
        const arrival = new Date(arrivalDate);
        const departure = new Date(departureDate);
        const days = Math.ceil((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24));
        const prepaidUnits = days * 10;

        // Tjek om prepaid pakke allerede findes
        const { data: existingPrepaid } = await supabaseClient
          .from('plugin_data')
          .select('id, data')
          .eq('module', 'pakker')
          .filter('data->>booking_nummer', 'eq', bookingId.toString())
          .filter('data->>pakke_kategori', 'eq', 'hytte_prepaid')
          .maybeSingle();

        if (existingPrepaid) {
          // Pakke eksisterer - tjek om dage er ændret
          const existingDays = parseInt(existingPrepaid.data?.dage || '0');
          
          if (existingDays !== days) {
            // Dage er ændret - opdater pakken
            const updatedData = {
              ...existingPrepaid.data,
              dage: days,
              enheder: prepaidUnits,
              pakke_navn: `Energipakke ${days} dage - refunderes ikke ved ikke brugt`
            };

            const { error: updateError } = await supabaseClient
              .from('plugin_data')
              .update({ data: updatedData })
              .eq('id', existingPrepaid.id);

            if (updateError) {
              console.error('Fejl ved opdatering af hytte prepaid pakke:', updateError);
            } else {
              console.log(`Hytte prepaid pakke OPDATERET: ${existingDays} → ${days} dage (${prepaidUnits} enheder) for ${cabin.name}`);
            }
          } else {
            console.log(`Hytte prepaid pakke uændret: ${days} dage for ${cabin.name}`);
          }
        } else {
          // Opret ny prepaid pakke
          // Hent nuværende målerstand
          const { data: meterReading } = await supabaseClient
            .from('meter_readings')
            .select('energy')
            .eq('meter_id', cabinMeterId)
            .order('time', { ascending: false })
            .limit(1)
            .maybeSingle();

          const startEnergy = meterReading?.energy || 0;

          // Opret prepaid pakke
          const { error: prepaidError } = await supabaseClient
            .from('plugin_data')
            .insert({
              organization_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
              module: 'pakker',
              ref_id: bookingId.toString(),
              key: `pakke_hytte_${bookingId}_${Date.now()}`,
              data: {
                booking_nummer: bookingId,
                type_id: 'hytte-prepaid',
                pakke_navn: `Energipakke ${days} dage - refunderes ikke ved ikke brugt`,
                pakke_kategori: 'hytte_prepaid',
                enheder: prepaidUnits,
                pakke_start_energy: startEnergy,
                status: 'aktiv',
                betaling_metode: 'inkluderet',
                kunde_type: 'hytte',
                dage: days
              }
            });

          if (prepaidError) {
            console.error('Fejl ved oprettelse af hytte prepaid pakke:', prepaidError);
          } else {
            console.log(`Hytte prepaid pakke oprettet: ${prepaidUnits} enheder (${days} dage) for ${cabin.name}`);
          }
        }

        // ==================== HYTTE: Auto-tænd ved check-in ====================
        if (checkedIn) {
          // Tjek om der er aktiv ELLER scheduled rengørings-session for denne hytte
          const { data: pendingCleaningSessions } = await supabaseClient
            .from('cabin_cleaning_schedule')
            .select('id, status')
            .eq('cabin_id', cabin.id)
            .in('status', ['active', 'scheduled']);

          if (pendingCleaningSessions && pendingCleaningSessions.length > 0) {
            // Afslut alle pending rengørings-sessioner - gæst er ankommet/flyttet ind
            for (const session of pendingCleaningSessions) {
              await supabaseClient
                .from('cabin_cleaning_schedule')
                .update({ status: 'guest_arrived' })
                .eq('id', session.id);
              console.log(`Rengørings-session (${session.status}) annulleret - gæst ankommet til ${cabin.name}`);
            }
          }

          // Tænd strøm
          const { error: powerOnError } = await supabaseClient
            .from('meter_commands')
            .insert({
              meter_id: cabinMeterId,
              command: 'set_state',
              value: 'ON',
              status: 'pending'
            });

          if (powerOnError) {
            console.error('Fejl ved tænd-kommando til hytte:', powerOnError);
          } else {
            console.log(`Strøm TÆNDT for ${cabin.name} (måler ${cabinMeterId}) - gæst checked ind`);
          }
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
