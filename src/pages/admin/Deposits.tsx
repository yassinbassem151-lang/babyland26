import { useEffect, useState } from 'react';
import { Wallet, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Deposit {
  id: string;
  order_number: number;
  customer_name: string;
  amount: number;
  method: string;
  created_at: string;
}

const methodLabels: Record<string, string> = {
  cash: 'كاش',
  instapay: 'InstaPay',
  vodafone_cash: 'فودافون كاش',
};

const Deposits = () => {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDeposits();
  }, []);

  const loadDeposits = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('deposits')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('فشل في تحميل العربون');
    } else {
      setDeposits(data || []);
    }
    setLoading(false);
  };

  const totalDeposits = deposits.reduce((sum, d) => sum + d.amount, 0);

  const exportToExcel = () => {
    const headers = ['رقم الطلب', 'اسم العميل', 'المبلغ', 'طريقة الدفع', 'التاريخ والوقت'];
    const rows = deposits.map((d) => [
      d.order_number,
      d.customer_name,
      d.amount,
      methodLabels[d.method] || d.method,
      new Date(d.created_at).toLocaleString('ar-EG'),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'deposits.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">سجل العربون</h1>
        {deposits.length > 0 && (
          <Button variant="outline" onClick={exportToExcel} className="gap-2">
            <Download className="h-4 w-4" />
            تصدير Excel
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-2 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">إجمالي العربون</p>
                <p className="text-3xl font-bold text-primary">{totalDeposits.toFixed(2)} ج.م</p>
              </div>
              <div className="p-3 rounded-xl bg-primary/10 text-primary">
                <Wallet className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">عدد المعاملات</p>
                <p className="text-3xl font-bold">{deposits.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
      ) : deposits.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-12">
            <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">لا توجد معاملات</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>المعاملات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-3 text-right">رقم الطلب</th>
                    <th className="p-3 text-right">العميل</th>
                    <th className="p-3 text-right">المبلغ</th>
                    <th className="p-3 text-right">طريقة الدفع</th>
                    <th className="p-3 text-right">التاريخ والوقت</th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.map((deposit) => (
                    <tr key={deposit.id} className="border-t hover:bg-muted/50">
                      <td className="p-3 font-bold text-primary">#{deposit.order_number}</td>
                      <td className="p-3">{deposit.customer_name}</td>
                      <td className="p-3 font-bold">{deposit.amount.toFixed(2)} ج.م</td>
                      <td className="p-3">{methodLabels[deposit.method] || deposit.method}</td>
                      <td className="p-3">{new Date(deposit.created_at).toLocaleString('ar-EG')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Deposits;
