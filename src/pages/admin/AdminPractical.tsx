import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, Save, Plus, Trash2, Pencil, Check, X, Wifi, Phone, MapPin,
  Train, Settings, Upload, GripVertical
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Interfaces
interface PracticalInfo {
  id: string;
  wifi_network: string;
  wifi_password: string | null;
  wifi_open: boolean;
  header_image: string | null;
  checkout_time: string;
  address_name: string;
  address_street: string;
  address_city: string;
}

interface EmergencyContact {
  id?: string;
  name: string;
  name_en?: string;
  name_de?: string;
  phone: string;
  is_urgent: boolean;
  sort_order: number;
  is_active: boolean;
}

interface NearbyService {
  id?: string;
  name: string;
  name_en?: string;
  name_de?: string;
  icon: string;
  distance: string;
  hours: string;
  sort_order: number;
  is_active: boolean;
}

interface Transport {
  id?: string;
  name: string;
  name_en?: string;
  name_de?: string;
  distance: string;
  sort_order: number;
  is_active: boolean;
}

interface Facility {
  id?: string;
  name: string;
  name_en?: string;
  name_de?: string;
  icon: string;
  info: string;
  info_en?: string;
  info_de?: string;
  sort_order: number;
  is_active: boolean;
}

const ICON_OPTIONS = [
  'Pill', 'ShoppingBag', 'Hospital', 'Landmark', 'TreePine', 'Bike', 
  'Droplets', 'Trash2', 'Car', 'Dog', 'Baby', 'MapPin', 'Phone', 'Wifi'
];

const AdminPractical = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Data states
  const [info, setInfo] = useState<PracticalInfo | null>(null);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [services, setServices] = useState<NearbyService[]>([]);
  const [transport, setTransport] = useState<Transport[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  
  // Editing states
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);
  const [editingService, setEditingService] = useState<NearbyService | null>(null);
  const [editingTransport, setEditingTransport] = useState<Transport | null>(null);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [infoRes, contactsRes, servicesRes, transportRes, facilitiesRes] = await Promise.all([
        supabase.from('practical_info').select('*').single(),
        supabase.from('practical_emergency_contacts').select('*').order('sort_order'),
        supabase.from('practical_nearby_services').select('*').order('sort_order'),
        supabase.from('practical_transport').select('*').order('sort_order'),
        supabase.from('practical_facilities').select('*').order('sort_order'),
      ]);
      
      if (infoRes.data) setInfo(infoRes.data);
      if (contactsRes.data) setContacts(contactsRes.data);
      if (servicesRes.data) setServices(servicesRes.data);
      if (transportRes.data) setTransport(transportRes.data);
      if (facilitiesRes.data) setFacilities(facilitiesRes.data);
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Kunne ikke hente data');
    } finally {
      setLoading(false);
    }
  };

  // Image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !info) return;
    
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `practical-header-${Date.now()}.${fileExt}`;
      const filePath = `practical/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);
      
      setInfo({ ...info, header_image: urlData.publicUrl });
      toast.success('Billede uploadet!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Kunne ikke uploade billede');
    } finally {
      setUploading(false);
    }
  };

  // Save general info
  const saveInfo = async () => {
    if (!info) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('practical_info')
        .update({
          wifi_network: info.wifi_network,
          wifi_password: info.wifi_password,
          wifi_open: info.wifi_open,
          header_image: info.header_image,
          checkout_time: info.checkout_time,
          address_name: info.address_name,
          address_street: info.address_street,
          address_city: info.address_city,
          updated_at: new Date().toISOString()
        })
        .eq('id', info.id);
      
      if (error) throw error;
      toast.success('Gemt!');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Kunne ikke gemme');
    } finally {
      setSaving(false);
    }
  };

  // Generic save/delete functions
  const saveItem = async (table: string, item: any, setEditing: (v: any) => void) => {
    try {
      if (item.id) {
        const { error } = await supabase.from(table).update(item).eq('id', item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(table).insert(item);
        if (error) throw error;
      }
      toast.success('Gemt!');
      setEditing(null);
      fetchAll();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Kunne ikke gemme');
    }
  };

  const deleteItem = async (table: string, id: string) => {
    if (!confirm('Slet dette element?')) return;
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      toast.success('Slettet!');
      fetchAll();
    } catch (error) {
      toast.error('Kunne ikke slette');
    }
  };

  if (loading) {
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
            <h1 className="text-xl font-bold">Praktisk Information</h1>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-6">
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="general"><Settings className="h-4 w-4 mr-1" />Generelt</TabsTrigger>
            <TabsTrigger value="contacts"><Phone className="h-4 w-4 mr-1" />Kontakter</TabsTrigger>
            <TabsTrigger value="nearby"><MapPin className="h-4 w-4 mr-1" />Nærheden</TabsTrigger>
            <TabsTrigger value="transport"><Train className="h-4 w-4 mr-1" />Transport</TabsTrigger>
            <TabsTrigger value="facilities">Faciliteter</TabsTrigger>
          </TabsList>

          {/* GENERELT TAB */}
          <TabsContent value="general" className="space-y-4">
            {info && (
              <>
                {/* Header billede */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Header Billede</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {info.header_image && (
                      <img src={info.header_image} alt="Header" className="w-full h-48 object-cover rounded-lg" />
                    )}
                    <div className="flex gap-2">
                      <Button variant="outline" disabled={uploading} onClick={() => document.getElementById('header-upload')?.click()}>
                        <Upload className="h-4 w-4 mr-2" />
                        {uploading ? 'Uploader...' : 'Upload billede'}
                      </Button>
                      <input id="header-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                      <Input 
                        placeholder="Eller indsæt URL" 
                        value={info.header_image || ''} 
                        onChange={e => setInfo({...info, header_image: e.target.value})}
                        className="flex-1"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* WiFi */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Wifi className="h-5 w-5" />
                      WiFi Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Switch 
                        checked={info.wifi_open} 
                        onCheckedChange={v => setInfo({...info, wifi_open: v})}
                      />
                      <Label>{info.wifi_open ? 'Åbent netværk (ingen kode)' : 'Kræver kode'}</Label>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Netværksnavn</Label>
                        <Input 
                          value={info.wifi_network} 
                          onChange={e => setInfo({...info, wifi_network: e.target.value})}
                        />
                      </div>
                      {!info.wifi_open && (
                        <div>
                          <Label>Kodeord</Label>
                          <Input 
                            value={info.wifi_password || ''} 
                            onChange={e => setInfo({...info, wifi_password: e.target.value})}
                          />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Check-out & Adresse */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Check-out & Adresse</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Check-out tid</Label>
                      <Input 
                        value={info.checkout_time} 
                        onChange={e => setInfo({...info, checkout_time: e.target.value})}
                        placeholder="11:00"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Navn</Label>
                        <Input value={info.address_name} onChange={e => setInfo({...info, address_name: e.target.value})} />
                      </div>
                      <div>
                        <Label>Adresse</Label>
                        <Input value={info.address_street} onChange={e => setInfo({...info, address_street: e.target.value})} />
                      </div>
                      <div>
                        <Label>By</Label>
                        <Input value={info.address_city} onChange={e => setInfo({...info, address_city: e.target.value})} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Button onClick={saveInfo} disabled={saving} className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Gemmer...' : 'Gem ændringer'}
                </Button>
              </>
            )}
          </TabsContent>

          {/* KONTAKTER TAB */}
          <TabsContent value="contacts" className="space-y-4">
            <Button onClick={() => setEditingContact({ name: '', phone: '', is_urgent: false, sort_order: contacts.length + 1, is_active: true })}>
              <Plus className="h-4 w-4 mr-2" />Tilføj kontakt
            </Button>

            {editingContact && (
              <Card className="border-primary">
                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Navn (DK)</Label>
                      <Input value={editingContact.name} onChange={e => setEditingContact({...editingContact, name: e.target.value})} />
                    </div>
                    <div>
                      <Label>Telefon</Label>
                      <Input value={editingContact.phone} onChange={e => setEditingContact({...editingContact, phone: e.target.value})} />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch checked={editingContact.is_urgent} onCheckedChange={v => setEditingContact({...editingContact, is_urgent: v})} />
                      <Label>Nødkontakt (rød markering)</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={editingContact.is_active} onCheckedChange={v => setEditingContact({...editingContact, is_active: v})} />
                      <Label>Aktiv</Label>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => saveItem('practical_emergency_contacts', editingContact, setEditingContact)}>
                      <Check className="h-4 w-4 mr-1" />Gem
                    </Button>
                    <Button variant="outline" onClick={() => setEditingContact(null)}>
                      <X className="h-4 w-4 mr-1" />Annuller
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {contacts.map(contact => (
              <Card key={contact.id} className={!contact.is_active ? 'opacity-50' : ''}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className={`font-medium ${contact.is_urgent ? 'text-red-600' : ''}`}>{contact.name}</p>
                      <p className={`text-sm ${contact.is_urgent ? 'text-red-500' : 'text-muted-foreground'}`}>{contact.phone}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditingContact(contact)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteItem('practical_emergency_contacts', contact.id!)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* NÆRHEDEN TAB */}
          <TabsContent value="nearby" className="space-y-4">
            <Button onClick={() => setEditingService({ name: '', icon: 'MapPin', distance: '', hours: '', sort_order: services.length + 1, is_active: true })}>
              <Plus className="h-4 w-4 mr-2" />Tilføj service
            </Button>

            {editingService && (
              <Card className="border-primary">
                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Navn</Label>
                      <Input value={editingService.name} onChange={e => setEditingService({...editingService, name: e.target.value})} />
                    </div>
                    <div>
                      <Label>Ikon</Label>
                      <select 
                        className="w-full border rounded-md p-2"
                        value={editingService.icon}
                        onChange={e => setEditingService({...editingService, icon: e.target.value})}
                      >
                        {ICON_OPTIONS.map(icon => <option key={icon} value={icon}>{icon}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label>Afstand</Label>
                      <Input value={editingService.distance} onChange={e => setEditingService({...editingService, distance: e.target.value})} placeholder="1.5 km" />
                    </div>
                    <div>
                      <Label>Åbningstider</Label>
                      <Input value={editingService.hours} onChange={e => setEditingService({...editingService, hours: e.target.value})} placeholder="09:00-17:30" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={editingService.is_active} onCheckedChange={v => setEditingService({...editingService, is_active: v})} />
                    <Label>Aktiv</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => saveItem('practical_nearby_services', editingService, setEditingService)}>
                      <Check className="h-4 w-4 mr-1" />Gem
                    </Button>
                    <Button variant="outline" onClick={() => setEditingService(null)}>
                      <X className="h-4 w-4 mr-1" />Annuller
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {services.map(service => (
              <Card key={service.id} className={!service.is_active ? 'opacity-50' : ''}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-xs">{service.icon}</div>
                    <div>
                      <p className="font-medium">{service.name}</p>
                      <p className="text-sm text-muted-foreground">{service.hours} • {service.distance}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditingService(service)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteItem('practical_nearby_services', service.id!)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* TRANSPORT TAB */}
          <TabsContent value="transport" className="space-y-4">
            <Button onClick={() => setEditingTransport({ name: '', distance: '', sort_order: transport.length + 1, is_active: true })}>
              <Plus className="h-4 w-4 mr-2" />Tilføj destination
            </Button>

            {editingTransport && (
              <Card className="border-primary">
                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Navn</Label>
                      <Input value={editingTransport.name} onChange={e => setEditingTransport({...editingTransport, name: e.target.value})} />
                    </div>
                    <div>
                      <Label>Afstand</Label>
                      <Input value={editingTransport.distance} onChange={e => setEditingTransport({...editingTransport, distance: e.target.value})} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={editingTransport.is_active} onCheckedChange={v => setEditingTransport({...editingTransport, is_active: v})} />
                    <Label>Aktiv</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => saveItem('practical_transport', editingTransport, setEditingTransport)}><Check className="h-4 w-4 mr-1" />Gem</Button>
                    <Button variant="outline" onClick={() => setEditingTransport(null)}><X className="h-4 w-4 mr-1" />Annuller</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {transport.map(item => (
              <Card key={item.id} className={!item.is_active ? 'opacity-50' : ''}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{item.name}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground">{item.distance}</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditingTransport(item)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteItem('practical_transport', item.id!)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* FACILITETER TAB */}
          <TabsContent value="facilities" className="space-y-4">
            <Button onClick={() => setEditingFacility({ name: '', icon: 'Info', info: '', sort_order: facilities.length + 1, is_active: true })}>
              <Plus className="h-4 w-4 mr-2" />Tilføj facilitet
            </Button>

            {editingFacility && (
              <Card className="border-primary">
                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Navn</Label>
                      <Input value={editingFacility.name} onChange={e => setEditingFacility({...editingFacility, name: e.target.value})} />
                    </div>
                    <div>
                      <Label>Ikon</Label>
                      <select className="w-full border rounded-md p-2" value={editingFacility.icon} onChange={e => setEditingFacility({...editingFacility, icon: e.target.value})}>
                        {ICON_OPTIONS.map(icon => <option key={icon} value={icon}>{icon}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label>Info</Label>
                      <Input value={editingFacility.info} onChange={e => setEditingFacility({...editingFacility, info: e.target.value})} placeholder="Åbent 24 timer" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={editingFacility.is_active} onCheckedChange={v => setEditingFacility({...editingFacility, is_active: v})} />
                    <Label>Aktiv</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => saveItem('practical_facilities', editingFacility, setEditingFacility)}><Check className="h-4 w-4 mr-1" />Gem</Button>
                    <Button variant="outline" onClick={() => setEditingFacility(null)}><X className="h-4 w-4 mr-1" />Annuller</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {facilities.map(fac => (
              <Card key={fac.id} className={!fac.is_active ? 'opacity-50' : ''}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-xs">{fac.icon}</div>
                    <div>
                      <p className="font-medium">{fac.name}</p>
                      <p className="text-sm text-muted-foreground">{fac.info}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditingFacility(fac)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteItem('practical_facilities', fac.id!)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminPractical;
