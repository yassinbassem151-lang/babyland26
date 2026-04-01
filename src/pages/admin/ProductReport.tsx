import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useVersion } from '@/contexts/VersionContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileSpreadsheet, Search, CheckSquare, Square } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import XLSX from 'xlsx-js-style';

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

  const generateReport = async () => {
    if (selectedCodes.size === 0) {
      toast({ title: 'اختر منتج واحد على الأقل', variant: 'destructive' });
      return;
    }

    setGenerating(true);
    try {
      const selectedProducts = products.filter(p => selectedCodes.has(p.id));
      const wb = XLSX.utils.book_new();

      for (const product of selectedProducts) {
        const multiplier = getMultiplier(product.description);

        // Get all order items for this product
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('quantity, product_description, order_id, created_at')
          .eq('product_id', product.id)
          .eq('version_id', currentVersion);

        // Get order details
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

        // Build sheet data
        const sheetData: (string | number)[][] = [
          ['معلومات المنتج', '', '', '', ''],
          ['الكود', product.code, '', '', ''],
          ['الاسم', product.name, '', '', ''],
          ['الوصف', product.description || '-', '', '', ''],
          ['الكمية الأولية', initialQuantity, '', '', ''],
          ['إجمالي المباع (قطع)', totalPiecesSold, '', '', ''],
          ['الكمية الحالية', product.stock_quantity, '', '', ''],
          [],
          ['تفاصيل الطلبات', '', '', '', ''],
          ['اسم العميل', 'رقم الطلب', 'الكمية', 'القطع', 'التاريخ'],
        ];

        for (const detail of orderDetails) {
          sheetData.push([
            detail.customer_name,
            detail.order_number,
            detail.quantity,
            detail.pieces,
            detail.created_at,
          ]);
        }

        if (orderDetails.length === 0) {
          sheetData.push(['لا توجد طلبات', '', '', '', '']);
        }

        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 15 }];
        ws['!margins'] = { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 };

        // Apply borders and styling to all cells for print
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        for (let R = range.s.r; R <= range.e.r; R++) {
          for (let C = range.s.c; C <= range.e.c; C++) {
            const addr = XLSX.utils.encode_cell({ r: R, c: C });
            if (!ws[addr]) ws[addr] = { v: '', t: 's' };
            const cell = ws[addr];
            const border = { style: 'thin', color: { rgb: '000000' } };
            cell.s = {
              border: { top: border, bottom: border, left: border, right: border },
              alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
              font: { name: 'Arial', sz: 11 },
            };
            // Header rows styling
            if (R === 0 || R === 8) {
              cell.s.font = { name: 'Arial', sz: 13, bold: true };
              cell.s.fill = { fgColor: { rgb: '4472C4' } };
              cell.s.font.color = { rgb: 'FFFFFF' };
            }
            // Table header row
            if (R === 9) {
              cell.s.font = { name: 'Arial', sz: 11, bold: true };
              cell.s.fill = { fgColor: { rgb: 'D9E2F3' } };
            }
            // Info label cells
            if (R >= 1 && R <= 6 && C === 0) {
              cell.s.font = { name: 'Arial', sz: 11, bold: true };
              cell.s.fill = { fgColor: { rgb: 'F2F2F2' } };
            }
          }
        }

        // Sanitize sheet name (max 31 chars, no special chars)
        const sheetName = product.code.replace(/[\\\/\?\*\[\]:]/g, '').slice(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetName || `product_${product.id.slice(0, 8)}`);
      }

      XLSX.writeFile(wb, `تقرير_المنتجات_${new Date().toLocaleDateString('ar-EG')}.xlsx`, { cellStyles: true });
      toast({ title: 'تم إنشاء التقرير بنجاح ✅' });
    } catch (error) {
      console.error(error);
      toast({ title: 'حدث خطأ أثناء إنشاء التقرير', variant: 'destructive' });
    }
    setGenerating(false);
  };

  const allSelected = filteredProducts.length > 0 && selectedCodes.size === filteredProducts.length;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">تقرير المنتجات</h1>
        <Button onClick={generateReport} disabled={generating || selectedCodes.size === 0}>
          <FileSpreadsheet className="h-4 w-4 ml-2" />
          {generating ? 'جاري الإنشاء...' : `إنشاء التقرير (${selectedCodes.size})`}
        </Button>
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
