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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, Pencil, Trash2, CalendarDays, Clock, MapPin, Loader2, X, Check, 
  Rss, Globe, FileText, RefreshCw, Eye, EyeOff, ExternalLink, Image, ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';

interface FeedSource {
  id: string;
  name: string;
  description?: string;
  feed_type: 'rss' | 'json_api' | 'manual';
  feed_url?: string;
  max_distance_km: number;
  auto_import: boolean;
  import_interval_hours: number;
  last_import_at?: string;
  last_import_status?: string;
  last_import_count?: number;
  is_active: boolean;
}

interface ExternalEvent {
  id: string;
  attraction_name: string;
  title: string;
  title_en?: string;
  title_de?: string;
  description?: string;
  event_date: string;
  event_time?: string;
  end_date?: string;
  location: string;
  distance_km: number;
  category?: string;
  event_url?: string;
  attraction_url?: string;
  image_url?: string;
  is_active: boolean;
  source_id?: string;
}

const emptyEvent: Omit<ExternalEvent, 'id'> = {
  attraction_name: '',
  title: '',
  title_en: '',
  title_de: '',
  description: '',
  event_date: '',
  event_time: '',
  location: '',
  distance_km: 10,
  category: 'event',
  event_url: '',
  attraction_url: '',
  image_url: '',
  is_active: true,
};

const emptySource: Omit<FeedSource, 'id'> = {
  name: '',
  description: '',
  feed_type: 'manual',
  feed_url: '',
  max_distance_km: 50,
  auto_import: false,
  import_interval_hours: 24,
  is_active: true,
};

const AdminExternalEvents = () => {
  const navigate = useNavigate();
  const [sources, setSources] = useState<FeedSource[]>([]);
  const [events, setEvents] = useState<ExternalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingSource, setEditingSource] = useState<Partial<FeedSource> | null>(null);
  const [editingEvent, setEditingEvent] = useState<Partial<ExternalEvent> | null>(null);
  const [isCreatingSource, setIsCreatingSource] = useState(false);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [activeTab, setActiveTab] = useState('events');

  const fetchData = async () => {
    try {
      const [sourcesRes, eventsRes] = await Promise.all([
        supabase.from('event_feed_sources').select('*').order('name'),
        supabase.from('external_events').select('*').order('event_date', { ascending: true })
      ]);

      if (sourcesRes.error) throw sourcesRes.error;
      if (eventsRes.error) throw eventsRes.error;

      setSources(sourcesRes.data || []);
      setEvents(eventsRes.data || []);
    } catch (err) {
      console.error('Fejl ved hentning:', err);
      toast.error('Kunne ikke hente data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Source handlers
  const handleSaveSource = async () => {
    if (!editingSource) return;
    setSaving(true);
    try {
      if (isCreatingSource) {
        const { error } = await supabase.from('event_feed_sources').insert([editingSource]);
        if (error) throw error;
        toast.success('Kilde oprettet');
      } else {
        const { id, ...updateData } = editingSource;
        const { error } = await supabase.from('event_feed_sources').update(updateData).eq('id', id);
        if (error) throw error;
        toast.success('Kilde opdateret');
      }
      await fetchData();
      setEditingSource(null);
      setIsCreatingSource(false);
    } catch (err) {
      console.error('Fejl:', err);
      toast.error('Kunne ikke gemme');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSource = async (id: string) => {
    if (!confirm('Slet denne kilde?')) return;
    try {
      const { error } = await supabase.from('event_feed_sources').delete().eq('id', id);
      if (error) throw error;
      toast.success('Kilde slettet');
      await fetchData();
    } catch (err) {
      toast.error('Kunne ikke slette');
    }
  };

  // Event handlers
  const handleSaveEvent = async () => {
    if (!editingEvent) return;
    setSaving(true);
    try {
      if (isCreatingEvent) {
        const { error } = await supabase.from('external_events').insert([editingEvent]);
        if (error) throw error;
        toast.success('Event oprettet');
      } else {
        const { id, ...updateData } = editingEvent;
        const { error } = await supabase.from('external_events').update(updateData).eq('id', id);
        if (error) throw error;
        toast.success('Event opdateret');
      }
      await fetchData();
      setEditingEvent(null);
      setIsCreatingEvent(false);
    } catch (err) {
      console.error('Fejl:', err);
      toast.error('Kunne ikke gemme');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Slet dette event?')) return;
    try {
      const { error } = await supabase.from('external_events').delete().eq('id', id);
      if (error) throw error;
      toast.success('Event slettet');
      await fetchData();
    } catch (err) {
      toast.error('Kunne ikke slette');
    }
  };

  const toggleEventActive = async (event: ExternalEvent) => {
    try {
      const { error } = await supabase
        .from('external_events')
        .update({ is_active: !event.is_active })
        .eq('id', event.id);
      if (error) throw error;
      toast.success(event.is_active ? 'Event skjult' : 'Event vist');
      await fetchData();
    } catch (err) {
      toast.error('Kunne ikke opdatere');
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

  const getFeedTypeIcon = (type: string) => {
    switch (type) {
      case 'rss': return <Rss className="h-4 w-4" />;
      case 'json_api': return <Globe className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
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
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold text-gray-800">Events i nærheden</h1>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="events">Events ({events.length})</TabsTrigger>
            <TabsTrigger value="sources">Kilder ({sources.length})</TabsTrigger>
          </TabsList>

          {/* EVENTS TAB */}
          <TabsContent value="events" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => { setEditingEvent({ ...emptyEvent }); setIsCreatingEvent(true); }} className="gap-2">
                <Plus className="h-4 w-4" />
                Nyt eksternt event
              </Button>
            </div>

            {/* Event formular */}
            {editingEvent && (
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-lg">
                    {isCreatingEvent ? 'Opret eksternt event' : 'Rediger event'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Attraktion/Sted *</Label>
                      <Input
                        value={editingEvent.attraction_name || ''}
                        onChange={(e) => setEditingEvent({ ...editingEvent, attraction_name: e.target.value })}
                        placeholder="F.eks. LEGOLAND"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Event titel *</Label>
                      <Input
                        value={editingEvent.title || ''}
                        onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                        placeholder="F.eks. Halloween Fest"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Beskrivelse</Label>
                    <Textarea
                      value={editingEvent.description || ''}
                      onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>Dato *</Label>
                      <Input
                        type="date"
                        value={editingEvent.event_date || ''}
                        onChange={(e) => setEditingEvent({ ...editingEvent, event_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tidspunkt</Label>
                      <Input
                        type="time"
                        value={editingEvent.event_time || ''}
                        onChange={(e) => setEditingEvent({ ...editingEvent, event_time: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Lokation *</Label>
                      <Input
                        value={editingEvent.location || ''}
                        onChange={(e) => setEditingEvent({ ...editingEvent, location: e.target.value })}
                        placeholder="F.eks. Billund"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Afstand (km) *</Label>
                      <Input
                        type="number"
                        value={editingEvent.distance_km || 0}
                        onChange={(e) => setEditingEvent({ ...editingEvent, distance_km: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Event URL</Label>
                      <Input
                        value={editingEvent.event_url || ''}
                        onChange={(e) => setEditingEvent({ ...editingEvent, event_url: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Billede URL</Label>
                      <Input
                        value={editingEvent.image_url || ''}
                        onChange={(e) => setEditingEvent({ ...editingEvent, image_url: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Switch
                      checked={editingEvent.is_active ?? true}
                      onCheckedChange={(checked) => setEditingEvent({ ...editingEvent, is_active: checked })}
                    />
                    <Label>Aktiv (vises for gæster)</Label>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button onClick={handleSaveEvent} disabled={saving} className="gap-2">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      {isCreatingEvent ? 'Opret' : 'Gem'}
                    </Button>
                    <Button variant="outline" onClick={() => { setEditingEvent(null); setIsCreatingEvent(false); }}>
                      <X className="h-4 w-4 mr-1" />
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
                    Ingen eksterne events. Klik "Nyt eksternt event" for at oprette.
                  </CardContent>
                </Card>
              ) : (
                events.map((event) => (
                  <Card key={event.id} className={!event.is_active ? 'opacity-50' : ''}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start gap-4">
                        {/* Billede */}
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
                            <Badge variant="secondary" className="text-xs">
                              {event.distance_km} km
                            </Badge>
                            {!event.is_active && (
                              <Badge variant="outline" className="text-xs">Skjult</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-1">📍 {event.attraction_name}</p>
                          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-4 w-4" />
                              {formatDate(event.event_date)}
                            </span>
                            {event.event_time && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {event.event_time.slice(0, 5)}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {event.location}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => toggleEventActive(event)}
                            title={event.is_active ? 'Skjul' : 'Vis'}
                          >
                            {event.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </Button>
                          {event.event_url && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => window.open(event.event_url, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => { setEditingEvent({ ...event }); setIsCreatingEvent(false); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteEvent(event.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* SOURCES TAB */}
          <TabsContent value="sources" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => { setEditingSource({ ...emptySource }); setIsCreatingSource(true); }} className="gap-2">
                <Plus className="h-4 w-4" />
                Ny kilde
              </Button>
            </div>

            {/* Source formular */}
            {editingSource && (
              <Card className="border-purple-200 bg-purple-50">
                <CardHeader>
                  <CardTitle className="text-lg">
                    {isCreatingSource ? 'Opret ny kilde' : 'Rediger kilde'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Navn *</Label>
                      <Input
                        value={editingSource.name || ''}
                        onChange={(e) => setEditingSource({ ...editingSource, name: e.target.value })}
                        placeholder="F.eks. Kultunaut"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Type *</Label>
                      <select
                        className="w-full h-10 rounded-md border border-input bg-background px-3"
                        value={editingSource.feed_type || 'manual'}
                        onChange={(e) => setEditingSource({ ...editingSource, feed_type: e.target.value as FeedSource['feed_type'] })}
                      >
                        <option value="manual">Manuel</option>
                        <option value="rss">RSS Feed</option>
                        <option value="json_api">JSON API</option>
                      </select>
                    </div>
                  </div>

                  {editingSource.feed_type !== 'manual' && (
                    <div className="space-y-2">
                      <Label>Feed URL</Label>
                      <Input
                        value={editingSource.feed_url || ''}
                        onChange={(e) => setEditingSource({ ...editingSource, feed_url: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Beskrivelse</Label>
                    <Textarea
                      value={editingSource.description || ''}
                      onChange={(e) => setEditingSource({ ...editingSource, description: e.target.value })}
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Max afstand (km)</Label>
                      <Input
                        type="number"
                        value={editingSource.max_distance_km || 50}
                        onChange={(e) => setEditingSource({ ...editingSource, max_distance_km: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                      <Switch
                        checked={editingSource.is_active}
                        onCheckedChange={(checked) => setEditingSource({ ...editingSource, is_active: checked })}
                      />
                      <Label>Aktiv</Label>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button onClick={handleSaveSource} disabled={saving} className="gap-2">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      {isCreatingSource ? 'Opret' : 'Gem'}
                    </Button>
                    <Button variant="outline" onClick={() => { setEditingSource(null); setIsCreatingSource(false); }}>
                      <X className="h-4 w-4 mr-1" />
                      Annuller
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sources liste */}
            <div className="space-y-3">
              {sources.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    Ingen kilder oprettet. Klik "Ny kilde" for at oprette.
                  </CardContent>
                </Card>
              ) : (
                sources.map((source) => (
                  <Card key={source.id} className={!source.is_active ? 'opacity-50' : ''}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            {getFeedTypeIcon(source.feed_type)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold">{source.name}</h3>
                              <Badge variant={source.is_active ? 'default' : 'secondary'} className="text-xs">
                                {source.is_active ? 'Aktiv' : 'Inaktiv'}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {source.feed_type === 'rss' ? 'RSS' : source.feed_type === 'json_api' ? 'API' : 'Manuel'}
                              </Badge>
                            </div>
                            {source.description && (
                              <p className="text-sm text-muted-foreground mb-1">{source.description}</p>
                            )}
                            {source.feed_url && (
                              <p className="text-xs text-muted-foreground truncate max-w-md">{source.feed_url}</p>
                            )}
                            {source.last_import_at && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Sidst importeret: {new Date(source.last_import_at).toLocaleString('da-DK')} 
                                {source.last_import_count !== undefined && ` (${source.last_import_count} events)`}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {source.feed_type !== 'manual' && (
                            <Button variant="outline" size="sm" className="gap-1">
                              <RefreshCw className="h-3 w-3" />
                              Import
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => { setEditingSource({ ...source }); setIsCreatingSource(false); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteSource(source.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminExternalEvents;
