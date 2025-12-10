import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Upload, Image as ImageIcon, Zap, Croissant, CalendarDays, MapPin, Coffee, Info, Waves, TreePine, Home } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface DashboardSettings {
  power_image: string;
  bakery_image: string;
  events_image: string;
  attractions_image: string;
  cafe_image: string;
  practical_image: string;
  pool_image: string;
  playground_image: string;
  cabin_image: string;
}

const SECTIONS = [
  { key: 'power_image', label: 'Strøm', icon: Zap },
  { key: 'bakery_image', label: 'Bageri', icon: Croissant },
  { key: 'events_image', label: 'Events', icon: CalendarDays },
  { key: 'attractions_image', label: 'Attraktioner', icon: MapPin },
  { key: 'cafe_image', label: 'Café', icon: Coffee },
  { key: 'practical_image', label: 'Praktisk Info', icon: Info },
  { key: 'pool_image', label: 'Friluftsbad', icon: Waves },
  { key: 'playground_image', label: 'Legeplads', icon: TreePine },
  { key: 'cabin_image', label: 'Hytte', icon: Home },
];

const AdminDashboard = () => {
  const [settings, setSettings] = useState<DashboardSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('dashboard_settings')
        .select('*')
        .eq('id', 'default')
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

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('dashboard_settings')
        .update({
          ...settings,
          updated_at: new Date().toISOString()
        })
        .eq('id', 'default');
      
      if (error) throw error;
      toast.success('Indstillinger gemt!');
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Fejl ved gem');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (sectionKey: string, file: File) => {
    setUploading(sectionKey);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `dashboard/${sectionKey}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(fileName, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(fileName);
      
      setSettings(prev => prev ? { ...prev, [sectionKey]: publicUrl } : null);
      toast.success('Billede uploadet!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Fejl ved upload');
    } finally {
      setUploading(null);
    }
  };

  const handleUrlChange = (key: string, value: string) => {
    setSettings(prev => prev ? { ...prev, [key]: value } : null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Billeder</h1>
          <p className="text-gray-500 mt-1">Administrer billeder på gæsternes velkomstside</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Gem ændringer
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {SECTIONS.map(({ key, label, icon: Icon }) => (
          <Card key={key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Icon className="h-5 w-5" />
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Preview */}
              <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-100">
                {settings?.[key as keyof DashboardSettings] ? (
                  <img 
                    src={settings[key as keyof DashboardSettings]} 
                    alt={label}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <ImageIcon className="h-12 w-12" />
                  </div>
                )}
              </div>
              
              {/* URL input */}
              <div className="space-y-2">
                <Label htmlFor={key}>Billede URL</Label>
                <Input
                  id={key}
                  value={settings?.[key as keyof DashboardSettings] || ''}
                  onChange={(e) => handleUrlChange(key, e.target.value)}
                  placeholder="https://..."
                />
              </div>
              
              {/* Upload */}
              <div>
                <Label 
                  htmlFor={`upload-${key}`} 
                  className="cursor-pointer inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                >
                  {uploading === key ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Upload nyt billede
                </Label>
                <input
                  id={`upload-${key}`}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(key, file);
                  }}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;
