import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useVersion } from '@/contexts/VersionContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileSpreadsheet, Search, CheckSquare, Square } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

interface Product {
  id: string;
  code: string;
  name: string;
  description: string | null;
  stock_quantity: number;
}

interface OrderDetail {
  customer_name: string;
  order_number: number;
  quantity: number;
  created_at: string;
  pieces: number;
}

const ProductReport = () => {
  const { activeVersion } = useVersion();
  const currentVersion = activeVersion?.id;
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (currentVersion) loadProducts();
  }, [currentVersion]);

  const loadProducts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('products')
      .select('id, code, name, description, stock_quantity')
      .eq('version_id', currentVersion)
      .order('code');
    setProducts(data || []);
    setLoading(false);
  };

  const filteredProducts = products.filter(p =>
    p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleCode = (id: string) => {
    const next = new Set(selectedCodes);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedCodes(next);
  };

  const toggleAll = () => {
    if (selectedCodes.size === filteredProducts.length) {
      setSelectedCodes(new Set());
    } else {
      setSelectedCodes(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const getMultiplier = (description: string | null): number => {
    if (!description) return 1;
    const match = description.match(/\/(\d+)$/);
    return match ? parseInt(match[1]) : 1;
  };

  const fetchProductData = async (product: Product) => {
    const multiplier = getMultiplier(product.description);
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('quantity, product_description, order_id, created_at')
      .eq('product_id', product.id)
      .eq('version_id', currentVersion);

    const orderDetails: OrderDetail[] = [];
    let totalPiecesSold = 0;

    if (orderItems && orderItems.length > 0) {
      const orderIds = [...new Set(orderItems.map(oi => oi.order_id))];
      const { data: orders } = await supabase
        .from('orders')
        .select('id, customer_name, order_number, created_at')
        .in('id', orderIds);
      const ordersMap = new Map((orders || []).map(o => [o.id, o]));

      for (const item of orderItems) {
        const itemMultiplier = getMultiplier(item.product_description);
        const pieces = item.quantity * itemMultiplier;
        totalPiecesSold += pieces;
        const order = ordersMap.get(item.order_id);
        if (order) {
          orderDetails.push({
            customer_name: order.customer_name,
            order_number: order.order_number,
            quantity: item.quantity,
            pieces,
            created_at: new Date(order.created_at).toLocaleDateString('ar-EG'),
          });
        }
      }
    }

    const initialQuantity = product.stock_quantity + totalPiecesSold;
    return { orderDetails, totalPiecesSold, initialQuantity };
  };

  const applyStyles = (_ws: any, _range: any, _headerRows: number[]) => {
    // Styling requires xlsx-js-style; skipped with plain xlsx
  };

  const generateDetailedReport = async () => {
    if (selectedCodes.size === 0) {
      toast({ title: 'اختر منتج واحد على الأقل', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    try {
      const selectedProducts = products.filter(p => selectedCodes.has(p.id));
      const wb = XLSX.utils.book_new();
      const sheetData: (string | number)[][] = [
        ['الكود', 'الاسم', 'الكمية الأولية', 'إجمالي المباع', 'الكمية الحالية', 'اسم العميل', 'رقم الطلب', 'الكمية', 'القطع', 'التاريخ'],
      ];
      const headerRows = [0];

      for (const product of selectedProducts) {
        const { orderDetails, totalPiecesSold, initialQuantity } = await fetchProductData(product);

        if (orderDetails.length === 0) {
          sheetData.push([product.code, product.name, initialQuantity, totalPiecesSold, product.stock_quantity, 'لا توجد طلبات', '', '', '', '']);
        } else {
          orderDetails.forEach((detail, i) => {
            sheetData.push([
              i === 0 ? product.code : '',
              i === 0 ? product.name : '',
              i === 0 ? initialQuantity : '',
              i === 0 ? totalPiecesSold : '',
              i === 0 ? product.stock_quantity : '',
              detail.customer_name,
              detail.order_number,
              detail.quantity,
              detail.pieces,
              detail.created_at,
            ]);
          });
        }
        // separator row
        sheetData.push(['', '', '', '', '', '', '', '', '', '']);
      }

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 14 }];
      ws['!margins'] = { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      applyStyles(ws, range, headerRows);

      XLSX.utils.book_append_sheet(wb, ws, 'تقرير مفصل');
      XLSX.writeFile(wb, `تقرير_مفصل_${new Date().toLocaleDateString('ar-EG')}.xlsx`);
      toast({ title: 'تم إنشاء التقرير المفصل ✅' });
    } catch (error) {
      console.error(error);
      toast({ title: 'حدث خطأ أثناء إنشاء التقرير', variant: 'destructive' });
    }
    setGenerating(false);
  };

  const generateSummaryReport = async () => {
    if (selectedCodes.size === 0) {
      toast({ title: 'اختر منتج واحد على الأقل', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    try {
      const selectedProducts = products.filter(p => selectedCodes.has(p.id));
      const wb = XLSX.utils.book_new();
      const sheetData: (string | number)[][] = [
        ['الكود', 'الاسم', 'الكمية الأولية', 'الكمية المباعة', 'الكمية المتبقية'],
      ];

      for (const product of selectedProducts) {
        const { totalPiecesSold, initialQuantity } = await fetchProductData(product);
        sheetData.push([product.code, product.name, initialQuantity, totalPiecesSold, product.stock_quantity]);
      }

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
      ws['!margins'] = { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 };
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      applyStyles(ws, range, [0]);

      XLSX.utils.book_append_sheet(wb, ws, 'ملخص المخزون');
      XLSX.writeFile(wb, `ملخص_المخزون_${new Date().toLocaleDateString('ar-EG')}.xlsx`);
      toast({ title: 'تم إنشاء ملخص المخزون ✅' });
    } catch (error) {
      console.error(error);
      toast({ title: 'حدث خطأ أثناء إنشاء التقرير', variant: 'destructive' });
    }
    setGenerating(false);
  };

  const allSelected = filteredProducts.length > 0 && selectedCodes.size === filteredProducts.length;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">تقرير المنتجات</h1>
        <div className="flex gap-2">
          <Button onClick={generateDetailedReport} disabled={generating || selectedCodes.size === 0}>
            <FileSpreadsheet className="h-4 w-4 ml-2" />
            {generating ? 'جاري...' : `تقرير مفصل (${selectedCodes.size})`}
          </Button>
          <Button onClick={generateSummaryReport} disabled={generating || selectedCodes.size === 0} variant="outline">
            <FileSpreadsheet className="h-4 w-4 ml-2" />
            {generating ? 'جاري...' : `ملخص المخزون (${selectedCodes.size})`}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالكود أو الاسم..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
            <Button variant="outline" onClick={toggleAll} className="shrink-0">
              {allSelected ? <CheckSquare className="h-4 w-4 ml-2" /> : <Square className="h-4 w-4 ml-2" />}
              {allSelected ? 'إلغاء الكل' : 'تحديد الكل'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">جاري التحميل...</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto">
              {filteredProducts.map(product => {
                const isSelected = selectedCodes.has(product.id);
                return (
                  <div
                    key={product.id}
                    onClick={() => toggleCode(product.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-primary/10 border-primary'
                        : 'hover:bg-muted border-border'
                    }`}
                  >
                    <Checkbox checked={isSelected} />
                    <div className="min-w-0">
                      <p className="font-mono font-bold text-sm truncate">{product.code}</p>
                      <p className="text-xs text-muted-foreground truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">المخزون: {product.stock_quantity}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductReport;
