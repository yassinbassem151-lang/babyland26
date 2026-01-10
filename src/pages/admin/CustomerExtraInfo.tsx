import { useEffect, useState } from 'react';
import { FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useVersion } from '@/contexts/VersionContext';

interface OrderExtraInfo {
  id: string;
  order_number: number;
  customer_name: string;
  extra_info: string | null;
  created_at: string;
}

const CustomerExtraInfo = () => {
  const { activeVersion } = useVersion();
  const [orders, setOrders] = useState<OrderExtraInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeVersion) {
      loadOrders();
    }
  }, [activeVersion]);

  const loadOrders = async () => {
    if (!activeVersion) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, extra_info, created_at')
      .eq('version_id', activeVersion.id)
      .not('extra_info', 'is', null)
      .neq('extra_info', '')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('فشل في تحميل البيانات');
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  };

  const exportToExcel = () => {
    const headers = ['رقم الطلب', 'اسم العميل', 'معلومات إضافية', 'تاريخ الطلب'];
    const rows = orders.map((o) => [
      o.order_number.toString(),
      o.customer_name,
      o.extra_info || '',
      new Date(o.created_at).toLocaleDateString('ar-EG'),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'customer-extra-info.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!activeVersion) {
    return <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">معلومات العملاء الإضافية</h1>
        <div className="text-sm text-muted-foreground">
          إجمالي: {orders.length} طلب
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">الطلبات مع معلومات إضافية</CardTitle>
            {orders.length > 0 && (
              <Button variant="outline" onClick={exportToExcel} className="gap-2">
                <Download className="h-4 w-4" />
                تصدير Excel
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد طلبات بمعلومات إضافية</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-3 text-right">رقم الطلب</th>
                      <th className="p-3 text-right">اسم العميل</th>
                      <th className="p-3 text-right">معلومات إضافية</th>
                      <th className="p-3 text-right">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id} className="border-t hover:bg-muted/50">
                        <td className="p-3 font-medium">{order.order_number}</td>
                        <td className="p-3">{order.customer_name}</td>
                        <td className="p-3">{order.extra_info}</td>
                        <td className="p-3">{new Date(order.created_at).toLocaleDateString('ar-EG')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CustomerExtraInfo;
