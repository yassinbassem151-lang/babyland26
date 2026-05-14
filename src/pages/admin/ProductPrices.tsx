import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useVersion } from '@/contexts/VersionContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileSpreadsheet, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

interface Product {
  id: string;
  code: string;
  name: string;
  price: number;
}

const ProductPrices = () => {
  const { activeVersion } = useVersion();
  const currentVersion = activeVersion?.id;
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
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
      .select('id, code, name, price')
      .eq('version_id', currentVersion)
      .order('code');
    setProducts(data || []);
    setLoading(false);
  };

  const filteredProducts = products.filter(p =>
    p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const generateExcel = () => {
    if (filteredProducts.length === 0) {
      toast({ title: 'لا توجد منتجات للتصدير', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    try {
      const wb = XLSX.utils.book_new();
      const sheetData: (string | number)[][] = [
        ['الكود', 'الاسم', 'السعر'],
      ];

      for (const product of filteredProducts) {
        sheetData.push([product.code, product.name, Number(product.price)]);
      }

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws['!cols'] = [{ wch: 20 }, { wch: 35 }, { wch: 15 }];
      ws['!margins'] = { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 };

      XLSX.utils.book_append_sheet(wb, ws, 'أسعار المنتجات');
      XLSX.writeFile(wb, `أسعار_المنتجات_${new Date().toLocaleDateString('ar-EG')}.xlsx`);
      toast({ title: 'تم إنشاء ملف Excel ✅' });
    } catch (error) {
      console.error(error);
      toast({ title: 'حدث خطأ أثناء إنشاء الملف', variant: 'destructive' });
    }
    setGenerating(false);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">أسعار المنتجات</h1>
        <Button onClick={generateExcel} disabled={generating || filteredProducts.length === 0}>
          <FileSpreadsheet className="h-4 w-4 ml-2" />
          {generating ? 'جاري...' : 'تصدير Excel'}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالكود أو الاسم..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">جاري التحميل...</p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الكود</TableHead>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">السعر</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map(product => (
                    <TableRow key={product.id}>
                      <TableCell className="font-mono font-bold">{product.code}</TableCell>
                      <TableCell>{product.name}</TableCell>
                      <TableCell className="font-semibold">{Number(product.price).toFixed(2)} ج.م</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredProducts.length === 0 && (
                <p className="text-center text-muted-foreground py-8">لا توجد منتجات</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductPrices;
