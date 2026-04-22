import { useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { useVersion } from '@/contexts/VersionContext';
import { toast } from 'sonner';
import ProductImage from '@/components/ProductImage';
import { useSalesControl, canAddProductToCart } from '@/hooks/use-sales-control';

interface Product {
  id: string;
  code: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  stock_quantity: number;
}

const ProductSearch = () => {
  const [searchCode, setSearchCode] = useState('');
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const { addItem, items } = useCart();
  const { activeVersion } = useVersion();
  const salesControl = useSalesControl();

  const handleSearch = async () => {
    if (!searchCode.trim()) {
      toast.error('أدخل كود المنتج');
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from('products')
        .select('*')
        .eq('code', searchCode.trim());
      
      if (activeVersion) {
        query = query.eq('version_id', activeVersion.id);
      }
      
      const { data, error } = await query.maybeSingle();

      if (error) throw error;

      if (data) {
        setProduct(data);
      } else {
        setProduct(null);
        toast.error('المنتج غير موجود');
      }
    } catch (err) {
      console.error('Search error:', err);
      toast.error('حدث خطأ في البحث');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    if (!product) return;

    const alreadyInCart =
      items.find((it) => it.productId === product.id)?.quantity || 0;
    const check = canAddProductToCart(salesControl, product, 1, alreadyInCart);
    if (!check.allowed) {
      toast.error(check.reason || 'لا يمكن إضافة هذا المنتج للسلة');
      return;
    }

    addItem({
      productId: product.id,
      code: product.code,
      name: product.name,
      description: product.description || '',
      price: product.price,
      imageUrl: product.image_url || undefined,
    });

    toast.success('تمت إضافة المنتج للسلة');
    setProduct(null);
    setSearchCode('');
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="أدخل كود المنتج..."
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pr-10 rounded-xl border-2 focus:border-primary h-12"
            dir="ltr"
          />
        </div>
        <Button
          onClick={handleSearch}
          disabled={loading}
          className="rounded-xl px-6 h-12 bg-primary hover:bg-primary/90"
        >
          {loading ? 'جاري البحث...' : 'بحث'}
        </Button>
      </div>

      {product && (
        <Card className="overflow-hidden border-2 border-primary/20 animate-scale-in">
          <CardContent className="p-4">
            <div className="flex gap-4">
              <ProductImage imageUrl={product.image_url} alt={product.name} size="md" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">#{product.code}</p>
                <h3 className="font-bold text-lg">{product.name}</h3>
                {product.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>
                )}
                <div className="mt-2">
                  <span className="text-xl font-bold text-primary">{product.price} ج.م</span>
                </div>
              </div>
            </div>
            <Button
              onClick={handleAddToCart}
              className="w-full mt-4 rounded-xl gap-2 bg-secondary hover:bg-secondary/90"
            >
              <Plus className="h-5 w-5" />
              إضافة للسلة
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProductSearch;
