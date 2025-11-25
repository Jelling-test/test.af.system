import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const homeAssistantUrl = Deno.env.get('HOME_ASSISTANT_URL')!;
    const homeAssistantToken = Deno.env.get('HOME_ASSISTANT_TOKEN')!;
    const organizationId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

    if (!homeAssistantUrl || !homeAssistantToken) {
      throw new Error('Home Assistant configuration missing. Add HOME_ASSISTANT_URL and HOME_ASSISTANT_TOKEN to Supabase secrets.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔍 Fetching entities from Home Assistant...');

    // Fetch all entities from HA
    const haResponse = await fetch(`${homeAssistantUrl}/api/states`, {
      headers: {
        'Authorization': `Bearer ${homeAssistantToken}`,
        'Content-Type': 'application/json',
      }
    });

    if (!haResponse.ok) {
      const errorText = await haResponse.text();
      throw new Error(`HA API error: ${haResponse.status} - ${errorText}`);
    }

    const allEntities = await haResponse.json();

    // Filter only switch entities that are meters
    const meterEntities = allEntities.filter((entity: any) => {
      if (!entity.entity_id.startsWith('switch.')) return false;
      if (entity.entity_id.includes('zigbee2mqtt_bridge')) return false;
      if (entity.entity_id.includes('_update')) return false;
      if (entity.entity_id.includes('_restart')) return false;
      if (entity.entity_id.includes('_identify')) return false;
      return true;
    });

    console.log(`✅ Found ${meterEntities.length} meters in HA`);

    // Get existing meters from Supabase
    const { data: existingMeters, error: fetchError } = await supabase
      .from('plugin_data')
      .select('*')
      .eq('module', 'målere')
      .eq('organization_id', organizationId);

    if (fetchError) throw fetchError;

    console.log(`📊 Found ${existingMeters?.length || 0} existing meters in Supabase`);

    // Process each meter
    let created = 0;
    let updated = 0;
    let failed = 0;
    const newMeters: any[] = [];
    const updatedMeters: any[] = [];

    for (const entity of meterEntities) {
      const entityId = entity.entity_id;
      const friendlyName = entity.attributes.friendly_name || 
        entityId.replace('switch.', '').replace(/_/g, ' ');
      const currentState = entity.state;

      // Check if meter already exists
      const existing = existingMeters?.find(
        (m: any) => m.data?.ha_entity_id === entityId
      );

      try {
        if (existing) {
          // Update existing meter
          const { error: updateError } = await supabase
            .from('plugin_data')
            .update({
              data: {
                ...existing.data,
                ha_entity_id: entityId,
                power_status: currentState,
                last_online: new Date().toISOString(),
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updateError) throw updateError;
          updated++;
          updatedMeters.push({
            entity_id: entityId,
            friendly_name: existing.data.maaler_navn,
            state: currentState,
          });
          console.log(`🔄 Updated: ${existing.data.maaler_navn}`);
        } else {
          // Create new meter with default name
          const { error: insertError } = await supabase
            .from('plugin_data')
            .insert({
              organization_id: organizationId,
              module: 'målere',
              ref_id: crypto.randomUUID(),
              data: {
                maaler_navn: friendlyName,
                status: 'ledig',
                ha_entity_id: entityId,
                power_status: currentState,
                last_online: new Date().toISOString(),
              },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          if (insertError) throw insertError;
          created++;
          newMeters.push({
            entity_id: entityId,
            friendly_name: friendlyName,
            state: currentState,
          });
          console.log(`➕ Created: ${friendlyName}`);
        }
      } catch (error) {
        console.error(`❌ Failed to process ${entityId}:`, error);
        failed++;
      }
    }

    // Return results
    return new Response(
      JSON.stringify({
        success: true,
        message: `Synkronisering fuldført: ${created} nye, ${updated} opdateret, ${failed} fejl`,
        summary: {
          total_in_ha: meterEntities.length,
          total_in_supabase: (existingMeters?.length || 0) + created,
          created,
          updated,
          failed,
        },
        new_meters: newMeters,
        updated_meters: updatedMeters,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Error in discover-ha-meters:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
