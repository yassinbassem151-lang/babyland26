import { useEffect, useState } from 'react';
import { TrendingUp, ShoppingCart, CalendarDays } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useVersion } from '@/contexts/VersionContext';
import { format } from 'date-fns';
import { arEG } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface OrderRow {
  id: string;
  order_number: number;
  customer_name: string;
  total: number;
  deposit_amount: number;
  created_at: string;
}

const DailySales = () => {
  const { activeVersion } = useVersion();
  const isFullAdmin = sessionStorage.getItem('babyland_admin') === 'true';
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeVersion && selectedDate) loadDay(selectedDate);
  }, [activeVersion, selectedDate]);

  const loadDay = async (date: Date) => {
    if (!activeVersion) return;
    setLoading(true);

    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

    const { data } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, total, deposit_amount, created_at')
      .eq('version_id', activeVersion.id)
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())
      .order('created_at', { ascending: false });

    setOrders(data || []);
    setLoading(false);
  };

  const dayTotal = orders.reduce((sum, o) => sum + (Number(o.total) || 0) + (Number(o.deposit_amount) || 0), 0);
  const dayLabel = selectedDate
    ? format(selectedDate, 'EEEE d MMMM yyyy', { locale: arEG })
    : '';

  if (!isFullAdmin) {
    return <div className="text-center py-12 text-muted-foreground">غير مصرح بالوصول</div>;
  }

  if (!activeVersion) {
    return <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <TrendingUp className="h-6 w-6 text-primary" />
        المبيعات اليومية
      </h1>
      <p className="text-sm text-muted-foreground">إجمالي مبيعات اليوم المختار بدون خصم العربون</p>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal',
              !selectedDate && 'text-muted-foreground'
            )}
          >
            <CalendarDays className="ml-2 h-4 w-4" />
            {selectedDate ? dayLabel : 'اختر يوم'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            initialFocus
            className={cn('p-3 pointer-events-auto')}
          />
        </PopoverContent>
      </Popover>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
      ) : (
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{dayLabel}</span>
              <span className="text-primary text-lg">
                {dayTotal.toFixed(2)} ج.م
              </span>
            </CardTitle>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <ShoppingCart className="h-4 w-4" />
              {orders.length} طلب
            </p>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="text-center text-muted-foreground py-6">لا توجد مبيعات في هذا اليوم</div>
            ) : (
              <div className="space-y-2">
                {orders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-primary">#{o.order_number}</span>
                      <span>{o.customer_name}</span>
                    </div>
                    <span className="font-semibold">{(Number(o.total) + Number(o.deposit_amount || 0)).toFixed(2)} ج.م</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DailySales;
