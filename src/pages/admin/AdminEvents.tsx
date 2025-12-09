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
import { Plus, Pencil, Trash2, CalendarDays, Clock, MapPin, Loader2, X, Check, Upload, Image, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

interface CampEvent {
  id: string;
  title: string;
  title_en?: string;
  title_de?: string;
  description: string;
  description_en?: string;
  description_de?: string;
  event_date: string;
  event_time: string;
  end_time?: string;
  location: string;
  target_group: 'families' | 'adults' | 'children' | 'all';
  registration_place: 'reception' | 'cafe' | 'none';
  max_participants?: number;
  is_active: boolean;
  image_url?: string;
}

const emptyEvent: Omit<CampEvent, 'id'> = {
  title: '',
  title_en: '',
  title_de: '',
  description: '',
  description_en: '',
  description_de: '',
  event_date: '',
  event_time: '',
  end_time: '',
  location: '',
  target_group: 'all',
  registration_place: 'none',
  max_participants: undefined,
  is_active: true,
  image_url: '',
};

const AdminEvents = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<CampEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Partial<CampEvent> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('camp_events')
        .select('*')
        .order('event_date', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (err) {
      console.error('Fejl ved hentning af events:', err);
      toast.error('Kunne ikke hente events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleSave = async () => {
    if (!editingEvent) return;
    
    // Validering af påkrævede felter
    if (!editingEvent.title?.trim()) {
      toast.error('Titel er påkrævet');
      return;
    }
    if (!editingEvent.description?.trim()) {
      toast.error('Beskrivelse er påkrævet');
      return;
    }
    if (!editingEvent.event_date) {
      toast.error('Dato er påkrævet');
      return;
    }
    if (!editingEvent.event_time) {
      toast.error('Starttid er påkrævet');
      return;
    }
    if (!editingEvent.location?.trim()) {
      toast.error('Lokation er påkrævet');
      return;
    }
    
    // Forbered data - fjern tomme strenge for nullable felter
    const dataToSave = {
      title: editingEvent.title,
      title_en: editingEvent.title_en || null,
      title_de: editingEvent.title_de || null,
      description: editingEvent.description,
      description_en: editingEvent.description_en || null,
      description_de: editingEvent.description_de || null,
      event_date: editingEvent.event_date,
      event_time: editingEvent.event_time,
      end_time: editingEvent.end_time || null,
      location: editingEvent.location,
      target_group: editingEvent.target_group || 'all',
      registration_place: editingEvent.registration_place || 'none',
      max_participants: editingEvent.max_participants || null,
      is_active: editingEvent.is_active ?? true,
      image_url: editingEvent.image_url || null,
    };
    
    setSaving(true);
    try {
      if (isCreating) {
        const { error } = await supabase
          .from('camp_events')
          .insert([dataToSave]);
        if (error) throw error;
        toast.success('Event oprettet');
      } else {
        const { error } = await supabase
          .from('camp_events')
          .update(dataToSave)
          .eq('id', editingEvent.id);
        if (error) throw error;
        toast.success('Event opdateret');
      }
      
      await fetchEvents();
      setEditingEvent(null);
      setIsCreating(false);
    } catch (err) {
      console.error('Fejl ved gemning:', err);
      toast.error('Kunne ikke gemme event');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Er du sikker på at du vil slette dette event?')) return;
    
    try {
      const { error } = await supabase
        .from('camp_events')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Event slettet');
      await fetchEvents();
    } catch (err) {
      console.error('Fejl ved sletning:', err);
      toast.error('Kunne ikke slette event');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `event-${Date.now()}.${fileExt}`;
      const filePath = `events/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      setEditingEvent(prev => prev ? { ...prev, image_url: publicUrl } : null);
      toast.success('Billede uploadet');
    } catch (err) {
      console.error('Upload fejl:', err);
      toast.error('Kunne ikke uploade billede');
    } finally {
      setUploading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('da-DK', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const targetGroupLabels: Record<string, string> = {
    families: 'Familier',
    adults: 'Voksne',
    children: 'Børn',
    all: 'Alle',
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
            <h1 className="text-2xl font-bold text-gray-800">Events på pladsen</h1>
          </div>
          <Button onClick={() => { setEditingEvent({ ...emptyEvent }); setIsCreating(true); }} className="gap-2">
            <Plus className="h-4 w-4" />
            Nyt event
          </Button>
        </div>

        {/* Opret/Rediger formular */}
        {editingEvent && (
          <Card className="border-teal-200 bg-teal-50">
            <CardHeader>
              <CardTitle className="text-lg">
                {isCreating ? 'Opret nyt event' : 'Rediger event'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Titler */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Titel (dansk) *</Label>
                  <Input
                    value={editingEvent.title || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                    placeholder="F.eks. Pandekage Aften"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Titel (engelsk)</Label>
                  <Input
                    value={editingEvent.title_en || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, title_en: e.target.value })}
                    placeholder="Pancake Evening"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Titel (tysk)</Label>
                  <Input
                    value={editingEvent.title_de || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, title_de: e.target.value })}
                    placeholder="Pfannkuchen Abend"
                  />
                </div>
              </div>

              {/* Beskrivelser */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Beskrivelse (dansk) *</Label>
                  <Textarea
                    value={editingEvent.description || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
                    placeholder="Beskriv eventet..."
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Beskrivelse (engelsk)</Label>
                  <Textarea
                    value={editingEvent.description_en || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, description_en: e.target.value })}
                    placeholder="Describe the event..."
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Beskrivelse (tysk)</Label>
                  <Textarea
                    value={editingEvent.description_de || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, description_de: e.target.value })}
                    placeholder="Beschreiben Sie das Event..."
                    rows={2}
                  />
                </div>
              </div>

              {/* Dato og tid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Dato *</Label>
                  <Input
                    type="date"
                    value={editingEvent.event_date || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, event_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Starttid *</Label>
                  <Input
                    type="time"
                    value={editingEvent.event_time || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, event_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sluttid</Label>
                  <Input
                    type="time"
                    value={editingEvent.end_time || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, end_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max deltagere</Label>
                  <Input
                    type="number"
                    value={editingEvent.max_participants || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, max_participants: parseInt(e.target.value) || undefined })}
                    placeholder="Ingen grænse"
                  />
                </div>
              </div>

              {/* Lokation og målgruppe */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Lokation *</Label>
                  <Input
                    value={editingEvent.location || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, location: e.target.value })}
                    placeholder="F.eks. Caféen"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Målgruppe</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3"
                    value={editingEvent.target_group || 'all'}
                    onChange={(e) => setEditingEvent({ ...editingEvent, target_group: e.target.value as CampEvent['target_group'] })}
                  >
                    <option value="all">Alle</option>
                    <option value="families">Familier</option>
                    <option value="adults">Voksne</option>
                    <option value="children">Børn</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Tilmelding</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3"
                    value={editingEvent.registration_place || 'none'}
                    onChange={(e) => setEditingEvent({ ...editingEvent, registration_place: e.target.value as CampEvent['registration_place'] })}
                  >
                    <option value="none">Ingen tilmelding</option>
                    <option value="reception">I receptionen</option>
                    <option value="cafe">I caféen</option>
                  </select>
                </div>
                <div className="flex items-end pb-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={editingEvent.is_active ?? true}
                      onCheckedChange={(checked) => setEditingEvent({ ...editingEvent, is_active: checked })}
                    />
                    <Label>Aktiv</Label>
                  </div>
                </div>
              </div>

              {/* Billede */}
              <div className="space-y-2">
                <Label>Billede</Label>
                <div className="flex items-start gap-4">
                  {editingEvent.image_url ? (
                    <div className="relative">
                      <img 
                        src={editingEvent.image_url} 
                        alt="Event billede" 
                        className="w-32 h-20 object-cover rounded border"
                      />
                      <button
                        type="button"
                        onClick={() => setEditingEvent({ ...editingEvent, image_url: '' })}
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
                    <label className="cursor-pointer inline-block">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <div className="flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-gray-50">
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        <span className="text-sm">Upload billede</span>
                      </div>
                    </label>
                    <div className="text-xs text-gray-500">eller indsæt URL:</div>
                    <Input
                      placeholder="https://example.com/billede.jpg"
                      value={editingEvent.image_url || ''}
                      onChange={(e) => setEditingEvent({ ...editingEvent, image_url: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Knapper */}
              <div className="flex gap-2 pt-4">
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {isCreating ? 'Opret' : 'Gem'}
                </Button>
                <Button variant="outline" onClick={() => { setEditingEvent(null); setIsCreating(false); }} className="gap-2">
                  <X className="h-4 w-4" />
                  Annuller
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Events liste */}
        <div className="space-y-3">
          {events.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Ingen events oprettet endnu. Klik "Nyt event" for at oprette det første.
              </CardContent>
            </Card>
          ) : (
            events.map((event) => (
              <Card key={event.id} className={!event.is_active ? 'opacity-50' : ''}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start gap-4">
                    {/* Billede thumbnail */}
                    {event.image_url ? (
                      <img 
                        src={event.image_url} 
                        alt={event.title}
                        className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Image className="h-8 w-8 text-gray-300" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{event.title}</h3>
                        <Badge variant="outline" className="text-xs">
                          {targetGroupLabels[event.target_group]}
                        </Badge>
                        {!event.is_active && (
                          <Badge variant="secondary" className="text-xs">Inaktiv</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{event.description}</p>
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-4 w-4" />
                          {formatDate(event.event_date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {event.event_time?.slice(0, 5)}
                          {event.end_time && ` - ${event.end_time.slice(0, 5)}`}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {event.location}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button variant="ghost" size="icon" onClick={() => { setEditingEvent({ ...event }); setIsCreating(false); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(event.id)}>
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

export default AdminEvents;
