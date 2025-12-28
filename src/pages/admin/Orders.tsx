import { useEffect, useState } from 'react';
import { Eye, Edit2, Trash2, FileText, Search, ShoppingCart, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import logoImage from '@/assets/babyland-logo.jpg';

interface OrderItem {
  id: string;
  product_id: string;
  product_code: string;
  product_name: string;
  product_description: string | null;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  order_number: number;
  customer_name: string;
  shop_name: string | null;
  phone: string;
  address: string | null;
  delivery_date: string | null;
  shipping_company: string | null;
  deposit_method: string | null;
  deposit_amount: number;
  subtotal: number;
  total: number;
  status: string;
  created_at: string;
  extra_info: string | null;
  items?: OrderItem[];
}

const statusLabels: Record<string, string> = {
  pending: 'قيد الانتظار',
  confirmed: 'مؤكد',
  shipped: 'تم الشحن',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
};

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

// Helper to get description multiplier (e.g., "250/10" => 10)
const getDescriptionMultiplier = (description: string | null): number => {
  if (!description) return 1;
  const match = description.match(/(\d+)\/(\d+)/);
  if (match) {
    return parseInt(match[2]);
  }
  return 1;
};

// Calculate item total with description multiplier
const calculateItemTotal = (item: OrderItem): number => {
  const multiplier = getDescriptionMultiplier(item.product_description);
  return item.price * item.quantity * multiplier;
};

const Orders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [searchCode, setSearchCode] = useState('');
  const [addProductCode, setAddProductCode] = useState('');

  useEffect(() => {
    loadOrders();

    const channel = supabase
      .channel('orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('order_number', { ascending: false });

    if (error) {
      toast.error('فشل في تحميل الطلبات');
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  };

  const loadOrderItems = async (orderId: string) => {
    const { data } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);
    return data || [];
  };

  const handleView = async (order: Order) => {
    const items = await loadOrderItems(order.id);
    setSelectedOrder({ ...order, items });
    setViewDialogOpen(true);
  };

  const handleEdit = async (order: Order) => {
    const items = await loadOrderItems(order.id);
    setSelectedOrder({ ...order, items });
    setEditDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الطلب؟')) return;

    // First get order items to restore stock
    const items = await loadOrderItems(id);
    
    // Restore stock for all items
    for (const item of items) {
      const { data: product } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
      if (product) {
        await supabase.from('products').update({
          stock_quantity: product.stock_quantity + item.quantity
        }).eq('id', item.product_id);
      }
    }

    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) {
      toast.error('فشل في حذف الطلب');
    } else {
      // Reset order number sequence to continue from max existing order number
      await supabase.rpc('reset_order_number_sequence');
      toast.success('تم حذف الطلب');
      loadOrders();
    }
  };

  const handleAddProductToOrder = async () => {
    if (!selectedOrder || !addProductCode.trim()) return;

    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('code', addProductCode.trim())
      .maybeSingle();

    if (productError || !product) {
      toast.error('المنتج غير موجود');
      return;
    }

    // Deduct stock
    await supabase.from('products').update({
      stock_quantity: product.stock_quantity - 1
    }).eq('id', product.id);

    const { error } = await supabase.from('order_items').insert({
      order_id: selectedOrder.id,
      product_id: product.id,
      product_code: product.code,
      product_name: product.name,
      product_description: product.description,
      price: product.price,
      quantity: 1,
    });

    if (error) {
      toast.error('فشل في إضافة المنتج');
      // Restore stock on failure
      await supabase.from('products').update({
        stock_quantity: product.stock_quantity
      }).eq('id', product.id);
    } else {
      toast.success('تم إضافة المنتج');
      const items = await loadOrderItems(selectedOrder.id);
      setSelectedOrder({ ...selectedOrder, items });
      setAddProductCode('');
      
      // Update order totals with description multiplier
      const newSubtotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
      await supabase.from('orders').update({
        subtotal: newSubtotal,
        total: newSubtotal - selectedOrder.deposit_amount,
      }).eq('id', selectedOrder.id);
      
      loadOrders();
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!selectedOrder) return;

    // Get item to restore stock
    const itemToRemove = selectedOrder.items?.find(i => i.id === itemId);
    
    const { error } = await supabase.from('order_items').delete().eq('id', itemId);
    if (error) {
      toast.error('فشل في حذف المنتج');
    } else {
      // Restore stock
      if (itemToRemove) {
        const { data: product } = await supabase.from('products').select('stock_quantity').eq('id', itemToRemove.product_id).single();
        if (product) {
          await supabase.from('products').update({
            stock_quantity: product.stock_quantity + itemToRemove.quantity
          }).eq('id', itemToRemove.product_id);
        }
      }
      
      const items = await loadOrderItems(selectedOrder.id);
      setSelectedOrder({ ...selectedOrder, items });
      
      // Update order totals with description multiplier
      const newSubtotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
      await supabase.from('orders').update({
        subtotal: newSubtotal,
        total: newSubtotal - selectedOrder.deposit_amount,
      }).eq('id', selectedOrder.id);
      
      loadOrders();
    }
  };

  const handleUpdateItemQuantity = async (itemId: string, quantity: number) => {
    if (!selectedOrder || quantity < 1) return;

    // Get current item to calculate stock difference
    const currentItem = selectedOrder.items?.find(i => i.id === itemId);
    if (!currentItem) return;
    
    const quantityDiff = quantity - currentItem.quantity;
    
    // Update stock (negative diff means more items, so deduct; positive means fewer items, so restore)
    const { data: product } = await supabase.from('products').select('stock_quantity').eq('id', currentItem.product_id).single();
    if (product) {
      await supabase.from('products').update({
        stock_quantity: product.stock_quantity - quantityDiff
      }).eq('id', currentItem.product_id);
    }

    const { error } = await supabase.from('order_items').update({ quantity }).eq('id', itemId);
    if (error) {
      toast.error('فشل في تحديث الكمية');
      // Restore stock on failure
      if (product) {
        await supabase.from('products').update({
          stock_quantity: product.stock_quantity
        }).eq('id', currentItem.product_id);
      }
    } else {
      const items = await loadOrderItems(selectedOrder.id);
      setSelectedOrder({ ...selectedOrder, items });
      
      // Update order totals with description multiplier
      const newSubtotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
      await supabase.from('orders').update({
        subtotal: newSubtotal,
        total: newSubtotal - selectedOrder.deposit_amount,
      }).eq('id', selectedOrder.id);
      
      loadOrders();
    }
  };

  const generateInvoice = (order: Order) => {
    if (!order.items) return;

    // Calculate totals with description multiplier
    const calculatedSubtotal = order.items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
    const calculatedTotal = calculatedSubtotal - order.deposit_amount;

    const invoiceHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>فاتورة رقم ${order.order_number}</title>
        <style>
          body { font-family: 'Cairo', Arial, sans-serif; padding: 20px; direction: rtl; }
          .header { text-align: center; margin-bottom: 30px; }
          .header img { width: 120px; height: 120px; object-fit: contain; border-radius: 50%; margin-bottom: 10px; }
          .header h1 { color: #00bfff; margin: 0; }
          .header p { color: #ff69b4; }
          .info { margin-bottom: 20px; }
          .info p { margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
          th { background: #00bfff; color: white; }
          .totals { text-align: left; }
          .totals p { margin: 5px 0; }
          .totals .total { font-size: 1.2em; font-weight: bold; color: #00bfff; }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="${logoImage}" alt="Babyland Logo" />
          <h1>Babyland</h1>
          <p>Kids in Style</p>
          <h2>فاتورة رقم ${order.order_number}</h2>
        </div>
        <div class="info">
          <p><strong>العميل:</strong> ${order.customer_name}</p>
          ${order.shop_name ? `<p><strong>المحل:</strong> ${order.shop_name}</p>` : ''}
          <p><strong>الهاتف:</strong> ${order.phone}</p>
          ${order.address ? `<p><strong>العنوان:</strong> ${order.address}</p>` : ''}
          <p><strong>التاريخ:</strong> ${new Date(order.created_at).toLocaleDateString('ar-EG')}</p>
          ${order.extra_info ? `<p><strong>ملاحظات:</strong> ${order.extra_info}</p>` : ''}
        </div>
        <table>
          <thead>
            <tr>
              <th>الكود</th>
              <th>المنتج</th>
              <th>السعر</th>
              <th>الكمية</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${[...order.items].sort((a, b) => a.product_code.localeCompare(b.product_code, undefined, { numeric: true })).map(item => {
              // Parse description for quantity calculation (e.g., "200/20" means pack of 20)
              let displayQuantity = item.quantity;
              const multiplier = getDescriptionMultiplier(item.product_description);
              if (multiplier > 1) {
                displayQuantity = item.quantity * multiplier;
              }
              const itemTotal = calculateItemTotal(item);
              return `
                <tr>
                  <td>${item.product_code}</td>
                  <td>${item.product_name}</td>
                  <td>${item.price} ج.م</td>
                  <td>${displayQuantity}</td>
                  <td>${itemTotal.toFixed(2)} ج.م</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        <div class="totals">
          <p>الإجمالي الفرعي: ${calculatedSubtotal.toFixed(2)} ج.م</p>
          ${order.deposit_amount > 0 ? `<p>العربون (${order.deposit_method}): -${order.deposit_amount.toFixed(2)} ج.م</p>` : ''}
          <p class="total">المطلوب: ${calculatedTotal.toFixed(2)} ج.م</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(invoiceHtml);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const filteredOrders = searchCode
    ? orders.filter((o) => 
        o.order_number.toString().includes(searchCode) ||
        o.phone.includes(searchCode) ||
        o.customer_name.toLowerCase().includes(searchCode.toLowerCase())
      )
    : orders;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">الطلبات</h1>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="بحث برقم الطلب أو الهاتف أو الاسم..."
          value={searchCode}
          onChange={(e) => setSearchCode(e.target.value)}
          className="pr-10"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
      ) : filteredOrders.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-12">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">لا توجد طلبات</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <Card key={order.id} className="hover:shadow-baby transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-3xl font-bold text-primary">#{order.order_number}</div>
                    <div>
                      <p className="font-bold">{order.customer_name}</p>
                      <p className="text-sm text-muted-foreground">{order.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-left">
                      <Badge className={statusColors[order.status]}>{statusLabels[order.status]}</Badge>
                      <p className="text-lg font-bold text-primary mt-1">{order.total.toFixed(2)} ج.م</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleView(order)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleEdit(order)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={async () => {
                        const items = await loadOrderItems(order.id);
                        generateInvoice({ ...order, items });
                      }}>
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleDelete(order.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Order Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>طلب رقم #{selectedOrder?.order_number}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><strong>العميل:</strong> {selectedOrder.customer_name}</div>
                <div><strong>الهاتف:</strong> {selectedOrder.phone}</div>
                {selectedOrder.shop_name && <div><strong>المحل:</strong> {selectedOrder.shop_name}</div>}
                {selectedOrder.address && <div><strong>العنوان:</strong> {selectedOrder.address}</div>}
                {selectedOrder.delivery_date && <div><strong>تاريخ التسليم:</strong> {selectedOrder.delivery_date}</div>}
                {selectedOrder.shipping_company && <div><strong>شركة الشحن:</strong> {selectedOrder.shipping_company}</div>}
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-3 text-right">المنتج</th>
                      <th className="p-3 text-right">السعر</th>
                      <th className="p-3 text-right">الكمية</th>
                      <th className="p-3 text-right">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items?.map((item) => {
                      const itemTotal = calculateItemTotal(item);
                      return (
                        <tr key={item.id} className="border-t">
                          <td className="p-3">
                            <p className="font-medium">{item.product_name}</p>
                            <p className="text-xs text-muted-foreground">#{item.product_code}</p>
                          </td>
                          <td className="p-3">{item.price} ج.م</td>
                          <td className="p-3">{item.quantity}</td>
                          <td className="p-3">{itemTotal.toFixed(2)} ج.م</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="text-left space-y-1">
                {(() => {
                  const calcSubtotal = selectedOrder.items?.reduce((sum, item) => sum + calculateItemTotal(item), 0) || 0;
                  const calcTotal = calcSubtotal - selectedOrder.deposit_amount;
                  return (
                    <>
                      <p>الإجمالي الفرعي: {calcSubtotal.toFixed(2)} ج.م</p>
                      {selectedOrder.deposit_amount > 0 && (
                        <p className="text-secondary">العربون: -{selectedOrder.deposit_amount.toFixed(2)} ج.م</p>
                      )}
                      <p className="text-xl font-bold text-primary">المطلوب: {calcTotal.toFixed(2)} ج.م</p>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Order Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تعديل طلب رقم #{selectedOrder?.order_number}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="أدخل كود المنتج"
                  value={addProductCode}
                  onChange={(e) => setAddProductCode(e.target.value)}
                  dir="ltr"
                />
                <Button onClick={handleAddProductToOrder} className="gap-2">
                  <Plus className="h-4 w-4" />
                  إضافة
                </Button>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-3 text-right">المنتج</th>
                      <th className="p-3 text-right">السعر</th>
                      <th className="p-3 text-right">الكمية</th>
                      <th className="p-3 text-right">الإجمالي</th>
                      <th className="p-3 text-right">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items?.map((item) => {
                      const itemTotal = calculateItemTotal(item);
                      return (
                        <tr key={item.id} className="border-t">
                          <td className="p-3">
                            <p className="font-medium">{item.product_name}</p>
                            <p className="text-xs text-muted-foreground">#{item.product_code}</p>
                          </td>
                          <td className="p-3">{item.price} ج.م</td>
                          <td className="p-3">
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItemQuantity(item.id, parseInt(e.target.value) || 1)}
                              className="w-20"
                              dir="ltr"
                            />
                          </td>
                          <td className="p-3 font-bold">{itemTotal.toFixed(2)} ج.م</td>
                          <td className="p-3">
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleRemoveItem(item.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="text-left space-y-1 border-t pt-4">
                {(() => {
                  const calcSubtotal = selectedOrder.items?.reduce((sum, item) => sum + calculateItemTotal(item), 0) || 0;
                  const calcTotal = calcSubtotal - selectedOrder.deposit_amount;
                  return (
                    <>
                      <p>الإجمالي الفرعي: {calcSubtotal.toFixed(2)} ج.م</p>
                      {selectedOrder.deposit_amount > 0 && (
                        <p className="text-secondary">العربون: -{selectedOrder.deposit_amount.toFixed(2)} ج.م</p>
                      )}
                      <p className="text-xl font-bold text-primary">المطلوب: {calcTotal.toFixed(2)} ج.م</p>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Orders;
