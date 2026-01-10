import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useVersion } from '@/contexts/VersionContext';

interface OrderWithProduct {
  order_id: string;
  order_number: number;
  customer_name: string;
  phone: string;
  quantity: number;
  price: number;
  total: number;
  created_at: string;
  status: string;
  product_description: string | null;
}

// Extract multiplier from description (e.g., "850/5" returns 5)
const getDescriptionMultiplier = (description: string | null | undefined): number => {
  if (!description) return 1;
  const match = description.match(/\/(\d+)/);
  return match ? parseInt(match[1], 10) : 1;
};

const SearchByCode = () => {
  const { activeVersion } = useVersion();
  const [searchCode, setSearchCode] = useState('');
  const [orders, setOrders] = useState<OrderWithProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState<string | null>(null);
  const [stockQuantity, setStockQuantity] = useState<number>(0);

  const handleSearch = async () => {
    if (!searchCode.trim()) {
      toast.error('الرجاء إدخال كود المنتج');
      return;
    }

    if (!activeVersion) {
      toast.error('يرجى اختيار نسخة أولاً');
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      // Get product name, description and stock
      const { data: product } = await supabase
        .from('products')
        .select('name, description, stock_quantity')
        .eq('code', searchCode.trim())
        .eq('version_id', activeVersion.id)
        .maybeSingle();

      setProductName(product?.name || searchCode.trim());
      setProductDescription(product?.description || null);
      setStockQuantity(product?.stock_quantity || 0);

      // Get all order items with this product code for this version
      const { data: orderItems, error } = await supabase
        .from('order_items')
        .select(`
          order_id,
          quantity,
          price,
          product_name,
          product_description
        `)
        .eq('product_code', searchCode.trim())
        .eq('version_id', activeVersion.id);

      if (error) throw error;

      if (!orderItems || orderItems.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      // Get order details for each order item
      const orderIds = [...new Set(orderItems.map(item => item.order_id))];
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, phone, created_at, status')
        .in('id', orderIds)
        .eq('version_id', activeVersion.id)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Combine order items with order details
      const combinedData: OrderWithProduct[] = orderItems.map(item => {
        const order = ordersData?.find(o => o.id === item.order_id);
        const itemMultiplier = getDescriptionMultiplier(item.product_description || product?.description);
        return {
          order_id: item.order_id,
          order_number: order?.order_number || 0,
          customer_name: order?.customer_name || '',
          phone: order?.phone || '',
          quantity: item.quantity,
          price: item.price,
          total: item.quantity * itemMultiplier * item.price,
          created_at: order?.created_at || '',
          status: order?.status || '',
          product_description: item.product_description
        };
      }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setOrders(combinedData);
      if (product?.name) {
        setProductName(product.name);
      }
    } catch (error) {
      console.error('Error searching:', error);
      toast.error('حدث خطأ أثناء البحث');
    } finally {
      setLoading(false);
    }
  };

  const totalQuantitySold = orders.reduce((sum, order) => sum + order.quantity, 0);
  const totalSales = orders.reduce((sum, order) => sum + order.total, 0);
  
  // Calculate total pieces using multiplier from product description
  const multiplier = getDescriptionMultiplier(productDescription);
  const totalPieces = totalQuantitySold * multiplier;

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'قيد الانتظار';
      case 'confirmed': return 'مؤكد';
      case 'shipped': return 'تم الشحن';
      case 'delivered': return 'تم التوصيل';
      case 'cancelled': return 'ملغي';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600';
      case 'confirmed': return 'text-blue-600';
      case 'shipped': return 'text-purple-600';
      case 'delivered': return 'text-green-600';
      case 'cancelled': return 'text-red-600';
      default: return '';
    }
  };

  if (!activeVersion) {
    return <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">البحث بالكود</h1>

      {/* Search Box */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Input
              placeholder="أدخل كود المنتج..."
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="h-4 w-4 ml-2" />
              {loading ? 'جاري البحث...' : 'بحث'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {searched && (
        <>
          {/* Summary Cards */}
          {orders.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">اسم المنتج</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold">{productName}</p>
                  {productDescription && (
                    <p className="text-sm text-muted-foreground mt-1">{productDescription}</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">المخزون</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-orange-600">{stockQuantity}</p>
                  <p className="text-sm text-muted-foreground">الكمية المتاحة</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">الكمية المباعة (الطلبات)</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-primary">{totalQuantitySold}</p>
                  <p className="text-sm text-muted-foreground">عدد الطلبات الفعلية</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">إجمالي القطع (الاكسل)</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-blue-600">{totalPieces} قطعة</p>
                  <p className="text-sm text-muted-foreground">
                    {totalQuantitySold} × {multiplier} = {totalPieces}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">إجمالي المبيعات</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600">{totalSales.toFixed(2)} ج.م</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Orders Table */}
          <Card>
            <CardHeader>
              <CardTitle>الطلبات ({orders.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  لا توجد طلبات تحتوي على هذا الكود
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">رقم الطلب</TableHead>
                      <TableHead className="text-right">العميل</TableHead>
                      <TableHead className="text-right">الهاتف</TableHead>
                      <TableHead className="text-right">الكمية</TableHead>
                      <TableHead className="text-right">القطع</TableHead>
                      <TableHead className="text-right">السعر</TableHead>
                      <TableHead className="text-right">الإجمالي</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order, index) => {
                      const itemMultiplier = getDescriptionMultiplier(order.product_description || productDescription);
                      const pieces = order.quantity * itemMultiplier;
                      return (
                        <TableRow key={`${order.order_id}-${index}`}>
                          <TableCell className="font-medium">#{order.order_number}</TableCell>
                          <TableCell>{order.customer_name}</TableCell>
                          <TableCell dir="ltr" className="text-right">{order.phone}</TableCell>
                          <TableCell>{order.quantity}</TableCell>
                          <TableCell className="text-blue-600 font-medium">{pieces}</TableCell>
                          <TableCell>{order.price.toFixed(2)} ج.م</TableCell>
                          <TableCell className="font-medium">{order.total.toFixed(2)} ج.م</TableCell>
                          <TableCell className={getStatusColor(order.status)}>
                            {getStatusText(order.status)}
                          </TableCell>
                          <TableCell>
                            {new Date(order.created_at).toLocaleDateString('ar-EG')}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default SearchByCode;
