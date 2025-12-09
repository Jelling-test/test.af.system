import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Save, ArrowLeft, Coffee, Plus, Trash2, UtensilsCrossed, Wine, 
  Clock, Upload, Loader2, Pencil, X, Check, Phone
} from 'lucide-react';
import { toast } from 'sonner';

interface OpeningHours {
  [key: string]: { open: string; close: string; closed: boolean };
}

interface CafeSettings {
  id: string;
  opening_hours: OpeningHours;
  header_image?: string;
  reopening_date?: string;
  contact_phone?: string;
  contact_email?: string;
  contact_text?: string;
  contact_text_en?: string;
  contact_text_de?: string;
  party_boxes?: any[];
}

interface MenuItem {
  id?: string;
  category: 'food' | 'drinks';
  name: string;
  name_en?: string;
  name_de?: string;
  description?: string;
  description_en?: string;
  description_de?: string;
  price: number;
  image_url?: string;
  is_active: boolean;
  sort_order: number;
}

interface Offer {
  id?: string;
  name: string;
  name_en?: string;
  name_de?: string;
  description?: string;
  description_en?: string;
  description_de?: string;
  price: number;
  image_url?: string;
  visible_from?: string;
  visible_to?: string;
  execution_date?: string;
  order_deadline?: string;
  cancel_deadline?: string;
  is_active: boolean;
  sort_order: number;
}

interface CafeOrder {
  id: string;
  order_number: string;
  booking_id?: number;
  guest_name: string;
  guest_phone?: string;
  offer_name?: string;
  quantity: number;
  dining_option?: string;
  execution_date?: string;
  total: number;
  status: string;
  created_at: string;
}

const defaultOpeningHours: OpeningHours = {
  mon: { open: '08:00', close: '17:00', closed: false },
  tue: { open: '08:00', close: '17:00', closed: false },
  wed: { open: '08:00', close: '17:00', closed: false },
  thu: { open: '08:00', close: '17:00', closed: false },
  fri: { open: '08:00', close: '17:00', closed: false },
  sat: { open: '09:00', close: '16:00', closed: false },
  sun: { open: '09:00', close: '16:00', closed: false },
};

const dayNames: { [key: string]: string } = {
  mon: 'Mandag', tue: 'Tirsdag', wed: 'Onsdag', thu: 'Torsdag', 
  fri: 'Fredag', sat: 'Lørdag', sun: 'Søndag'
};

const AdminCafe = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<CafeSettings>({ id: 'default', opening_hours: defaultOpeningHours });
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [orders, setOrders] = useState<CafeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('hours');
  const [editingMenu, setEditingMenu] = useState<MenuItem | null>(null);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      // Fetch settings
      const { data: settingsData } = await supabase
        .from('cafe_settings')
        .select('*')
        .eq('id', 'default')
        .single();
      
      if (settingsData) {
        setSettings(settingsData);
      }

      // Fetch menu
      const { data: menuData } = await supabase
        .from('cafe_menu_items')
        .select('*')
        .order('category')
        .order('sort_order');
      
      if (menuData) setMenuItems(menuData);

      // Fetch offers
      const { data: offersData } = await supabase
        .from('cafe_offers')
        .select('*')
        .order('sort_order');
      
      if (offersData) setOffers(offersData);

      // Fetch orders
      const { data: ordersData } = await supabase
        .from('cafe_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (ordersData) setOrders(ordersData);
    } catch (error) {
      console.error('Fejl ved hentning:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('cafe_settings')
        .upsert({
          id: 'default',
          opening_hours: settings.opening_hours,
          header_image: settings.header_image || null,
          reopening_date: settings.reopening_date || null,
          contact_phone: settings.contact_phone || null,
          contact_email: settings.contact_email || null,
          contact_text: settings.contact_text || null,
          contact_text_en: settings.contact_text_en || null,
          contact_text_de: settings.contact_text_de || null,
          party_boxes: settings.party_boxes || [],
          updated_at: new Date().toISOString()
        });
      
      if (error) throw error;
      toast.success('Indstillinger gemt!');
    } catch (err) {
      console.error('Fejl:', err);
      toast.error('Kunne ikke gemme');
    } finally {
      setSaving(false);
    }
  };

  const saveMenuItem = async (item: MenuItem) => {
    try {
      if (item.id) {
        const { error } = await supabase
          .from('cafe_menu_items')
          .update({
            name: item.name,
            name_en: item.name_en || null,
            name_de: item.name_de || null,
            description: item.description || null,
            description_en: item.description_en || null,
            description_de: item.description_de || null,
            price: item.price,
            image_url: item.image_url || null,
            is_active: item.is_active,
            sort_order: item.sort_order,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cafe_menu_items')
          .insert({
            category: item.category,
            name: item.name,
            name_en: item.name_en || null,
            name_de: item.name_de || null,
            description: item.description || null,
            price: item.price,
            is_active: true,
            sort_order: menuItems.filter(m => m.category === item.category).length + 1
          });
        if (error) throw error;
      }
      toast.success('Menu item gemt!');
      setEditingMenu(null);
      fetchAll();
    } catch (err) {
      console.error('Fejl:', err);
      toast.error('Kunne ikke gemme');
    }
  };

  const deleteMenuItem = async (id: string) => {
    if (!confirm('Slet dette item?')) return;
    try {
      const { error } = await supabase.from('cafe_menu_items').delete().eq('id', id);
      if (error) throw error;
      toast.success('Slettet!');
      fetchAll();
    } catch (err) {
      toast.error('Kunne ikke slette');
    }
  };

  const saveOffer = async (offer: Offer) => {
    try {
      if (offer.id) {
        const { error } = await supabase
          .from('cafe_offers')
          .update({
            name: offer.name,
            name_en: offer.name_en || null,
            name_de: offer.name_de || null,
            description: offer.description || null,
            price: offer.price,
            image_url: offer.image_url || null,
            visible_from: offer.visible_from || null,
            visible_to: offer.visible_to || null,
            is_active: offer.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', offer.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cafe_offers')
          .insert({
            name: offer.name,
            name_en: offer.name_en || null,
            name_de: offer.name_de || null,
            description: offer.description || null,
            price: offer.price,
            is_active: false,
            sort_order: offers.length + 1
          });
        if (error) throw error;
      }
      toast.success('Tilbud gemt!');
      setEditingOffer(null);
      fetchAll();
    } catch (err) {
      console.error('Fejl:', err);
      toast.error('Kunne ikke gemme');
    }
  };

  const deleteOffer = async (id: string) => {
    if (!confirm('Slet dette tilbud?')) return;
    try {
      const { error } = await supabase.from('cafe_offers').delete().eq('id', id);
      if (error) throw error;
      toast.success('Slettet!');
      fetchAll();
    } catch (err) {
      toast.error('Kunne ikke slette');
    }
  };

  const updateOrderStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('cafe_orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      toast.success('Status opdateret!');
      fetchAll();
    } catch (err) {
      toast.error('Kunne ikke opdatere');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Coffee className="h-6 w-6 text-amber-600" />
              <h1 className="text-xl font-bold">Café Administration</h1>
            </div>
          </div>
          <Button onClick={saveSettings} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Gemmer...' : 'Gem indstillinger'}
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="hours" className="gap-2"><Clock className="h-4 w-4" /> Åbningstider</TabsTrigger>
            <TabsTrigger value="menu" className="gap-2"><UtensilsCrossed className="h-4 w-4" /> Menukort</TabsTrigger>
            <TabsTrigger value="offers" className="gap-2"><Wine className="h-4 w-4" /> Tilbud</TabsTrigger>
            <TabsTrigger value="contact" className="gap-2"><Phone className="h-4 w-4" /> Kontakt</TabsTrigger>
            <TabsTrigger value="orders">Bestillinger ({orders.filter(o => o.status === 'pending').length})</TabsTrigger>
          </TabsList>

          {/* ÅBNINGSTIDER */}
          <TabsContent value="hours">
            <Card>
              <CardHeader>
                <CardTitle>Åbningstider</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(settings.opening_hours || defaultOpeningHours).map(([day, hours]) => (
                  <div key={day} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                    <span className="w-24 font-medium">{dayNames[day]}</span>
                    <Switch
                      checked={!hours.closed}
                      onCheckedChange={(checked) => {
                        setSettings({
                          ...settings,
                          opening_hours: {
                            ...settings.opening_hours,
                            [day]: { ...hours, closed: !checked }
                          }
                        });
                      }}
                    />
                    {!hours.closed ? (
                      <>
                        <Input
                          type="time"
                          value={hours.open}
                          onChange={(e) => {
                            setSettings({
                              ...settings,
                              opening_hours: {
                                ...settings.opening_hours,
                                [day]: { ...hours, open: e.target.value }
                              }
                            });
                          }}
                          className="w-32"
                        />
                        <span>-</span>
                        <Input
                          type="time"
                          value={hours.close}
                          onChange={(e) => {
                            setSettings({
                              ...settings,
                              opening_hours: {
                                ...settings.opening_hours,
                                [day]: { ...hours, close: e.target.value }
                              }
                            });
                          }}
                          className="w-32"
                        />
                      </>
                    ) : (
                      <span className="text-red-500 font-medium">Lukket</span>
                    )}
                  </div>
                ))}
                
                {/* Genåbningsdato */}
                <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <Label className="font-medium text-amber-800">Genåbningsdato (vintersæson)</Label>
                  <p className="text-sm text-amber-600 mb-2">
                    Hvis alle dage er lukket, vises denne dato til kunderne
                  </p>
                  <Input 
                    type="date" 
                    value={settings.reopening_date || ''} 
                    onChange={e => setSettings({ ...settings, reopening_date: e.target.value })}
                    className="w-48"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* MENUKORT */}
          <TabsContent value="menu" className="space-y-6">
            {/* Edit form */}
            {editingMenu && (
              <Card className="border-amber-200 bg-amber-50">
                <CardHeader>
                  <CardTitle>{editingMenu.id ? 'Rediger' : 'Nyt'} {editingMenu.category === 'food' ? 'mad' : 'drikkevare'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Navn (DA) *</Label>
                      <Input value={editingMenu.name} onChange={e => setEditingMenu({...editingMenu, name: e.target.value})} />
                    </div>
                    <div>
                      <Label>Navn (EN)</Label>
                      <Input value={editingMenu.name_en || ''} onChange={e => setEditingMenu({...editingMenu, name_en: e.target.value})} />
                    </div>
                    <div>
                      <Label>Navn (DE)</Label>
                      <Input value={editingMenu.name_de || ''} onChange={e => setEditingMenu({...editingMenu, name_de: e.target.value})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Beskrivelse</Label>
                      <Textarea value={editingMenu.description || ''} onChange={e => setEditingMenu({...editingMenu, description: e.target.value})} rows={2} />
                    </div>
                    <div>
                      <Label>Pris (kr) *</Label>
                      <Input type="number" value={editingMenu.price} onChange={e => setEditingMenu({...editingMenu, price: parseFloat(e.target.value) || 0})} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => saveMenuItem(editingMenu)}><Check className="h-4 w-4 mr-1" /> Gem</Button>
                    <Button variant="outline" onClick={() => setEditingMenu(null)}><X className="h-4 w-4 mr-1" /> Annuller</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Mad */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <UtensilsCrossed className="h-5 w-5" /> Mad
                </CardTitle>
                <Button size="sm" onClick={() => setEditingMenu({ category: 'food', name: '', price: 0, is_active: true, sort_order: 0 })}>
                  <Plus className="h-4 w-4 mr-1" /> Tilføj
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {menuItems.filter(m => m.category === 'food').map(item => (
                    <div key={item.id} className={`flex items-center justify-between p-3 bg-gray-50 rounded-lg ${!item.is_active ? 'opacity-50' : ''}`}>
                      <div>
                        <span className="font-medium">{item.name}</span>
                        <span className="text-muted-foreground ml-2">{item.price} kr</span>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditingMenu(item)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMenuItem(item.id!)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Drikkevarer */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Wine className="h-5 w-5" /> Drikkevarer
                </CardTitle>
                <Button size="sm" onClick={() => setEditingMenu({ category: 'drinks', name: '', price: 0, is_active: true, sort_order: 0 })}>
                  <Plus className="h-4 w-4 mr-1" /> Tilføj
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {menuItems.filter(m => m.category === 'drinks').map(item => (
                    <div key={item.id} className={`flex items-center justify-between p-3 bg-gray-50 rounded-lg ${!item.is_active ? 'opacity-50' : ''}`}>
                      <div>
                        <span className="font-medium">{item.name}</span>
                        <span className="text-muted-foreground ml-2">{item.price} kr</span>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditingMenu(item)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMenuItem(item.id!)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TILBUD */}
          <TabsContent value="offers" className="space-y-4">
            {editingOffer && (
              <Card className="border-amber-200 bg-amber-50">
                <CardHeader>
                  <CardTitle>{editingOffer.id ? 'Rediger' : 'Nyt'} tilbud</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Navn (DA) *</Label>
                      <Input value={editingOffer.name} onChange={e => setEditingOffer({...editingOffer, name: e.target.value})} />
                    </div>
                    <div>
                      <Label>Navn (EN)</Label>
                      <Input value={editingOffer.name_en || ''} onChange={e => setEditingOffer({...editingOffer, name_en: e.target.value})} />
                    </div>
                    <div>
                      <Label>Pris (kr) *</Label>
                      <Input type="number" value={editingOffer.price} onChange={e => setEditingOffer({...editingOffer, price: parseFloat(e.target.value) || 0})} />
                    </div>
                  </div>
                  <div>
                    <Label>Beskrivelse</Label>
                    <Textarea value={editingOffer.description || ''} onChange={e => setEditingOffer({...editingOffer, description: e.target.value})} rows={2} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Synlig fra</Label>
                      <Input type="datetime-local" value={editingOffer.visible_from || ''} onChange={e => setEditingOffer({...editingOffer, visible_from: e.target.value})} />
                    </div>
                    <div>
                      <Label>Synlig til</Label>
                      <Input type="datetime-local" value={editingOffer.visible_to || ''} onChange={e => setEditingOffer({...editingOffer, visible_to: e.target.value})} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => saveOffer(editingOffer)}><Check className="h-4 w-4 mr-1" /> Gem</Button>
                    <Button variant="outline" onClick={() => setEditingOffer(null)}><X className="h-4 w-4 mr-1" /> Annuller</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {offers.map(offer => (
              <Card key={offer.id} className={!offer.is_active ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{offer.name}</span>
                        <Badge variant="secondary">{offer.price} kr</Badge>
                        {offer.is_active && <Badge className="bg-green-500">Aktiv</Badge>}
                      </div>
                      {offer.description && <p className="text-sm text-muted-foreground">{offer.description}</p>}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditingOffer(offer)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteOffer(offer.id!)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            <Button onClick={() => setEditingOffer({ name: '', price: 0, is_active: false, sort_order: 0 })} className="w-full">
              <Plus className="h-4 w-4 mr-2" /> Tilføj nyt tilbud
            </Button>
          </TabsContent>

          {/* KONTAKT */}
          <TabsContent value="contact">
            <Card>
              <CardHeader>
                <CardTitle>Kontaktoplysninger</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Telefon</Label>
                    <Input value={settings.contact_phone || ''} onChange={e => setSettings({...settings, contact_phone: e.target.value})} />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input value={settings.contact_email || ''} onChange={e => setSettings({...settings, contact_email: e.target.value})} />
                  </div>
                </div>
                <div>
                  <Label>Kontakttekst (DA)</Label>
                  <Textarea value={settings.contact_text || ''} onChange={e => setSettings({...settings, contact_text: e.target.value})} rows={2} />
                </div>
                <div>
                  <Label>Header billede URL</Label>
                  <Input value={settings.header_image || ''} onChange={e => setSettings({...settings, header_image: e.target.value})} placeholder="https://..." />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* BESTILLINGER */}
          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>Café Bestillinger</CardTitle>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Ingen bestillinger endnu</p>
                ) : (
                  <div className="space-y-3">
                    {orders.map(order => (
                      <div key={order.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">#{order.order_number}</span>
                            <span className="font-medium">{order.guest_name}</span>
                            <Badge variant={order.status === 'pending' ? 'default' : order.status === 'confirmed' ? 'secondary' : 'outline'}>
                              {order.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {order.offer_name} × {order.quantity} = {order.total} kr
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {order.status === 'pending' && (
                            <Button size="sm" onClick={() => updateOrderStatus(order.id, 'confirmed')}>Bekræft</Button>
                          )}
                          {order.status === 'confirmed' && (
                            <Button size="sm" onClick={() => updateOrderStatus(order.id, 'ready')}>Klar</Button>
                          )}
                          {order.status === 'ready' && (
                            <Button size="sm" variant="outline" onClick={() => updateOrderStatus(order.id, 'collected')}>Afhentet</Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminCafe;
