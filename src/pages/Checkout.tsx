import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Package, CreditCard, Truck, User, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Header from '@/components/Header';

const depositMethods = [
  { value: 'cash', label: 'كاش' },
  { value: 'instapay', label: 'InstaPay' },
  { value: 'vodafone_cash', label: 'فودافون كاش' },
];

const Checkout = () => {
  const navigate = useNavigate();
  const { items, subtotal, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [isOldCustomer, setIsOldCustomer] = useState(false);
  const [existingCustomers, setExistingCustomers] = useState<any[]>([]);
  const [orderNumber, setOrderNumber] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    shopName: '',
    phone: '',
    address: '',
    deliveryDate: '',
    shippingCompany: '',
    depositMethod: '' as string,
    depositAmount: 0,
  });

  const loadExistingCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('is_new', false)
      .order('name');
    if (data) setExistingCustomers(data);
  };

  const handleOldCustomerToggle = async () => {
    if (!isOldCustomer) {
      await loadExistingCustomers();
    }
    setIsOldCustomer(!isOldCustomer);
  };

  const handleCustomerSelect = (customerId: string) => {
    const customer = existingCustomers.find(c => c.id === customerId);
    if (customer) {
      setFormData({
        ...formData,
        name: customer.name,
        shopName: customer.shop_name || '',
        phone: customer.phone,
        address: customer.address || '',
      });
    }
  };

  const total = subtotal - formData.depositAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (items.length === 0) {
      toast.error('السلة فارغة');
      return;
    }

    if (!formData.name || !formData.phone) {
      toast.error('يرجى ملء الحقول المطلوبة');
      return;
    }

    setLoading(true);

    try {
      // Create or find customer
      let customerId: string | null = null;
      
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', formData.phone)
        .maybeSingle();

      if (existingCustomer) {
        customerId = existingCustomer.id;
        await supabase
          .from('customers')
          .update({ is_new: false })
          .eq('id', customerId);
      } else {
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            name: formData.name,
            shop_name: formData.shopName || null,
            phone: formData.phone,
            address: formData.address || null,
            is_new: !isOldCustomer,
          })
          .select('id')
          .single();

        if (customerError) throw customerError;
        customerId = newCustomer.id;
      }

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: customerId,
          customer_name: formData.name,
          shop_name: formData.shopName || null,
          phone: formData.phone,
          address: formData.address || null,
          delivery_date: formData.deliveryDate || null,
          shipping_company: formData.shippingCompany || null,
          deposit_method: formData.depositMethod || null,
          deposit_amount: formData.depositAmount,
          subtotal: subtotal,
          total: total,
        })
        .select('order_number')
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = items.map(item => ({
        order_id: order.order_number ? undefined : order.order_number,
        product_id: item.productId,
        product_code: item.code,
        product_name: item.name,
        product_description: item.description,
        price: item.price,
        quantity: item.quantity,
      }));

      // Get order ID first
      const { data: orderData } = await supabase
        .from('orders')
        .select('id')
        .eq('order_number', order.order_number)
        .single();

      if (orderData) {
        const orderItemsWithId = items.map(item => ({
          order_id: orderData.id,
          product_id: item.productId,
          product_code: item.code,
          product_name: item.name,
          product_description: item.description,
          price: item.price,
          quantity: item.quantity,
        }));

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItemsWithId);

        if (itemsError) throw itemsError;
      }

      setOrderNumber(order.order_number);
      clearCart();
      toast.success(`تم إرسال الطلب رقم ${order.order_number} بنجاح!`);
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error('حدث خطأ في إرسال الطلب');
    } finally {
      setLoading(false);
    }
  };

  if (orderNumber) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-baby-blue-light via-background to-baby-pink-light">
        <Header />
        <main className="container py-12">
          <Card className="max-w-md mx-auto text-center border-2 border-primary/20 shadow-baby-lg">
            <CardContent className="py-12">
              <div className="w-20 h-20 rounded-full bg-gradient-to-l from-primary to-secondary flex items-center justify-center mx-auto mb-6 animate-bounce-soft">
                <Check className="h-10 w-10 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold mb-2">تم إرسال طلبك بنجاح!</h1>
              <p className="text-muted-foreground mb-4">رقم الطلب الخاص بك</p>
              <div className="text-5xl font-bold gradient-text mb-8">{orderNumber}</div>
              <Button onClick={() => navigate('/')} className="w-full rounded-xl">
                العودة للرئيسية
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-baby-blue-light via-background to-baby-pink-light">
      <Header />
      
      <main className="container py-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-4 gap-2"
        >
          <ArrowRight className="h-4 w-4" />
          العودة للتسوق
        </Button>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Order Summary */}
          <Card className="border-2 border-primary/20 shadow-baby h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                ملخص الطلب
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">السلة فارغة</p>
              ) : (
                <>
                  {items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity} × {item.price} ج.م
                        </p>
                      </div>
                      <span className="font-bold">{(item.quantity * item.price).toFixed(2)} ج.م</span>
                    </div>
                  ))}
                  <div className="pt-4 space-y-2">
                    <div className="flex justify-between">
                      <span>الإجمالي الفرعي</span>
                      <span>{subtotal.toFixed(2)} ج.م</span>
                    </div>
                    {formData.depositAmount > 0 && (
                      <div className="flex justify-between text-secondary">
                        <span>العربون</span>
                        <span>- {formData.depositAmount.toFixed(2)} ج.م</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xl font-bold border-t pt-2">
                      <span>المطلوب</span>
                      <span className="text-primary">{total.toFixed(2)} ج.م</span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Checkout Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Customer Info */}
            <Card className="border-2 border-border">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    بيانات العميل
                  </span>
                  <Button
                    type="button"
                    variant={isOldCustomer ? 'default' : 'outline'}
                    size="sm"
                    onClick={handleOldCustomerToggle}
                  >
                    {isOldCustomer ? 'عميل قديم' : 'عميل جديد'}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isOldCustomer && existingCustomers.length > 0 && (
                  <div>
                    <Label>اختر عميل</Label>
                    <Select onValueChange={handleCustomerSelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر من العملاء السابقين" />
                      </SelectTrigger>
                      <SelectContent>
                        {existingCustomers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name} - {customer.phone}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="name">الاسم *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="shopName">اسم المحل</Label>
                    <Input
                      id="shopName"
                      value={formData.shopName}
                      onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">رقم الهاتف *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <Label htmlFor="address">العنوان</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shipping */}
            <Card className="border-2 border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-primary" />
                  الشحن
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="deliveryDate">تاريخ التسليم</Label>
                    <Input
                      id="deliveryDate"
                      type="date"
                      value={formData.deliveryDate}
                      onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <Label htmlFor="shippingCompany">شركة الشحن</Label>
                    <Input
                      id="shippingCompany"
                      value={formData.shippingCompany}
                      onChange={(e) => setFormData({ ...formData, shippingCompany: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment */}
            <Card className="border-2 border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  العربون
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>طريقة الدفع</Label>
                  <RadioGroup
                    value={formData.depositMethod}
                    onValueChange={(value) => setFormData({ ...formData, depositMethod: value })}
                    className="flex gap-4 mt-2"
                  >
                    {depositMethods.map((method) => (
                      <div key={method.value} className="flex items-center gap-2">
                        <RadioGroupItem value={method.value} id={method.value} />
                        <Label htmlFor={method.value} className="cursor-pointer">
                          {method.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
                <div>
                  <Label htmlFor="depositAmount">قيمة العربون</Label>
                  <Input
                    id="depositAmount"
                    type="number"
                    min="0"
                    max={subtotal}
                    value={formData.depositAmount || ''}
                    onChange={(e) => setFormData({ ...formData, depositAmount: parseFloat(e.target.value) || 0 })}
                    dir="ltr"
                  />
                </div>
              </CardContent>
            </Card>

            <Button
              type="submit"
              disabled={loading || items.length === 0}
              className="w-full py-6 text-lg font-bold rounded-xl bg-gradient-to-l from-primary to-secondary shadow-baby-lg hover:shadow-pink transition-all"
            >
              {loading ? 'جاري الإرسال...' : 'تأكيد الطلب'}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default Checkout;
