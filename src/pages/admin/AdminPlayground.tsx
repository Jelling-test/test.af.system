import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, ArrowLeft, TreePine, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface PlaygroundSettings {
  id: string;
  header_image: string | null;
  open_title_da: string;
  open_title_en: string;
  open_title_de: string;
  open_text_da: string;
  open_text_en: string;
  open_text_de: string;
  dinocar_title: string;
  dinocar_image: string | null;
  dinocar_text_da: string;
  dinocar_text_en: string;
  dinocar_text_de: string;
  hoppepude_title: string;
  hoppepude_image: string | null;
  hoppepude_text_da: string;
  hoppepude_text_en: string;
  hoppepude_text_de: string;
  minigolf_title: string;
  minigolf_image: string | null;
  minigolf_text_da: string;
  minigolf_text_en: string;
  minigolf_text_de: string;
  facilities_da: string;
  facilities_en: string;
  facilities_de: string;
  location_text_da: string;
  location_text_en: string;
  location_text_de: string;
}

const AdminPlayground = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<PlaygroundSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('playground_settings')
        .select('*')
        .single();
      
      if (error) throw error;
      setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Kunne ikke hente indstillinger');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: keyof PlaygroundSettings) => {
    const file = e.target.files?.[0];
    if (!file || !settings) return;
    
    setUploading(field);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `playground-${field}-${Date.now()}.${fileExt}`;
      const filePath = `playground/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);
      
      setSettings({ ...settings, [field]: urlData.publicUrl });
      toast.success('Billede uploadet!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Kunne ikke uploade billede');
    } finally {
      setUploading(null);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('playground_settings')
        .update({
          header_image: settings.header_image,
          open_title_da: settings.open_title_da,
          open_title_en: settings.open_title_en,
          open_title_de: settings.open_title_de,
          open_text_da: settings.open_text_da,
          open_text_en: settings.open_text_en,
          open_text_de: settings.open_text_de,
          dinocar_title: settings.dinocar_title,
          dinocar_image: settings.dinocar_image,
          dinocar_text_da: settings.dinocar_text_da,
          dinocar_text_en: settings.dinocar_text_en,
          dinocar_text_de: settings.dinocar_text_de,
          hoppepude_title: settings.hoppepude_title,
          hoppepude_image: settings.hoppepude_image,
          hoppepude_text_da: settings.hoppepude_text_da,
          hoppepude_text_en: settings.hoppepude_text_en,
          hoppepude_text_de: settings.hoppepude_text_de,
          minigolf_title: settings.minigolf_title,
          minigolf_image: settings.minigolf_image,
          minigolf_text_da: settings.minigolf_text_da,
          minigolf_text_en: settings.minigolf_text_en,
          minigolf_text_de: settings.minigolf_text_de,
          facilities_da: settings.facilities_da,
          facilities_en: settings.facilities_en,
          facilities_de: settings.facilities_de,
          location_text_da: settings.location_text_da,
          location_text_en: settings.location_text_en,
          location_text_de: settings.location_text_de,
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

  const ImageUploadField = ({ field, label }: { field: keyof PlaygroundSettings; label: string }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      {settings[field] && (
        <img src={settings[field] as string} alt={label} className="w-full h-32 object-cover rounded-lg" />
      )}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={uploading === field} onClick={() => document.getElementById(`upload-${field}`)?.click()}>
          <Upload className="h-4 w-4 mr-2" />
          {uploading === field ? 'Uploader...' : 'Upload'}
        </Button>
        <input id={`upload-${field}`} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, field)} />
        <Input 
          placeholder="Eller indsæt URL" 
          value={(settings[field] as string) || ''} 
          onChange={e => setSettings({...settings, [field]: e.target.value})}
          className="flex-1"
        />
      </div>
    </div>
  );

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
              <TreePine className="h-6 w-6 text-green-600" />
              <h1 className="text-xl font-bold">Legeplads</h1>
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
          <CardContent>
            <ImageUploadField field="header_image" label="Header billede" />
          </CardContent>
        </Card>

        {/* Åbningstider */}
        <Card>
          <CardHeader>
            <CardTitle className="text-green-700">⏰ Åbningstider</CardTitle>
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
                  <Input value={settings.open_title_da} onChange={e => setSettings({...settings, open_title_da: e.target.value})} />
                </div>
                <div>
                  <Label>Tekst</Label>
                  <Textarea value={settings.open_text_da} onChange={e => setSettings({...settings, open_text_da: e.target.value})} rows={2} />
                </div>
              </TabsContent>
              <TabsContent value="en" className="space-y-4 mt-4">
                <div>
                  <Label>Title</Label>
                  <Input value={settings.open_title_en} onChange={e => setSettings({...settings, open_title_en: e.target.value})} />
                </div>
                <div>
                  <Label>Text</Label>
                  <Textarea value={settings.open_text_en} onChange={e => setSettings({...settings, open_text_en: e.target.value})} rows={2} />
                </div>
              </TabsContent>
              <TabsContent value="de" className="space-y-4 mt-4">
                <div>
                  <Label>Titel</Label>
                  <Input value={settings.open_title_de} onChange={e => setSettings({...settings, open_title_de: e.target.value})} />
                </div>
                <div>
                  <Label>Text</Label>
                  <Textarea value={settings.open_text_de} onChange={e => setSettings({...settings, open_text_de: e.target.value})} rows={2} />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Dino Cars */}
        <Card>
          <CardHeader>
            <CardTitle className="text-red-700">🚗 Dino Cars</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Titel</Label>
              <Input value={settings.dinocar_title} onChange={e => setSettings({...settings, dinocar_title: e.target.value})} />
            </div>
            <ImageUploadField field="dinocar_image" label="Billede" />
            <Tabs defaultValue="da">
              <TabsList>
                <TabsTrigger value="da">Dansk</TabsTrigger>
                <TabsTrigger value="en">English</TabsTrigger>
                <TabsTrigger value="de">Deutsch</TabsTrigger>
              </TabsList>
              <TabsContent value="da" className="mt-4">
                <Textarea value={settings.dinocar_text_da} onChange={e => setSettings({...settings, dinocar_text_da: e.target.value})} rows={3} />
              </TabsContent>
              <TabsContent value="en" className="mt-4">
                <Textarea value={settings.dinocar_text_en} onChange={e => setSettings({...settings, dinocar_text_en: e.target.value})} rows={3} />
              </TabsContent>
              <TabsContent value="de" className="mt-4">
                <Textarea value={settings.dinocar_text_de} onChange={e => setSettings({...settings, dinocar_text_de: e.target.value})} rows={3} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Hoppepude */}
        <Card>
          <CardHeader>
            <CardTitle className="text-blue-700">🎈 Hoppepude</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Titel</Label>
              <Input value={settings.hoppepude_title} onChange={e => setSettings({...settings, hoppepude_title: e.target.value})} />
            </div>
            <ImageUploadField field="hoppepude_image" label="Billede" />
            <Tabs defaultValue="da">
              <TabsList>
                <TabsTrigger value="da">Dansk</TabsTrigger>
                <TabsTrigger value="en">English</TabsTrigger>
                <TabsTrigger value="de">Deutsch</TabsTrigger>
              </TabsList>
              <TabsContent value="da" className="mt-4">
                <Textarea value={settings.hoppepude_text_da} onChange={e => setSettings({...settings, hoppepude_text_da: e.target.value})} rows={3} />
              </TabsContent>
              <TabsContent value="en" className="mt-4">
                <Textarea value={settings.hoppepude_text_en} onChange={e => setSettings({...settings, hoppepude_text_en: e.target.value})} rows={3} />
              </TabsContent>
              <TabsContent value="de" className="mt-4">
                <Textarea value={settings.hoppepude_text_de} onChange={e => setSettings({...settings, hoppepude_text_de: e.target.value})} rows={3} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Minigolf */}
        <Card>
          <CardHeader>
            <CardTitle className="text-green-700">⛳ Minigolf</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Titel</Label>
              <Input value={settings.minigolf_title} onChange={e => setSettings({...settings, minigolf_title: e.target.value})} />
            </div>
            <ImageUploadField field="minigolf_image" label="Billede" />
            <Tabs defaultValue="da">
              <TabsList>
                <TabsTrigger value="da">Dansk</TabsTrigger>
                <TabsTrigger value="en">English</TabsTrigger>
                <TabsTrigger value="de">Deutsch</TabsTrigger>
              </TabsList>
              <TabsContent value="da" className="mt-4">
                <Textarea value={settings.minigolf_text_da} onChange={e => setSettings({...settings, minigolf_text_da: e.target.value})} rows={3} />
              </TabsContent>
              <TabsContent value="en" className="mt-4">
                <Textarea value={settings.minigolf_text_en} onChange={e => setSettings({...settings, minigolf_text_en: e.target.value})} rows={3} />
              </TabsContent>
              <TabsContent value="de" className="mt-4">
                <Textarea value={settings.minigolf_text_de} onChange={e => setSettings({...settings, minigolf_text_de: e.target.value})} rows={3} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Øvrige faciliteter */}
        <Card>
          <CardHeader>
            <CardTitle>🎢 Øvrige faciliteter</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Kommasepareret liste af faciliteter</p>
            <Tabs defaultValue="da">
              <TabsList>
                <TabsTrigger value="da">Dansk</TabsTrigger>
                <TabsTrigger value="en">English</TabsTrigger>
                <TabsTrigger value="de">Deutsch</TabsTrigger>
              </TabsList>
              <TabsContent value="da" className="mt-4">
                <Textarea value={settings.facilities_da} onChange={e => setSettings({...settings, facilities_da: e.target.value})} placeholder="Gynger,Rutsjebane,Klatrestativ" />
              </TabsContent>
              <TabsContent value="en" className="mt-4">
                <Textarea value={settings.facilities_en} onChange={e => setSettings({...settings, facilities_en: e.target.value})} placeholder="Swings,Slide,Climbing frame" />
              </TabsContent>
              <TabsContent value="de" className="mt-4">
                <Textarea value={settings.facilities_de} onChange={e => setSettings({...settings, facilities_de: e.target.value})} placeholder="Schaukeln,Rutsche,Klettergerüst" />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Placering */}
        <Card>
          <CardHeader>
            <CardTitle>📍 Placering</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="da">
              <TabsList>
                <TabsTrigger value="da">Dansk</TabsTrigger>
                <TabsTrigger value="en">English</TabsTrigger>
                <TabsTrigger value="de">Deutsch</TabsTrigger>
              </TabsList>
              <TabsContent value="da" className="mt-4">
                <Textarea value={settings.location_text_da} onChange={e => setSettings({...settings, location_text_da: e.target.value})} rows={2} />
              </TabsContent>
              <TabsContent value="en" className="mt-4">
                <Textarea value={settings.location_text_en} onChange={e => setSettings({...settings, location_text_en: e.target.value})} rows={2} />
              </TabsContent>
              <TabsContent value="de" className="mt-4">
                <Textarea value={settings.location_text_de} onChange={e => setSettings({...settings, location_text_de: e.target.value})} rows={2} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default AdminPlayground;
