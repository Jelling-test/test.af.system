import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, Home, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ChecklistItem {
  id: string;
  text_da: string;
  text_en: string;
  text_de: string;
  fee?: number;
}

interface InfoSection {
  id: string;
  title_da: string;
  title_en: string;
  title_de: string;
  text_da: string;
  text_en: string;
  text_de: string;
  icon: string;
  cabin_numbers: string[] | 'all';
}

interface InventoryItem {
  id: string;
  quantity_4: number;
  quantity_6: number;
  name_da: string;
  name_en: string;
  name_de: string;
}

interface CabinSettings {
  id: string;
  arrival_items: ChecklistItem[];
  departure_items: ChecklistItem[];
  cleaning_price: number;
  cleaning_items: ChecklistItem[];
  phone: string;
  info_sections: InfoSection[];
  inventory: InventoryItem[];
  cabin_6_persons: string[];
}

const AdminCabinInfo = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<CabinSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('arrival');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('cabin_settings')
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

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('cabin_settings')
        .update({
          arrival_items: settings.arrival_items,
          departure_items: settings.departure_items,
          cleaning_price: settings.cleaning_price,
          cleaning_items: settings.cleaning_items,
          phone: settings.phone,
          info_sections: settings.info_sections,
          inventory: settings.inventory,
          cabin_6_persons: settings.cabin_6_persons,
          updated_at: new Date().toISOString()
        })
        .eq('id', settings.id);
      
      if (error) throw error;
      toast.success('Indstillinger gemt!');
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Fejl ved gem');
    } finally {
      setSaving(false);
    }
  };

  const updateArrivalItem = (index: number, field: string, value: string) => {
    if (!settings) return;
    const newItems = [...settings.arrival_items];
    newItems[index] = { ...newItems[index], [field]: value };
    setSettings({ ...settings, arrival_items: newItems });
  };

  const updateDepartureItem = (index: number, field: string, value: string | number) => {
    if (!settings) return;
    const newItems = [...settings.departure_items];
    newItems[index] = { ...newItems[index], [field]: value };
    setSettings({ ...settings, departure_items: newItems });
  };

  const updateCleaningItem = (index: number, field: string, value: string | number) => {
    if (!settings) return;
    const newItems = [...settings.cleaning_items];
    newItems[index] = { ...newItems[index], [field]: value };
    setSettings({ ...settings, cleaning_items: newItems });
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
              <Home className="h-6 w-6 text-amber-600" />
              <div>
                <h1 className="text-xl font-bold">Hytter - Info opsætning</h1>
                <p className="text-sm text-gray-500">Tjeklister, inventar og gebyrer</p>
              </div>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Gemmer...' : 'Gem ændringer'}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto p-4 space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="arrival">Ankomst</TabsTrigger>
            <TabsTrigger value="departure">Afrejse</TabsTrigger>
            <TabsTrigger value="cleaning">Rengøring</TabsTrigger>
            <TabsTrigger value="info">Info kasser</TabsTrigger>
            <TabsTrigger value="inventory">Inventar</TabsTrigger>
          </TabsList>

          {/* VED ANKOMST */}
          <TabsContent value="arrival" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-green-700">✓ Tjekliste ved ankomst</CardTitle>
                <p className="text-sm text-gray-500">Punkter gæsten skal tjekke ved ankomst</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {settings.arrival_items.map((item, index) => (
                  <div key={item.id} className="border rounded-lg p-4 space-y-3 bg-green-50">
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-sm text-green-700">Punkt {index + 1}</span>
                      <Button variant="ghost" size="sm" onClick={() => {
                        setSettings({
                          ...settings,
                          arrival_items: settings.arrival_items.filter((_, i) => i !== index)
                        });
                      }} className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div>
                      <Label className="text-xs">Dansk</Label>
                      <Textarea value={item.text_da} onChange={(e) => updateArrivalItem(index, 'text_da', e.target.value)} className="mt-1" rows={2} />
                    </div>
                    <div>
                      <Label className="text-xs">English</Label>
                      <Textarea value={item.text_en} onChange={(e) => updateArrivalItem(index, 'text_en', e.target.value)} className="mt-1" rows={2} />
                    </div>
                    <div>
                      <Label className="text-xs">Deutsch</Label>
                      <Textarea value={item.text_de} onChange={(e) => updateArrivalItem(index, 'text_de', e.target.value)} className="mt-1" rows={2} />
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={() => {
                  setSettings({
                    ...settings,
                    arrival_items: [...settings.arrival_items, { id: Date.now().toString(), text_da: '', text_en: '', text_de: '' }]
                  });
                }} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Tilføj punkt
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* VED AFREJSE */}
          <TabsContent value="departure" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-amber-700">⚠️ Tjekliste ved afrejse</CardTitle>
                <p className="text-sm text-gray-500">Punkter der SKAL udføres - med gebyr hvis ikke udført</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {settings.departure_items.map((item, index) => (
                  <div key={item.id} className="border rounded-lg p-4 space-y-3 bg-amber-50">
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-sm text-amber-700">Punkt {index + 1}</span>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Label className="text-xs">Gebyr:</Label>
                          <Input type="number" value={item.fee || 0} onChange={(e) => updateDepartureItem(index, 'fee', parseInt(e.target.value) || 0)} className="w-20 h-8" />
                          <span className="text-xs">kr</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => {
                          setSettings({
                            ...settings,
                            departure_items: settings.departure_items.filter((_, i) => i !== index)
                          });
                        }} className="text-red-500 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Dansk</Label>
                      <Textarea value={item.text_da} onChange={(e) => updateDepartureItem(index, 'text_da', e.target.value)} className="mt-1" rows={2} />
                    </div>
                    <div>
                      <Label className="text-xs">English</Label>
                      <Textarea value={item.text_en} onChange={(e) => updateDepartureItem(index, 'text_en', e.target.value)} className="mt-1" rows={2} />
                    </div>
                    <div>
                      <Label className="text-xs">Deutsch</Label>
                      <Textarea value={item.text_de} onChange={(e) => updateDepartureItem(index, 'text_de', e.target.value)} className="mt-1" rows={2} />
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={() => {
                  setSettings({
                    ...settings,
                    departure_items: [...settings.departure_items, { id: Date.now().toString(), text_da: '', text_en: '', text_de: '', fee: 0 }]
                  });
                }} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Tilføj punkt
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SLUTRENGØRING */}
          <TabsContent value="cleaning" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-red-700">🧹 Slutrengøring</CardTitle>
                <p className="text-sm text-gray-500">Kan tilkøbes - ellers skal gæsten selv udføre</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-teal-50 rounded-lg">
                  <Label className="font-medium">Pris for slutrengøring:</Label>
                  <Input type="number" value={settings.cleaning_price} onChange={(e) => setSettings({ ...settings, cleaning_price: parseInt(e.target.value) || 0 })} className="w-24" />
                  <span>kr</span>
                </div>

                <p className="text-sm text-gray-600 font-medium mt-6">Hvis IKKE tilkøbt slutrengøring, skal følgende udføres:</p>

                {settings.cleaning_items.map((item, index) => (
                  <div key={item.id} className="border rounded-lg p-4 space-y-3 bg-red-50">
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-sm text-red-700">Punkt {index + 1}</span>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Label className="text-xs">Gebyr:</Label>
                          <Input type="number" value={item.fee || 0} onChange={(e) => updateCleaningItem(index, 'fee', parseInt(e.target.value) || 0)} className="w-20 h-8" />
                          <span className="text-xs">kr</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => {
                          setSettings({
                            ...settings,
                            cleaning_items: settings.cleaning_items.filter((_, i) => i !== index)
                          });
                        }} className="text-red-500 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Dansk</Label>
                      <Textarea value={item.text_da} onChange={(e) => updateCleaningItem(index, 'text_da', e.target.value)} className="mt-1" rows={2} />
                    </div>
                    <div>
                      <Label className="text-xs">English</Label>
                      <Textarea value={item.text_en} onChange={(e) => updateCleaningItem(index, 'text_en', e.target.value)} className="mt-1" rows={2} />
                    </div>
                    <div>
                      <Label className="text-xs">Deutsch</Label>
                      <Textarea value={item.text_de} onChange={(e) => updateCleaningItem(index, 'text_de', e.target.value)} className="mt-1" rows={2} />
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={() => {
                  setSettings({
                    ...settings,
                    cleaning_items: [...settings.cleaning_items, { id: Date.now().toString(), text_da: '', text_en: '', text_de: '', fee: 0 }]
                  });
                }} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Tilføj punkt
                </Button>
              </CardContent>
            </Card>

            {/* Kontakt */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">📞 Kontakt</CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <Label>Telefonnummer</Label>
                  <Input value={settings.phone} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} className="mt-1" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* INFO SEKTIONER */}
          <TabsContent value="info" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">📦 Info kasser</CardTitle>
                <p className="text-sm text-gray-500">Køkken, Soveværelse, Badeværelse, Rengøring etc.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {settings.info_sections?.map((section, index) => (
                  <div key={section.id} className="border rounded-lg p-4 space-y-3 bg-blue-50">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-blue-700">Sektion {index + 1}</span>
                        <select
                          value={section.icon}
                          onChange={(e) => {
                            const newSections = [...settings.info_sections];
                            newSections[index] = { ...newSections[index], icon: e.target.value };
                            setSettings({ ...settings, info_sections: newSections });
                          }}
                          className="text-xs border rounded px-2 py-1"
                        >
                          <option value="kitchen">🍳 Køkken</option>
                          <option value="bedroom">🛏️ Soveværelse</option>
                          <option value="bathroom">🚿 Badeværelse</option>
                          <option value="cleaning">🧹 Rengøring</option>
                        </select>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => {
                        setSettings({
                          ...settings,
                          info_sections: settings.info_sections.filter((_, i) => i !== index)
                        });
                      }} className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {/* Hytte numre */}
                    <div className="flex items-center gap-2 bg-white p-2 rounded border">
                      <Label className="text-xs whitespace-nowrap">Vis for hytter:</Label>
                      <label className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={section.cabin_numbers === 'all'}
                          onChange={(e) => {
                            const newSections = [...settings.info_sections];
                            newSections[index] = { 
                              ...newSections[index], 
                              cabin_numbers: e.target.checked ? 'all' : [] 
                            };
                            setSettings({ ...settings, info_sections: newSections });
                          }}
                          className="rounded"
                        />
                        Alle
                      </label>
                      {section.cabin_numbers !== 'all' && (
                        <Input
                          value={Array.isArray(section.cabin_numbers) ? section.cabin_numbers.join(', ') : ''}
                          onChange={(e) => {
                            const newSections = [...settings.info_sections];
                            const numbers = e.target.value.split(',').map(n => n.trim()).filter(n => n);
                            newSections[index] = { ...newSections[index], cabin_numbers: numbers };
                            setSettings({ ...settings, info_sections: newSections });
                          }}
                          placeholder="26, 27, 28"
                          className="flex-1 text-xs h-8"
                        />
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Titel (DA)</Label>
                        <Input value={section.title_da} onChange={(e) => {
                          const newSections = [...settings.info_sections];
                          newSections[index] = { ...newSections[index], title_da: e.target.value };
                          setSettings({ ...settings, info_sections: newSections });
                        }} className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">Titel (EN)</Label>
                        <Input value={section.title_en} onChange={(e) => {
                          const newSections = [...settings.info_sections];
                          newSections[index] = { ...newSections[index], title_en: e.target.value };
                          setSettings({ ...settings, info_sections: newSections });
                        }} className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">Titel (DE)</Label>
                        <Input value={section.title_de} onChange={(e) => {
                          const newSections = [...settings.info_sections];
                          newSections[index] = { ...newSections[index], title_de: e.target.value };
                          setSettings({ ...settings, info_sections: newSections });
                        }} className="mt-1" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Beskrivelse (DA)</Label>
                      <Textarea value={section.text_da} onChange={(e) => {
                        const newSections = [...settings.info_sections];
                        newSections[index] = { ...newSections[index], text_da: e.target.value };
                        setSettings({ ...settings, info_sections: newSections });
                      }} className="mt-1" rows={2} />
                    </div>
                    <div>
                      <Label className="text-xs">Beskrivelse (EN)</Label>
                      <Textarea value={section.text_en} onChange={(e) => {
                        const newSections = [...settings.info_sections];
                        newSections[index] = { ...newSections[index], text_en: e.target.value };
                        setSettings({ ...settings, info_sections: newSections });
                      }} className="mt-1" rows={2} />
                    </div>
                    <div>
                      <Label className="text-xs">Beskrivelse (DE)</Label>
                      <Textarea value={section.text_de} onChange={(e) => {
                        const newSections = [...settings.info_sections];
                        newSections[index] = { ...newSections[index], text_de: e.target.value };
                        setSettings({ ...settings, info_sections: newSections });
                      }} className="mt-1" rows={2} />
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={() => {
                  setSettings({
                    ...settings,
                    info_sections: [...(settings.info_sections || []), { 
                      id: Date.now().toString(), 
                      icon: 'kitchen',
                      title_da: '', title_en: '', title_de: '',
                      text_da: '', text_en: '', text_de: '',
                      cabin_numbers: 'all'
                    }]
                  });
                }} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Tilføj info sektion
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* INVENTAR */}
          <TabsContent value="inventory" className="space-y-4">
            {/* 6-personers hytter */}
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">6-personers hytter</CardTitle>
                <p className="text-xs text-gray-500">Angiv hyttenumre (kommasepareret)</p>
              </CardHeader>
              <CardContent>
                <Input
                  defaultValue={settings.cabin_6_persons?.join(', ') || ''}
                  onBlur={(e) => {
                    const numbers = e.target.value.split(',').map(n => n.trim()).filter(n => n);
                    setSettings({ ...settings, cabin_6_persons: numbers });
                  }}
                  placeholder="28, 32, 33, 34, 36, 37, 38, 39, 40, 42"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">📋 Inventarliste</CardTitle>
                <p className="text-sm text-gray-500">Service og udstyr i hytten</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {/* Header */}
                <div className="flex items-center gap-2 p-2 bg-gray-100 rounded text-xs font-medium text-gray-600">
                  <span className="w-14 text-center">4-pers</span>
                  <span className="w-14 text-center">6-pers</span>
                  <span className="flex-1">Dansk</span>
                  <span className="flex-1">English</span>
                  <span className="flex-1">Deutsch</span>
                  <span className="w-8"></span>
                </div>
                {settings.inventory?.map((item, index) => (
                  <div key={item.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <Input
                      type="number"
                      value={item.quantity_4}
                      onChange={(e) => {
                        const newInventory = [...settings.inventory];
                        newInventory[index] = { ...newInventory[index], quantity_4: parseInt(e.target.value) || 0 };
                        setSettings({ ...settings, inventory: newInventory });
                      }}
                      className="w-14 text-center text-sm"
                      min={0}
                    />
                    <Input
                      type="number"
                      value={item.quantity_6}
                      onChange={(e) => {
                        const newInventory = [...settings.inventory];
                        newInventory[index] = { ...newInventory[index], quantity_6: parseInt(e.target.value) || 0 };
                        setSettings({ ...settings, inventory: newInventory });
                      }}
                      className="w-14 text-center text-sm"
                      min={0}
                    />
                    <Input
                      value={item.name_da}
                      onChange={(e) => {
                        const newInventory = [...settings.inventory];
                        newInventory[index] = { ...newInventory[index], name_da: e.target.value };
                        setSettings({ ...settings, inventory: newInventory });
                      }}
                      placeholder="Dansk"
                      className="flex-1 text-sm"
                    />
                    <Input
                      value={item.name_en}
                      onChange={(e) => {
                        const newInventory = [...settings.inventory];
                        newInventory[index] = { ...newInventory[index], name_en: e.target.value };
                        setSettings({ ...settings, inventory: newInventory });
                      }}
                      placeholder="English"
                      className="flex-1 text-sm"
                    />
                    <Input
                      value={item.name_de}
                      onChange={(e) => {
                        const newInventory = [...settings.inventory];
                        newInventory[index] = { ...newInventory[index], name_de: e.target.value };
                        setSettings({ ...settings, inventory: newInventory });
                      }}
                      placeholder="Deutsch"
                      className="flex-1 text-sm"
                    />
                    <Button variant="ghost" size="sm" onClick={() => {
                      setSettings({
                        ...settings,
                        inventory: settings.inventory.filter((_, i) => i !== index)
                      });
                    }} className="text-red-500 hover:text-red-700 w-8">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" onClick={() => {
                  setSettings({
                    ...settings,
                    inventory: [...(settings.inventory || []), { 
                      id: Date.now().toString(), 
                      quantity_4: 1,
                      quantity_6: 1,
                      name_da: '', name_en: '', name_de: ''
                    }]
                  });
                }} className="w-full mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Tilføj inventar
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminCabinInfo;
