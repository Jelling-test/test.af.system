import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, TrendingUp, Users, Clock, Search } from "lucide-react";
import { formatDanishDate, formatDanishDateTime } from "@/utils/dateTime";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DailyStats {
  date: string;
  approved_entries: number;
  unique_plates: number;
}

interface PlateLastEntry {
  plate_norm: string;
  last_entry: string;
  count: number;
  owner_name?: string;
  booking_id?: number;
  notes?: string;
}

export function BarrierStatistics() {
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [topPlates, setTopPlates] = useState<PlateLastEntry[]>([]);
  const [totalApproved, setTotalApproved] = useState(0);
  const [totalDenied, setTotalDenied] = useState(0);
  const [totalApprovedPlates, setTotalApprovedPlates] = useState(0);
  const [searchPlate, setSearchPlate] = useState("");
  const [plateDetails, setPlateDetails] = useState<any>(null);
  const [plateDetections, setPlateDetections] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [allCustomerPlates, setAllCustomerPlates] = useState<any[]>([]);

  useEffect(() => {
    fetchStatistics();
  }, []);

  const searchPlateDetails = async () => {
    if (!searchPlate.trim()) return;

    const searchTerm = searchPlate.trim();
    const normalizedPlate = searchTerm.toUpperCase();

    // Reset state
    setPlateDetails(null);
    setSearchResults([]);
    setAllCustomerPlates([]);
    setPlateDetections([]);

    // Først: Søg på nummerplade (eksakt match)
    const { data: plateData } = await (supabase as any)
      .from('approved_plates')
      .select('*')
      .eq('plate_text', normalizedPlate)
      .single();
    
    if (plateData) {
      // Fundet på nummerplade - vis direkte
      await selectCustomer(plateData);
      return;
    }

    // Søg på booking nummer
    if (!isNaN(Number(searchTerm))) {
      const { data: bookingData } = await (supabase as any)
        .from('approved_plates')
        .select('*')
        .eq('booking_id', Number(searchTerm));
      
      if (bookingData && bookingData.length > 0) {
        if (bookingData.length === 1) {
          await selectCustomer(bookingData[0]);
          return;
        } else {
          setSearchResults(bookingData);
          return;
        }
      }
    }

    // Søg på navn
    const { data: nameData } = await (supabase as any)
      .from('approved_plates')
      .select('*')
      .or(`customer_name.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`);
    
    if (nameData && nameData.length > 0) {
      // Grupper efter kunde (booking_id eller customer_name)
      const uniqueCustomers = nameData.reduce((acc: any[], current: any) => {
        const key = current.booking_id || current.customer_name || current.notes;
        if (!acc.find(c => (c.booking_id || c.customer_name || c.notes) === key)) {
          acc.push(current);
        }
        return acc;
      }, []);

      if (uniqueCustomers.length === 1) {
        await selectCustomer(uniqueCustomers[0]);
      } else {
        setSearchResults(uniqueCustomers);
      }
    }
  };

  const selectCustomer = async (customer: any) => {
    setPlateDetails(customer);
    setSearchResults([]);

    // Hent ALLE nummerplader for denne kunde
    const customerKey = customer.booking_id || customer.customer_name || customer.notes;
    const { data: allPlates } = await (supabase as any)
      .from('approved_plates')
      .select('*')
      .or(customer.booking_id 
        ? `booking_id.eq.${customer.booking_id}`
        : `customer_name.eq.${customer.customer_name},notes.eq.${customer.notes}`
      );

    setAllCustomerPlates(allPlates || []);

    // Hent detektioner for ALLE kundens plader
    const plateTexts = (allPlates || []).map((p: any) => p.plate_text);
    if (plateTexts.length > 0) {
      const { data: detections } = await (supabase as any)
        .from('plate_detections')
        .select('*')
        .in('plate_text', plateTexts)
        .order('created_at', { ascending: false })
        .limit(100);

    // Filtrer duplikater - samme minut
    const uniqueDetections = (detections || []).reduce((acc: any[], current: any) => {
      const currentMinute = formatDanishDateTime(current.created_at, {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const isDuplicate = acc.some(det => 
        formatDanishDateTime(det.created_at, {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }) === currentMinute
      );
      
      if (!isDuplicate) {
        acc.push(current);
      }
      
      return acc;
    }, []);

    setPlateDetections(uniqueDetections.slice(0, 20));
    }
  };

  const fetchStatistics = async () => {
    try {
      // Total detections from plate_detections
      const { count: totalDetections } = await (supabase as any)
        .from('plate_detections')
        .select('*', { count: 'exact', head: true });

      // Count IN direction (indkørende)
      const { count: inCount } = await (supabase as any)
        .from('plate_detections')
        .select('*', { count: 'exact', head: true })
        .eq('car_direction', 'in');

      // Count OUT direction (udkørende)
      const { count: outCount } = await (supabase as any)
        .from('plate_detections')
        .select('*', { count: 'exact', head: true })
        .eq('car_direction', 'out');

      setTotalApproved(inCount || 0);
      setTotalDenied(outCount || 0);

      // Hent antal godkendte nummerplader (fra public schema)
      const { count: approvedPlatesCount } = await (supabase as any)
        .from('approved_plates')
        .select('*', { count: 'exact', head: true });
      
      setTotalApprovedPlates(approvedPlatesCount || 0);

      // Daily stats (last 7 days) - from plate_detections
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: logsData } = await (supabase as any)
        .from('plate_detections')
        .select('created_at, plate_text, car_direction')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (logsData) {
        const dailyMap = new Map<string, { approved: number; plates: Set<string> }>();

        logsData.forEach((log: any) => {
          const date = new Date(log.created_at).toISOString().split('T')[0];
          if (!dailyMap.has(date)) {
            dailyMap.set(date, { approved: 0, plates: new Set() });
          }
          const stats = dailyMap.get(date)!;
          if (log.car_direction === 'in') {
            stats.approved++;
          }
          stats.plates.add(log.plate_text);
        });

        const daily = Array.from(dailyMap.entries())
          .map(([date, stats]) => ({
            date,
            approved_entries: stats.approved,
            unique_plates: stats.plates.size,
          }))
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 7);

        setDailyStats(daily);
      }

      // Top plates by frequency from plate_detections
      const { data: topPlatesData } = await (supabase as any)
        .from('plate_detections')
        .select('plate_text, created_at')
        .order('created_at', { ascending: false })
        .limit(100);

      if (topPlatesData) {
        const plateMap = new Map<string, { count: number; last: string }>();
        topPlatesData.forEach((log: any) => {
          if (!plateMap.has(log.plate_text)) {
            plateMap.set(log.plate_text, { count: 0, last: log.created_at });
          }
          const entry = plateMap.get(log.plate_text)!;
          entry.count++;
          if (new Date(log.created_at) > new Date(entry.last)) {
            entry.last = log.created_at;
          }
        });

        const top = Array.from(plateMap.entries())
          .map(([plate, data]) => ({
            plate_norm: plate,
            last_entry: data.last,
            count: data.count,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        // Hent navne, booking ID og notes fra approved_plates
        const { data: approvedPlatesWithNames } = await (supabase as any)
          .from('approved_plates')
          .select('plate_text, customer_name, booking_id, notes')
          .in('plate_text', top.map(p => p.plate_norm));

        // Tilføj navne, booking ID og notes til top plates
        const topWithNames = top.map(plate => {
          const approved = approvedPlatesWithNames?.find(
            (ap: any) => ap.plate_text === plate.plate_norm
          );
          return {
            ...plate,
            owner_name: approved?.customer_name || undefined,
            booking_id: approved?.booking_id || undefined,
            notes: approved?.notes || undefined
          };
        });

        setTopPlates(topWithNames);
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  };

  const formatDate = (date: string) => {
    try {
      const d = new Date(date);
      return d.toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return date;
    }
  };

  const formatDateTime = (date: string) => {
    try {
      return new Date(date).toLocaleString('da-DK');
    } catch {
      return date;
    }
  };

  return (
    <div className="space-y-6">
      {/* Søgefelt */}
      <Card>
        <CardHeader>
          <CardTitle>Søg kunde</CardTitle>
          <CardDescription>Søg efter nummerplade, navn eller booking nummer</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Indtast nummerplade, navn eller booking nummer..."
                value={searchPlate}
                onChange={(e) => setSearchPlate(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchPlateDetails()}
                className="pl-9"
              />
            </div>
            <Button onClick={searchPlateDetails}>Søg</Button>
          </div>

          {/* Vis søgeresultater hvis flere matches */}
          {searchResults.length > 0 && (
            <div className="mt-4">
              <h4 className="font-semibold mb-2">Vælg kunde ({searchResults.length} fundet):</h4>
              <div className="space-y-2">
                {searchResults.map((result, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectCustomer(result)}
                    className="w-full text-left border rounded-lg p-3 hover:bg-accent transition-colors"
                  >
                    <div className="font-semibold">{result.customer_name || result.notes}</div>
                    <div className="text-sm text-muted-foreground">
                      Booking: {result.booking_id || '-'} | Plade: {result.plate_text}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Vis detaljer hvis kunde valgt */}
          {plateDetails && (
            <div className="mt-4 space-y-4">
              <div className="border rounded-lg p-4">
                <h3 className="font-bold text-lg mb-2">{plateDetails.customer_name || plateDetails.notes}</h3>
                <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                  <div><span className="font-semibold">Booking:</span> {plateDetails.booking_id || '-'}</div>
                  <div><span className="font-semibold">Kilde:</span> <Badge variant="outline">{plateDetails.source === 'sirvoy_webhook' ? 'Sæson' : 'Personale'}</Badge></div>
                  <div><span className="font-semibold">Checked in:</span> {plateDetails.checked_in ? '✅' : '❌'}</div>
                  <div><span className="font-semibold">Ankomst:</span> {plateDetails.arrival_date ? formatDate(plateDetails.arrival_date) : '-'}</div>
                  <div><span className="font-semibold">Afrejse:</span> {plateDetails.departure_date ? formatDate(plateDetails.departure_date) : '-'}</div>
                </div>
                
                {/* Vis ALLE nummerplader for kunden */}
                {allCustomerPlates.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <h4 className="font-semibold mb-2">Nummerplader ({allCustomerPlates.length}):</h4>
                    <div className="flex flex-wrap gap-2">
                      {allCustomerPlates.map((plate, idx) => (
                        <Badge key={idx} variant="secondary" className="font-mono">{plate.plate_text}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Vis detektioner for ALLE kundens plader */}
              {plateDetections.length > 0 && (
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Seneste {plateDetections.length} detektioner (alle plader):</h4>
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {plateDetections.map((detection, idx) => (
                      <div key={detection.id} className="text-xs flex justify-between border-b pb-1">
                        <span className="font-mono">{detection.plate_text}</span>
                        <span>{formatDanishDateTime(detection.created_at, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        <Badge variant="outline" className="text-xs">{detection.car_direction}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Vis besked hvis ikke fundet */}
          {searchPlate && plateDetails === null && searchResults.length === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">Ingen kunde fundet med "{searchPlate}"</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Indkørende</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalApproved}</div>
            <p className="text-xs text-muted-foreground">Indkørende biler (seneste 7 dage)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Udkørende</CardTitle>
            <TrendingUp className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDenied}</div>
            <p className="text-xs text-muted-foreground">Udkørende biler (seneste 7 dage)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unikke plader (7d)</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalApprovedPlates}
            </div>
            <p className="text-xs text-muted-foreground">Godkendte nummerplader i systemet</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gennemsnit/dag</CardTitle>
            <BarChart className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dailyStats.length > 0
                ? Math.round(
                    dailyStats.reduce((sum, day) => sum + day.approved_entries, 0) /
                      dailyStats.length
                  )
                : 0}
            </div>
            <p className="text-xs text-muted-foreground">Indkørsler pr. dag</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daglig statistik (seneste 7 dage)</CardTitle>
            <CardDescription>Godkendte indkørsler og unikke nummerplader</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dailyStats.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Ingen data</p>
              ) : (
                dailyStats.map((day) => (
                  <div
                    key={day.date}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div>
                      <div className="font-medium">{formatDanishDate(day.date)}</div>
                      <div className="text-sm text-muted-foreground">
                        {day.unique_plates} unikke plader
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">{day.approved_entries}</div>
                      <div className="text-xs text-muted-foreground">godkendt</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 10 nummerplader</CardTitle>
            <CardDescription>Mest aktive nummerplader med seneste indkørsel</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topPlates.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Ingen data</p>
              ) : (
                topPlates.map((plate, idx) => (
                  <div
                    key={plate.plate_norm}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="font-mono font-bold">{plate.plate_norm}</div>
                        {plate.owner_name && (
                          <div className="text-sm text-foreground">{plate.owner_name}</div>
                        )}
                        {!plate.owner_name && plate.notes && (
                          <div className="text-sm text-foreground">{plate.notes}</div>
                        )}
                        {plate.booking_id && (
                          <div className="text-xs text-muted-foreground">Booking #{plate.booking_id}</div>
                        )}
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDanishDateTime(plate.last_entry, {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">{plate.count}</div>
                      <div className="text-xs text-muted-foreground">gange</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
