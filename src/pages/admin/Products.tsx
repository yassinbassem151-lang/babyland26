import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, QrCode, Search, Package, Printer, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import QRCode from 'qrcode';

interface Product {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price: number;
  stock_quantity: number;
  low_stock_threshold: number;
}

// XPrinter XP-370B dimensions in mm (1.57" x 0.79" with 0.05" margins)
const LABEL_WIDTH_MM = 39.88; // 1.57 inches
const LABEL_HEIGHT_MM = 20.07; // 0.79 inches
const MARGIN_MM = 1.27; // 0.05 inches

const Products = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchCode, setSearchCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [selectedForPrint, setSelectedForPrint] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    price: 0,
    stock_quantity: 0,
    low_stock_threshold: 10,
  });

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('فشل في تحميل المنتجات');
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  const filteredProducts = searchCode
    ? products.filter((p) => p.code.toLowerCase().includes(searchCode.toLowerCase()))
    : products;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.code || !formData.name) {
      toast.error('الكود والاسم مطلوبان');
      return;
    }

    try {
      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(formData)
          .eq('id', editingProduct.id);

        if (error) throw error;
        toast.success('تم تحديث المنتج');
      } else {
        const { error } = await supabase.from('products').insert(formData);
        if (error) throw error;
        toast.success('تم إضافة المنتج');
      }

      setDialogOpen(false);
      resetForm();
      loadProducts();
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ');
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      code: product.code,
      name: product.name,
      description: product.description || '',
      price: product.price,
      stock_quantity: product.stock_quantity,
      low_stock_threshold: product.low_stock_threshold,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;

    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      toast.error('فشل في حذف المنتج');
    } else {
      toast.success('تم حذف المنتج');
      loadProducts();
    }
  };

  const generateQRDataUrl = async (code: string): Promise<string> => {
    return await QRCode.toDataURL(code, {
      width: 80,
      margin: 0,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    });
  };

  const generateQR = async (product: Product) => {
    try {
      const url = await generateQRDataUrl(product.code);
      setQrImageUrl(url);
      setSelectedProduct(product);
      setQrDialogOpen(true);
    } catch (err) {
      toast.error('فشل في إنشاء QR');
    }
  };

  const printSingleLabel = async (product: Product) => {
    try {
      const qrDataUrl = await generateQRDataUrl(product.code);
      printLabels([{ product, qrDataUrl }]);
    } catch (err) {
      toast.error('فشل في طباعة الباركود');
    }
  };

  const printSelectedLabels = async () => {
    if (selectedForPrint.size === 0) {
      toast.error('يرجى اختيار منتج واحد على الأقل');
      return;
    }

    try {
      const labelData = await Promise.all(
        Array.from(selectedForPrint).map(async (id) => {
          const product = products.find(p => p.id === id);
          if (!product) return null;
          const qrDataUrl = await generateQRDataUrl(product.code);
          return { product, qrDataUrl };
        })
      );

      const validLabels = labelData.filter(Boolean) as { product: Product; qrDataUrl: string }[];
      printLabels(validLabels);
      setPrintDialogOpen(false);
      setSelectedForPrint(new Set());
    } catch (err) {
      toast.error('فشل في طباعة الباركودات');
    }
  };

  const printAllLabels = async () => {
    try {
      const labelData = await Promise.all(
        filteredProducts.map(async (product) => {
          const qrDataUrl = await generateQRDataUrl(product.code);
          return { product, qrDataUrl };
        })
      );
      printLabels(labelData);
      setPrintDialogOpen(false);
    } catch (err) {
      toast.error('فشل في طباعة الباركودات');
    }
  };

  const printLabels = (labels: { product: Product; qrDataUrl: string }[]) => {
    const labelsHtml = labels.map(({ product, qrDataUrl }) => `
      <div class="label">
        <div class="qr-container">
          <img src="${qrDataUrl}" alt="QR" class="qr-code" />
        </div>
        <div class="info">
          <div class="code">${product.code}</div>
          <div class="price">${product.price} ج.م</div>
        </div>
      </div>
    `).join('');

    const printHtml = `
      <!DOCTYPE html>
      <html dir="ltr" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>طباعة الباركود</title>
        <style>
          @page {
            size: ${LABEL_WIDTH_MM}mm ${LABEL_HEIGHT_MM}mm;
            margin: 0;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          html, body {
            width: ${LABEL_WIDTH_MM}mm;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: Arial, sans-serif;
          }
          .label {
            width: ${LABEL_WIDTH_MM}mm;
            height: ${LABEL_HEIGHT_MM}mm;
            padding: ${MARGIN_MM}mm;
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: flex-start;
            gap: 2mm;
            page-break-after: always;
            overflow: hidden;
          }
          .label:last-child {
            page-break-after: auto;
          }
          .qr-container {
            flex-shrink: 0;
            width: 16mm;
            height: 16mm;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .qr-code {
            width: 16mm;
            height: 16mm;
            object-fit: contain;
          }
          .info {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: flex-start;
            gap: 1mm;
            min-width: 0;
            text-align: left;
          }
          .code {
            font-size: 9pt;
            font-weight: bold;
            color: #000;
            white-space: nowrap;
          }
          .price {
            font-size: 9pt;
            font-weight: bold;
            color: #000;
            white-space: nowrap;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        ${labelsHtml}
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printHtml);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 300);
    }
  };

  const toggleSelectProduct = (id: string) => {
    const newSelected = new Set(selectedForPrint);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedForPrint(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedForPrint.size === filteredProducts.length) {
      setSelectedForPrint(new Set());
    } else {
      setSelectedForPrint(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const resetForm = () => {
    setEditingProduct(null);
    setFormData({
      code: '',
      name: '',
      description: '',
      price: 0,
      stock_quantity: 0,
      low_stock_threshold: 10,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">المنتجات</h1>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setPrintDialogOpen(true)}>
            <Printer className="h-4 w-4" />
            طباعة الباركود
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                إضافة منتج
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingProduct ? 'تعديل المنتج' : 'إضافة منتج جديد'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>الكود *</Label>
                    <Input
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <Label>السعر *</Label>
                    <Input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                      dir="ltr"
                    />
                  </div>
                </div>
                <div>
                  <Label>الاسم *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>الوصف</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>الكمية</Label>
                    <Input
                      type="number"
                      value={formData.stock_quantity}
                      onChange={(e) => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) || 0 })}
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <Label>حد التنبيه</Label>
                    <Input
                      type="number"
                      value={formData.low_stock_threshold}
                      onChange={(e) => setFormData({ ...formData, low_stock_threshold: parseInt(e.target.value) || 10 })}
                      dir="ltr"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full">
                  {editingProduct ? 'تحديث' : 'إضافة'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="بحث بالكود..."
          value={searchCode}
          onChange={(e) => setSearchCode(e.target.value)}
          className="pr-10"
          dir="ltr"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
      ) : filteredProducts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">لا توجد منتجات</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="overflow-hidden hover:shadow-baby transition-shadow">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
                    <Package className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">#{product.code}</p>
                    <h3 className="font-bold truncate">{product.name}</h3>
                    {product.description && (
                      <p className="text-xs text-muted-foreground truncate">{product.description}</p>
                    )}
                    <p className="text-sm text-primary font-bold">{product.price} ج.م</p>
                    <p className={`text-xs ${product.stock_quantity <= product.low_stock_threshold ? 'text-destructive' : 'text-muted-foreground'}`}>
                      المخزون: {product.stock_quantity}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" onClick={() => generateQR(product)}>
                    <QrCode className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => printSingleLabel(product)}>
                    <Printer className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleEdit(product)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleDelete(product.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>QR Code - {selectedProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-4">
            <div className="border-2 border-border rounded-lg p-4 bg-white">
              <img src={qrImageUrl} alt="QR Code" className="w-32 h-32 mx-auto" />
              <div className="mt-2 text-center">
                <p className="text-lg font-bold text-black">#{selectedProduct?.code}</p>
                <p className="text-sm text-gray-600 truncate max-w-[180px]">{selectedProduct?.name}</p>
                <p className="text-md font-bold text-black">{selectedProduct?.price} ج.م</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  const link = document.createElement('a');
                  link.download = `qr-${selectedProduct?.code}.png`;
                  link.href = qrImageUrl;
                  link.click();
                }}
              >
                تحميل QR
              </Button>
              <Button onClick={() => selectedProduct && printSingleLabel(selectedProduct)}>
                <Printer className="h-4 w-4 ml-2" />
                طباعة
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print Selection Dialog */}
      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>طباعة الباركود</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 mb-4">
            <Button onClick={printAllLabels} className="gap-2">
              <Printer className="h-4 w-4" />
              طباعة الكل ({filteredProducts.length})
            </Button>
            <Button variant="outline" onClick={printSelectedLabels} className="gap-2">
              <Printer className="h-4 w-4" />
              طباعة المحدد ({selectedForPrint.size})
            </Button>
            <Button variant="ghost" onClick={toggleSelectAll} className="gap-2">
              {selectedForPrint.size === filteredProducts.length ? (
                <CheckSquare className="h-4 w-4" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              تحديد الكل
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedForPrint.has(product.id) ? 'bg-primary/10 border-primary' : 'hover:bg-muted'
                }`}
                onClick={() => toggleSelectProduct(product.id)}
              >
                <div className="flex-shrink-0">
                  {selectedForPrint.has(product.id) ? (
                    <CheckSquare className="h-5 w-5 text-primary" />
                  ) : (
                    <Square className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{product.name}</p>
                  <p className="text-sm text-muted-foreground">#{product.code} - {product.price} ج.م</p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;