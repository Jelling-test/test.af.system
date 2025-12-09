import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, Pencil, Trash2, Loader2, X, Check,
  Star, MapPin, ExternalLink, Image, Upload, ArrowUp, ArrowDown, ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';

interface Attraction {
  id: string;
  name: string;
  name_en?: string;
  name_de?: string;
  description: string;
  description_en?: string;
  description_de?: string;
  distance_km: number;
  category: 'zoo' | 'museum' | 'nature' | 'adventure' | 'family' | 'other';
  main_url?: string;
  events_url?: string;
  image_url?: string;
  highlight: boolean;
  sort_order: number;
  is_active: boolean;
}

const emptyAttraction: Omit<Attraction, 'id'> = {
  name: '',
  name_en: '',
  name_de: '',
  description: '',
  description_en: '',
  description_de: '',
  distance_km: 10,
  category: 'family',
  main_url: '',
  events_url: '',
  image_url: '',
  highlight: false,
  sort_order: 0,
  is_active: true,
};

const categoryLabels: Record<string, string> = {
  zoo: '🦁 Zoo',
  museum: '🏛️ Museum',
  nature: '🌲 Natur',
  adventure: '🧗 Eventyr',
  family: '👨‍👩‍👧‍👦 Familie',
  other: '📍 Andet',
};

const AdminAttractions = () => {
  const navigate = useNavigate();
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingAttraction, setEditingAttraction] = useState<Partial<Attraction> | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const fetchAttractions = async () => {
    try {
      const { data, error } = await supabase
        .from('attractions')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setAttractions(data || []);
    } catch (err) {
      console.error('Fejl ved hentning:', err);
      toast.error('Kunne ikke hente attraktioner');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttractions();
  }, []);

  const handleSave = async () => {
    if (!editingAttraction) return;
    
    if (!editingAttraction.name?.trim()) {
      toast.error('Navn er påkrævet');
      return;
    }
    if (!editingAttraction.description?.trim()) {
      toast.error('Beskrivelse er påkrævet');
      return;
    }
    
    setSaving(true);
    try {
      const dataToSave = {
        name: editingAttraction.name,
        name_en: editingAttraction.name_en || null,
        name_de: editingAttraction.name_de || null,
        description: editingAttraction.description,
        description_en: editingAttraction.description_en || null,
        description_de: editingAttraction.description_de || null,
        distance_km: editingAttraction.distance_km || 10,
        category: editingAttraction.category || 'family',
        main_url: editingAttraction.main_url || null,
        events_url: editingAttraction.events_url || null,
        image_url: editingAttraction.image_url || null,
        highlight: editingAttraction.highlight ?? false,
        is_active: editingAttraction.is_active ?? true,
      };
      
      if (isCreating) {
        const maxOrder = attractions.reduce((max, a) => Math.max(max, a.sort_order), 0);
        const { error } = await supabase
          .from('attractions')
          .insert([{ ...dataToSave, sort_order: maxOrder + 1 }]);
        if (error) throw error;
        toast.success('Attraktion oprettet');
      } else {
        const { error } = await supabase
          .from('attractions')
          .update(dataToSave)
          .eq('id', editingAttraction.id);
        if (error) throw error;
        toast.success('Attraktion opdateret');
      }
      await fetchAttractions();
      setEditingAttraction(null);
      setIsCreating(false);
    } catch (err) {
      console.error('Fejl:', err);
      toast.error('Kunne ikke gemme');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Slet denne attraktion?')) return;
    try {
      const { error } = await supabase.from('attractions').delete().eq('id', id);
      if (error) throw error;
      toast.success('Attraktion slettet');
      await fetchAttractions();
    } catch (err) {
      toast.error('Kunne ikke slette');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `attraction-${Date.now()}.${fileExt}`;
      const filePath = `attractions/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      setEditingAttraction(prev => prev ? { ...prev, image_url: publicUrl } : null);
      toast.success('Billede uploadet');
    } catch (err) {
      console.error('Upload fejl:', err);
      toast.error('Kunne ikke uploade billede');
    } finally {
      setUploading(false);
    }
  };

  const moveAttraction = async (id: string, direction: 'up' | 'down') => {
    const index = attractions.findIndex(a => a.id === id);
    if (index === -1) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= attractions.length) return;

    const current = attractions[index];
    const target = attractions[newIndex];

    try {
      await supabase.from('attractions').update({ sort_order: target.sort_order }).eq('id', current.id);
      await supabase.from('attractions').update({ sort_order: current.sort_order }).eq('id', target.id);
      await fetchAttractions();
    } catch (err) {
      toast.error('Kunne ikke flytte');
    }
  };

  const toggleHighlight = async (attraction: Attraction) => {
    try {
      const { error } = await supabase
        .from('attractions')
        .update({ highlight: !attraction.highlight })
        .eq('id', attraction.id);
      if (error) throw error;
      toast.success(attraction.highlight ? 'Fremhævning fjernet' : 'Fremhævet');
      await fetchAttractions();
    } catch (err) {
      toast.error('Kunne ikke opdatere');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Attraktioner i nærheden</h1>
              <p className="text-sm text-muted-foreground">Turistattraktioner nær campingpladsen</p>
            </div>
          </div>
          <Button onClick={() => { setEditingAttraction({ ...emptyAttraction }); setIsCreating(true); }} className="gap-2">
            <Plus className="h-4 w-4" />
            Ny attraktion
          </Button>
        </div>

        {/* Opret/Rediger formular */}
        {editingAttraction && (
          <Card className="border-teal-200 bg-teal-50">
            <CardHeader>
              <CardTitle className="text-lg">
                {isCreating ? 'Opret ny attraktion' : 'Rediger attraktion'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Navn (dansk) *</Label>
                  <Input
                    value={editingAttraction.name || ''}
                    onChange={(e) => setEditingAttraction({ ...editingAttraction, name: e.target.value })}
                    placeholder="F.eks. LEGOLAND Billund"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Navn (engelsk)</Label>
                  <Input
                    value={editingAttraction.name_en || ''}
                    onChange={(e) => setEditingAttraction({ ...editingAttraction, name_en: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Beskrivelse (dansk) *</Label>
                <Textarea
                  value={editingAttraction.description || ''}
                  onChange={(e) => setEditingAttraction({ ...editingAttraction, description: e.target.value })}
                  rows={2}
                  placeholder="Kort beskrivelse af attraktionen"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Afstand (km) *</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={editingAttraction.distance_km || 0}
                    onChange={(e) => setEditingAttraction({ ...editingAttraction, distance_km: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Kategori *</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3"
                    value={editingAttraction.category || 'family'}
                    onChange={(e) => setEditingAttraction({ ...editingAttraction, category: e.target.value as Attraction['category'] })}
                  >
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-4 pt-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={editingAttraction.highlight}
                      onCheckedChange={(checked) => setEditingAttraction({ ...editingAttraction, highlight: checked })}
                    />
                    <Label>⭐ Fremhæv</Label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hjemmeside URL</Label>
                  <Input
                    value={editingAttraction.main_url || ''}
                    onChange={(e) => setEditingAttraction({ ...editingAttraction, main_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Events URL (til "Se events")</Label>
                  <Input
                    value={editingAttraction.events_url || ''}
                    onChange={(e) => setEditingAttraction({ ...editingAttraction, events_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>

              {/* Billede */}
              <div className="space-y-2">
                <Label>Billede</Label>
                <div className="flex items-start gap-4">
                  {editingAttraction.image_url ? (
                    <div className="relative">
                      <img 
                        src={editingAttraction.image_url} 
                        alt="Attraktion billede" 
                        className="w-32 h-20 object-cover rounded border"
                      />
                      <button
                        type="button"
                        onClick={() => setEditingAttraction({ ...editingAttraction, image_url: '' })}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-32 h-20 border-2 border-dashed rounded flex items-center justify-center text-gray-400">
                      <Image className="h-8 w-8" />
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <label className="cursor-pointer">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <div className="flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-gray-50 w-fit">
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        <span className="text-sm">Upload billede</span>
                      </div>
                    </label>
                    <Input
                      placeholder="eller indsæt URL"
                      value={editingAttraction.image_url || ''}
                      onChange={(e) => setEditingAttraction({ ...editingAttraction, image_url: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {isCreating ? 'Opret' : 'Gem'}
                </Button>
                <Button variant="outline" onClick={() => { setEditingAttraction(null); setIsCreating(false); }}>
                  <X className="h-4 w-4 mr-1" />
                  Annuller
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Attraktioner liste */}
        <div className="space-y-2">
          {attractions.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Ingen attraktioner oprettet endnu. Klik "Ny attraktion" for at tilføje.
              </CardContent>
            </Card>
          ) : (
            attractions.map((attraction, index) => (
              <Card key={attraction.id} className={`${!attraction.is_active ? 'opacity-50' : ''} ${attraction.highlight ? 'border-yellow-400 border-2' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Sortering */}
                    <div className="flex flex-col gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={() => moveAttraction(attraction.id, 'up')}
                        disabled={index === 0}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={() => moveAttraction(attraction.id, 'down')}
                        disabled={index === attractions.length - 1}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Billede */}
                    {attraction.image_url ? (
                      <img 
                        src={attraction.image_url} 
                        alt={attraction.name}
                        className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <MapPin className="h-6 w-6 text-gray-300" />
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {attraction.highlight && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                        <h3 className="font-semibold">{attraction.name}</h3>
                        <Badge variant="secondary" className="text-xs">
                          {attraction.distance_km} km
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {categoryLabels[attraction.category]}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">{attraction.description}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => toggleHighlight(attraction)}
                        title={attraction.highlight ? 'Fjern fremhævning' : 'Fremhæv'}
                      >
                        <Star className={`h-4 w-4 ${attraction.highlight ? 'text-yellow-500 fill-yellow-500' : ''}`} />
                      </Button>
                      {attraction.main_url && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => window.open(attraction.main_url, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => { setEditingAttraction({ ...attraction }); setIsCreating(false); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(attraction.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAttractions;
