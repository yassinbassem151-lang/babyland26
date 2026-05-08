import { useEffect, useState } from 'react';
import { TrendingUp, ShoppingCart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useVersion } from '@/contexts/VersionContext';

interface OrderRow {
  id: string;
  order_number: number;
  customer_name: string;
  total: number;
  created_at: string;
}

interface DayGroup {
  dateKey: string;
  dateLabel: string;
  orders: OrderRow[];
  total: number;
}

const DailySales = () => {
  const { activeVersion } = useVersion();
  const isFullAdmin = sessionStorage.getItem('babyland_admin') === 'true';
  const [days, setDays] = useState<DayGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeVersion) load();
  }, [activeVersion]);

  const load = async () => {
    if (!activeVersion) return;
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, total, created_at')
      .eq('version_id', activeVersion.id)
      .order('created_at', { ascending: false });

    const map = new Map<string, DayGroup>();
    (data || []).forEach((o: OrderRow) => {
      const d = new Date(o.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const label = d.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      if (!map.has(key)) map.set(key, { dateKey: key, dateLabel: label, orders: [], total: 0 });
      const g = map.get(key)!;
      g.orders.push(o);
      g.total += Number(o.total) || 0;
    });

    setDays(Array.from(map.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey)));
    setLoading(false);
  };

  if (!isFullAdmin) {
    return <div className="text-center py-12 text-muted-foreground">غير مصرح بالوصول</div>;
  }

  if (!activeVersion || loading) {
    return <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <TrendingUp className="h-6 w-6 text-primary" />
        المبيعات اليومية
      </h1>
      <p className="text-sm text-muted-foreground">إجمالي مبيعات كل يوم بدون خصم العربون</p>

      {days.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">لا توجد مبيعات</CardContent></Card>
      ) : (
        days.map((day) => (
          <Card key={day.dateKey} className="border-2 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{day.dateLabel}</span>
                <span className="text-primary text-lg">
                  {day.total.toFixed(2)} ج.م
                </span>
              </CardTitle>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <ShoppingCart className="h-4 w-4" />
                {day.orders.length} طلب
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {day.orders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-primary">#{o.order_number}</span>
                      <span>{o.customer_name}</span>
                    </div>
                    <span className="font-semibold">{Number(o.total).toFixed(2)} ج.م</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};

export default DailySales;
