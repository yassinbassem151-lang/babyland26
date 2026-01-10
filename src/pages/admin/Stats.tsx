import { useEffect, useState } from 'react';
import { Package, ShoppingCart, Users, TrendingUp, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useVersion } from '@/contexts/VersionContext';

interface Stats {
  totalProducts: number;
  totalOrders: number;
  totalCustomers: number;
  totalRevenue: number;
  lowStockProducts: number;
}

const Stats = () => {
  const { activeVersion } = useVersion();
  const [stats, setStats] = useState<Stats>({
    totalProducts: 0,
    totalOrders: 0,
    totalCustomers: 0,
    totalRevenue: 0,
    lowStockProducts: 0,
  });
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);

  useEffect(() => {
    if (activeVersion) {
      loadStats();
    }
  }, [activeVersion]);

  const loadStats = async () => {
    if (!activeVersion) return;

    const [products, orders, customers, lowStock] = await Promise.all([
      supabase.from('products').select('id', { count: 'exact' }).eq('version_id', activeVersion.id),
      supabase.from('orders').select('total').eq('version_id', activeVersion.id),
      supabase.from('customers').select('id', { count: 'exact' }).eq('version_id', activeVersion.id),
      supabase.from('products').select('*').eq('version_id', activeVersion.id).filter('stock_quantity', 'lte', 10),
    ]);

    const totalRevenue = orders.data?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;

    setStats({
      totalProducts: products.count || 0,
      totalOrders: orders.data?.length || 0,
      totalCustomers: customers.count || 0,
      totalRevenue,
      lowStockProducts: lowStock.data?.length || 0,
    });

    if (lowStock.data) setLowStockItems(lowStock.data);
  };

  const statCards = [
    { title: 'المنتجات', value: stats.totalProducts, icon: Package, color: 'text-primary' },
    { title: 'الطلبات', value: stats.totalOrders, icon: ShoppingCart, color: 'text-secondary' },
    { title: 'العملاء', value: stats.totalCustomers, icon: Users, color: 'text-primary' },
    { title: 'الإيرادات', value: `${stats.totalRevenue.toFixed(2)} ج.م`, icon: TrendingUp, color: 'text-secondary' },
  ];

  if (!activeVersion) {
    return <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">الإحصائيات</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} className="border-2 border-border hover:border-primary/20 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-xl bg-muted ${stat.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <Card className="border-2 border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              تنبيه المخزون المنخفض ({lowStockItems.length} منتج)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lowStockItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-background"
                >
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">#{item.code}</p>
                  </div>
                  <span className={`font-bold ${item.stock_quantity === 0 ? 'text-destructive' : 'text-amber-500'}`}>
                    {item.stock_quantity} متبقي
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Stats;
