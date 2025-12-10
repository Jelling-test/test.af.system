import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, ArrowLeft, Waves, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface PoolSettings {
  id: string;
  header_image: string | null;
  access_title_da: string;
  access_title_en: string;
  access_title_de: string;
  access_text_da: string;
  access_text_en: string;
  access_text_de: string;
  season_dates: string;
  morning_swim_time: string;
  period1_label: string;
  period1_dates: string;
  period1_weekdays: string;
  period1_weekend: string;
  period2_label: string;
  period2_dates: string;
  period2_everyday: string;
  closed_dates: string | null;
  location_address: string;
  location_text_da: string;
  location_text_en: string;
  location_text_de: string;
  external_url: string;
}

const AdminPool = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<PoolSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('pool_settings')
        .select('*')
        .single();
      
      if (error) throw error;
      setSettings(data);
    } catch (error) {
      console.error('Error fetching pool settings:', error);
      toast.error('Kunne ikke hente indstillinger');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !settings) return;
    
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `pool-header-${Date.now()}.${fileExt}`;
      const filePath = `pool/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);
      
      setSettings({ ...settings, header_image: urlData.publicUrl });
      toast.success('Billede uploadet!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Kunne ikke uploade billede');
    } finally {
      setUploading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('pool_settings')
        .update({
          header_image: settings.header_image,
          access_title_da: settings.access_title_da,
          access_title_en: settings.access_title_en,
          access_title_de: settings.access_title_de,
          access_text_da: settings.access_text_da,
          access_text_en: settings.access_text_en,
          access_text_de: settings.access_text_de,
          season_dates: settings.season_dates,
          morning_swim_time: settings.morning_swim_time,
          period1_label: settings.period1_label,
          period1_dates: settings.period1_dates,
          period1_weekdays: settings.period1_weekdays,
          period1_weekend: settings.period1_weekend,
          period2_label: settings.period2_label,
          period2_dates: settings.period2_dates,
          period2_everyday: settings.period2_everyday,
          closed_dates: settings.closed_dates,
          location_address: settings.location_address,
          location_text_da: settings.location_text_da,
          location_text_en: settings.location_text_en,
          location_text_de: settings.location_text_de,
          external_url: settings.external_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', settings.id);
      
      if (error) throw error;
      toast.success('Indstillinger gemt!');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Kunne ikke gemme');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Waves className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-bold">Friluftsbad</h1>
            </div>
          </div>
          <Button onClick={saveSettings} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Gemmer...' : 'Gem ændringer'}
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-6">
        
        {/* Header billede */}
        <Card>
          <CardHeader>
            <CardTitle>Header Billede</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {settings.header_image && (
              <img src={settings.header_image} alt="Header" className="w-full h-48 object-cover rounded-lg" />
            )}
            <div className="flex gap-2">
              <Button variant="outline" disabled={uploading} onClick={() => document.getElementById('header-upload')?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Uploader...' : 'Upload billede'}
              </Button>
              <input id="header-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              <Input 
                placeholder="Eller indsæt URL" 
                value={settings.header_image || ''} 
                onChange={e => setSettings({...settings, header_image: e.target.value})}
                className="flex-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Adgang tekster */}
        <Card>
          <CardHeader>
            <CardTitle>Fri adgang sektion</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="da">
              <TabsList>
                <TabsTrigger value="da">Dansk</TabsTrigger>
                <TabsTrigger value="en">English</TabsTrigger>
                <TabsTrigger value="de">Deutsch</TabsTrigger>
              </TabsList>
              <TabsContent value="da" className="space-y-4 mt-4">
                <div>
                  <Label>Titel</Label>
                  <Input value={settings.access_title_da} onChange={e => setSettings({...settings, access_title_da: e.target.value})} />
                </div>
                <div>
                  <Label>Tekst</Label>
                  <Textarea value={settings.access_text_da} onChange={e => setSettings({...settings, access_text_da: e.target.value})} rows={3} />
                </div>
              </TabsContent>
              <TabsContent value="en" className="space-y-4 mt-4">
                <div>
                  <Label>Title</Label>
                  <Input value={settings.access_title_en} onChange={e => setSettings({...settings, access_title_en: e.target.value})} />
                </div>
                <div>
                  <Label>Text</Label>
                  <Textarea value={settings.access_text_en} onChange={e => setSettings({...settings, access_text_en: e.target.value})} rows={3} />
                </div>
              </TabsContent>
              <TabsContent value="de" className="space-y-4 mt-4">
                <div>
                  <Label>Titel</Label>
                  <Input value={settings.access_title_de} onChange={e => setSettings({...settings, access_title_de: e.target.value})} />
                </div>
                <div>
                  <Label>Text</Label>
                  <Textarea value={settings.access_text_de} onChange={e => setSettings({...settings, access_text_de: e.target.value})} rows={3} />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Åbningstider */}
        <Card>
          <CardHeader>
            <CardTitle>Åbningstider</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Sæson datoer (f.eks. "7. juni - 31. august 2025")</Label>
              <Input value={settings.season_dates} onChange={e => setSettings({...settings, season_dates: e.target.value})} />
            </div>
            
            <div>
              <Label>Morgensvømning tid</Label>
              <Input value={settings.morning_swim_time} onChange={e => setSettings({...settings, morning_swim_time: e.target.value})} placeholder="06:00-08:30" />
            </div>
            
            <hr className="my-4" />
            
            <h4 className="font-medium text-blue-700">Lavsæson</h4>
            <div>
              <Label>Label</Label>
              <Input value={settings.period1_label} onChange={e => setSettings({...settings, period1_label: e.target.value})} />
            </div>
            <div>
              <Label>Datoer</Label>
              <Input value={settings.period1_dates} onChange={e => setSettings({...settings, period1_dates: e.target.value})} placeholder="7. juni - 27. juni + 11. august - 31. august" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Hverdage</Label>
                <Input value={settings.period1_weekdays} onChange={e => setSettings({...settings, period1_weekdays: e.target.value})} placeholder="15:00-19:00" />
              </div>
              <div>
                <Label>Weekend</Label>
                <Input value={settings.period1_weekend} onChange={e => setSettings({...settings, period1_weekend: e.target.value})} placeholder="12:00-20:00" />
              </div>
            </div>
            
            <hr className="my-4" />
            
            <h4 className="font-medium text-teal-700">Højsæson</h4>
            <div>
              <Label>Label</Label>
              <Input value={settings.period2_label} onChange={e => setSettings({...settings, period2_label: e.target.value})} />
            </div>
            <div>
              <Label>Datoer</Label>
              <Input value={settings.period2_dates} onChange={e => setSettings({...settings, period2_dates: e.target.value})} placeholder="28. juni - 10. august" />
            </div>
            <div>
              <Label>Alle dage</Label>
              <Input value={settings.period2_everyday} onChange={e => setSettings({...settings, period2_everyday: e.target.value})} placeholder="11:00-21:00" />
            </div>
            
            <hr className="my-4" />
            
            <div>
              <Label>Lukket datoer (valgfri, f.eks. "2025-07-01")</Label>
              <Input value={settings.closed_dates || ''} onChange={e => setSettings({...settings, closed_dates: e.target.value || null})} />
            </div>
          </CardContent>
        </Card>

        {/* Placering */}
        <Card>
          <CardHeader>
            <CardTitle>Placering</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Adresse</Label>
              <Input value={settings.location_address} onChange={e => setSettings({...settings, location_address: e.target.value})} />
            </div>
            <div>
              <Label>Ekstern URL (vejle.dk)</Label>
              <Input value={settings.external_url} onChange={e => setSettings({...settings, external_url: e.target.value})} />
            </div>
            <Tabs defaultValue="da">
              <TabsList>
                <TabsTrigger value="da">Dansk</TabsTrigger>
                <TabsTrigger value="en">English</TabsTrigger>
                <TabsTrigger value="de">Deutsch</TabsTrigger>
              </TabsList>
              <TabsContent value="da" className="mt-4">
                <Label>Beskrivelse</Label>
                <Textarea value={settings.location_text_da} onChange={e => setSettings({...settings, location_text_da: e.target.value})} rows={2} />
              </TabsContent>
              <TabsContent value="en" className="mt-4">
                <Label>Description</Label>
                <Textarea value={settings.location_text_en} onChange={e => setSettings({...settings, location_text_en: e.target.value})} rows={2} />
              </TabsContent>
              <TabsContent value="de" className="mt-4">
                <Label>Beschreibung</Label>
                <Textarea value={settings.location_text_de} onChange={e => setSettings({...settings, location_text_de: e.target.value})} rows={2} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default AdminPool;
