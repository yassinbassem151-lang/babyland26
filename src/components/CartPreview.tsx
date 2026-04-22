import { Link } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCart, calculateItemTotal, getDescriptionMultiplier, CartItem } from '@/contexts/CartContext';
import ProductImage from '@/components/ProductImage';
import { useSalesControl, canAddProductToCart } from '@/hooks/use-sales-control';
import { useVersion } from '@/contexts/VersionContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const CartPreview = () => {
  const { items, removeItem, updateQuantity, subtotal, totalItems } = useCart();
  const salesControl = useSalesControl();
  const { activeVersion } = useVersion();

  const handleIncrease = async (item: CartItem) => {
    if (salesControl.mode !== 'unlimited') {
      let q = supabase.from('products').select('stock_quantity, description').eq('id', item.productId);
      if (activeVersion) q = q.eq('version_id', activeVersion.id);
      const { data } = await q.maybeSingle();
      if (data) {
        const check = canAddProductToCart(salesControl, data, 1, item.quantity);
        if (!check.allowed) {
          toast.error(check.reason || 'لا يمكن زيادة الكمية');
          return;
        }
      }
    }
    updateQuantity(item.id, item.quantity + 1);
  };

  if (items.length === 0) {
    return (
      <Card className="border-2 border-dashed border-muted">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="rounded-full bg-muted p-6 mb-4">
            <ShoppingBag className="h-12 w-12 text-muted-foreground" />
          </div>
          <p className="text-lg font-medium text-muted-foreground">السلة فارغة</p>
          <p className="text-sm text-muted-foreground mt-1">امسح كود QR أو ابحث بكود المنتج</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-primary/20 shadow-baby">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            السلة
          </span>
          <span className="text-sm font-normal text-muted-foreground">
            {totalItems} منتج
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="max-h-[400px] overflow-y-auto space-y-3 pe-1">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex gap-3 rounded-xl bg-muted/50 p-3 animate-fade-in"
            >
              <ProductImage imageUrl={item.imageUrl} alt={item.name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">#{item.code}</p>
                <h4 className="font-medium truncate">{item.name}</h4>
                <p className="text-sm text-muted-foreground">{item.description}</p>
                <p className="text-sm font-bold text-primary">
                  {getDescriptionMultiplier(item.description) > 1 
                    ? `${item.price} × ${getDescriptionMultiplier(item.description)} = ${calculateItemTotal({ ...item, quantity: 1 })} ج.م`
                    : `${item.price} ج.م`
                  }
                </p>
              </div>
              <div className="flex flex-col items-end justify-between">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => removeItem(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center font-medium">{item.quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleIncrease(item)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-3">
          <div className="flex items-center justify-between text-lg font-bold">
            <span>الإجمالي</span>
            <span className="text-primary">{subtotal.toFixed(2)} ج.م</span>
          </div>
        </div>

        <Link to="/checkout">
          <Button className="w-full rounded-xl py-6 text-lg font-bold bg-gradient-to-l from-primary to-secondary shadow-baby-lg hover:shadow-pink transition-all">
            متابعة الطلب
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
};

export default CartPreview;
