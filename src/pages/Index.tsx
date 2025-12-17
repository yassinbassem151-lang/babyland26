import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';
import Header from '@/components/Header';
import QRScanner from '@/components/QRScanner';
import CartPreview from '@/components/CartPreview';
import ProductSearch from '@/components/ProductSearch';

const Index = () => {
  const { addItem } = useCart();

  const handleQRScan = useCallback(async (code: string) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('code', code)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        addItem({
          productId: data.id,
          code: data.code,
          name: data.name,
          description: data.description || '',
          price: data.price,
          imageUrl: data.image_url || undefined,
        });
        toast.success(`تمت إضافة "${data.name}" للسلة`);
      } else {
        toast.error('المنتج غير موجود');
      }
    } catch (err) {
      console.error('QR scan error:', err);
      toast.error('حدث خطأ في قراءة المنتج');
    }
  }, [addItem]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-baby-blue-light via-background to-baby-pink-light">
      <Header />
      
      <main className="container py-6 space-y-6">
        {/* Hero Section */}
        <div className="text-center space-y-2 py-4">
          <h1 className="text-3xl font-bold gradient-text">مرحباً بك في Babyland</h1>
          <p className="text-muted-foreground">امسح كود المنتج أو ابحث بالكود لإضافته للسلة</p>
        </div>

        {/* QR Scanner - Primary Action */}
        <section className="slide-up">
          <QRScanner onScan={handleQRScan} />
        </section>

        {/* Cart Preview */}
        <section className="slide-up" style={{ animationDelay: '0.1s' }}>
          <CartPreview />
        </section>

        {/* Product Search */}
        <section className="slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="rounded-2xl border-2 border-border bg-card p-4 shadow-baby">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-secondary" />
              البحث بكود المنتج
            </h2>
            <ProductSearch />
          </div>
        </section>

        {/* Decorative Elements */}
        <div className="fixed -bottom-20 -right-20 w-64 h-64 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        <div className="fixed -bottom-20 -left-20 w-64 h-64 rounded-full bg-secondary/5 blur-3xl pointer-events-none" />
      </main>
    </div>
  );
};

export default Index;
