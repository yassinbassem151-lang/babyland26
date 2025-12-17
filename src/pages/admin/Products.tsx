import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, QrCode, Search, Package } from 'lucide-react';
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

const Products = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchCode, setSearchCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

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

  const generateQR = async (product: Product) => {
    try {
      const url = await QRCode.toDataURL(product.code, {
        width: 300,
        margin: 2,
        color: { dark: '#00bfff', light: '#ffffff' },
      });
      setQrImageUrl(url);
      setSelectedProduct(product);
      setQrDialogOpen(true);
    } catch (err) {
      toast.error('فشل في إنشاء QR');
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">المنتجات</h1>
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
            <img src={qrImageUrl} alt="QR Code" className="w-64 h-64" />
            <p className="mt-2 text-lg font-bold">#{selectedProduct?.code}</p>
            <Button
              className="mt-4"
              onClick={() => {
                const link = document.createElement('a');
                link.download = `qr-${selectedProduct?.code}.png`;
                link.href = qrImageUrl;
                link.click();
              }}
            >
              تحميل QR
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;
