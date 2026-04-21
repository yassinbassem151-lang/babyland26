import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useVersion } from '@/contexts/VersionContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Trash2, Undo2, FileSpreadsheet, Check, User, Package, X } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface OrderReturn {
  id: string;
  customer_name: string;
  shop_name: string | null;
  phone: string;
  address: string | null;
  product_code: string;
  product_name: string;
  product_description: string | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
  notes: string | null;
  created_at: string;
}

interface CustomerRow {
  id: string;
  name: string;
  shop_name: string | null;
  phone: string;
  address: string | null;
}

interface ProductRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price: number;
}

const emptyForm = {
  customer_name: '',
  shop_name: '',
  phone: '',
  address: '',
  product_code: '',
  product_name: '',
  product_description: '',
  quantity: 1,
  unit_price: 0,
  notes: '',
};

const OrdersReturn = () => {
  const { activeVersion } = useVersion();
  const [items, setItems] = useState<OrderReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Filters for export
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Customer search
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerRow[]>([]);
  const [customerSelected, setCustomerSelected] = useState(false);

  // Product search
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState<ProductRow[]>([]);
  const [productSelected, setProductSelected] = useState(false);

  // Confirmation/details after creation
  const [createdReturn, setCreatedReturn] = useState<OrderReturn | null>(null);

  const load = async () => {
    if (!activeVersion) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('order_returns')
      .select('*')
      .eq('version_id', activeVersion.id)
      .order('created_at', { ascending: false });
    if (error) toast.error('فشل تحميل البيانات');
    else setItems((data as OrderReturn[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [activeVersion?.id]);

  // Customer search
  useEffect(() => {
    if (!activeVersion) return;
    const q = customerQuery.trim();
    if (q.length < 2 || customerSelected) {
      setCustomerResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('customers')
        .select('id, name, shop_name, phone, address')
        .eq('version_id', activeVersion.id)
        .or(`name.ilike.%${q}%,shop_name.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(8);
      setCustomerResults((data as CustomerRow[]) || []);
    }, 250);
    return () => clearTimeout(t);
  }, [customerQuery, customerSelected, activeVersion?.id]);

  // Product search
  useEffect(() => {
    if (!activeVersion) return;
    const q = productQuery.trim();
    if (q.length < 1 || productSelected) {
      setProductResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('products')
        .select('id, code, name, description, price')
        .eq('version_id', activeVersion.id)
        .or(`code.ilike.%${q}%,name.ilike.%${q}%`)
        .limit(8);
      setProductResults((data as ProductRow[]) || []);
    }, 250);
    return () => clearTimeout(t);
  }, [productQuery, productSelected, activeVersion?.id]);

  const pickCustomer = (c: CustomerRow) => {
    setForm(prev => ({
      ...prev,
      customer_name: c.name,
      shop_name: c.shop_name || '',
      phone: c.phone,
      address: c.address || '',
    }));
    setCustomerQuery(`${c.name}${c.shop_name ? ' - ' + c.shop_name : ''}`);
    setCustomerSelected(true);
    setCustomerResults([]);
  };

  const clearCustomer = () => {
    setCustomerSelected(false);
    setCustomerQuery('');
    setForm(prev => ({ ...prev, customer_name: '', shop_name: '', phone: '', address: '' }));
  };

  const pickProduct = (p: ProductRow) => {
    setForm(prev => ({
      ...prev,
      product_code: p.code,
      product_name: p.name,
      product_description: p.description || '',
      unit_price: Number(p.price) || 0,
    }));
    setProductQuery(`${p.code} - ${p.name}`);
    setProductSelected(true);
    setProductResults([]);
  };

  const clearProduct = () => {
    setProductSelected(false);
    setProductQuery('');
    setForm(prev => ({
      ...prev,
      product_code: '',
      product_name: '',
      product_description: '',
      unit_price: 0,
    }));
  };

  const total = useMemo(() => {
    return (Number(form.quantity) || 0) * (Number(form.unit_price) || 0);
  }, [form.quantity, form.unit_price]);

  const openNew = () => {
    setForm(emptyForm);
    setCustomerQuery('');
    setCustomerSelected(false);
    setCustomerResults([]);
    setProductQuery('');
    setProductSelected(false);
    setProductResults([]);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!activeVersion) return;
    if (!form.customer_name.trim() || !form.phone.trim()) {
      toast.error('يرجى اختيار العميل');
      return;
    }
    if (!form.product_code.trim() || !form.product_name.trim()) {
      toast.error('يرجى اختيار المنتج');
      return;
    }
    if (!form.quantity || form.quantity <= 0) {
      toast.error('الكمية يجب أن تكون أكبر من صفر');
      return;
    }
    setSaving(true);
    const payload = {
      customer_name: form.customer_name.trim(),
      shop_name: form.shop_name.trim() || null,
      phone: form.phone.trim(),
      address: form.address.trim() || null,
      product_code: form.product_code.trim(),
      product_name: form.product_name.trim(),
      product_description: form.product_description.trim() || null,
      quantity: Number(form.quantity),
      unit_price: Number(form.unit_price),
      total_amount: total,
      notes: form.notes.trim() || null,
      version_id: activeVersion.id,
    };
    const { data, error } = await supabase
      .from('order_returns')
      .insert(payload)
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast.error('فشل الحفظ');
      return;
    }
    toast.success('تم تسجيل المرتجع');
    setDialogOpen(false);
    setCreatedReturn(data as OrderReturn);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المرتجع؟')) return;
    const { error } = await supabase.from('order_returns').delete().eq('id', id);
    if (error) { toast.error('فشل الحذف'); return; }
    toast.success('تم الحذف');
    load();
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = items;
    if (q) {
      list = list.filter(i =>
        i.customer_name.toLowerCase().includes(q) ||
        (i.shop_name || '').toLowerCase().includes(q) ||
        i.phone.toLowerCase().includes(q) ||
        i.product_code.toLowerCase().includes(q) ||
        i.product_name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, search]);

  const exportExcel = (useDateFilter: boolean) => {
    let rows = filtered;
    if (useDateFilter) {
      if (!dateFrom && !dateTo) {
        toast.error('يرجى اختيار تاريخ البداية أو النهاية');
        return;
      }
      const fromTs = dateFrom ? new Date(dateFrom + 'T00:00:00').getTime() : -Infinity;
      const toTs = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : Infinity;
      rows = rows.filter(i => {
        const t = new Date(i.created_at).getTime();
        return t >= fromTs && t <= toTs;
      });
    }
    if (rows.length === 0) {
      toast.error('لا توجد بيانات للتصدير');
      return;
    }
    const data = rows.map((i, idx) => ({
      '#': idx + 1,
      'اسم العميل': i.customer_name,
      'اسم المحل': i.shop_name || '',
      'رقم الهاتف': i.phone,
      'العنوان': i.address || '',
      'كود المنتج': i.product_code,
      'اسم المنتج': i.product_name,
      'الوصف': i.product_description || '',
      'الكمية': i.quantity,
      'سعر الوحدة': Number(i.unit_price),
      'الإجمالي': Number(i.total_amount),
      'ملاحظات': i.notes || '',
      'تاريخ المرتجع': new Date(i.created_at).toLocaleString('ar-EG'),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [
      { wch: 5 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 22 },
      { wch: 12 }, { wch: 22 }, { wch: 18 }, { wch: 8 }, { wch: 12 },
      { wch: 12 }, { wch: 22 }, { wch: 22 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'المرتجعات');
    const versionName = activeVersion?.name || 'all';
    const date = new Date().toISOString().slice(0, 10);
    const suffix = useDateFilter ? `${dateFrom || 'بداية'}_الى_${dateTo || 'النهاية'}` : 'الكل';
    XLSX.writeFile(wb, `orders-return-${versionName}-${suffix}-${date}.xlsx`);
    toast.success('تم تصدير الملف');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Undo2 className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">مرتجعات الطلبات</h1>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> مرتجع جديد
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">البحث والتصدير</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم، المحل، الهاتف، كود أو اسم المنتج..."
              className="pr-10"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <Label className="text-xs">من تاريخ</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">إلى تاريخ</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <Button variant="outline" onClick={() => exportExcel(true)} className="gap-2">
              <FileSpreadsheet className="h-4 w-4" /> تصدير حسب التاريخ
            </Button>
            <Button onClick={() => exportExcel(false)} className="gap-2">
              <FileSpreadsheet className="h-4 w-4" /> تصدير الكل
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">العميل</TableHead>
                <TableHead className="text-right">المحل</TableHead>
                <TableHead className="text-right">الهاتف</TableHead>
                <TableHead className="text-right">كود المنتج</TableHead>
                <TableHead className="text-right">اسم المنتج</TableHead>
                <TableHead className="text-right">الكمية</TableHead>
                <TableHead className="text-right">الإجمالي</TableHead>
                <TableHead className="text-right">التاريخ</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">لا توجد مرتجعات</TableCell></TableRow>
              ) : filtered.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.customer_name}</TableCell>
                  <TableCell>{item.shop_name || '-'}</TableCell>
                  <TableCell dir="ltr" className="text-right">{item.phone}</TableCell>
                  <TableCell className="font-mono">{item.product_code}</TableCell>
                  <TableCell>{item.product_name}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell className="font-semibold">{Number(item.total_amount).toFixed(2)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleString('ar-EG')}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(item.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تسجيل مرتجع جديد</DialogTitle>
            <DialogDescription>ابحث عن العميل والمنتج ثم أدخل الكمية المراد إرجاعها</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {/* Customer search */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="h-4 w-4" /> بيانات العميل
              </Label>
              <div className="relative">
                <Input
                  value={customerQuery}
                  onChange={(e) => { setCustomerQuery(e.target.value); setCustomerSelected(false); }}
                  placeholder="ابحث بالاسم، المحل، أو الهاتف..."
                />
                {customerSelected && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={clearCustomer}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                {customerResults.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {customerResults.map(c => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => pickCustomer(c)}
                        className="w-full text-right px-3 py-2 hover:bg-muted text-sm border-b last:border-b-0"
                      >
                        <div className="font-medium">{c.name} {c.shop_name && <span className="text-muted-foreground">- {c.shop_name}</span>}</div>
                        <div className="text-xs text-muted-foreground" dir="ltr">{c.phone}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {customerSelected && (
                <div className="rounded-md bg-muted/40 p-3 text-sm space-y-1">
                  <div><span className="text-muted-foreground">الاسم:</span> <span className="font-medium">{form.customer_name}</span></div>
                  {form.shop_name && <div><span className="text-muted-foreground">المحل:</span> {form.shop_name}</div>}
                  <div><span className="text-muted-foreground">الهاتف:</span> <span dir="ltr">{form.phone}</span></div>
                  {form.address && <div><span className="text-muted-foreground">العنوان:</span> {form.address}</div>}
                </div>
              )}
            </div>

            {/* Product search */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Package className="h-4 w-4" /> المنتج المراد إرجاعه
              </Label>
              <div className="relative">
                <Input
                  value={productQuery}
                  onChange={(e) => { setProductQuery(e.target.value); setProductSelected(false); }}
                  placeholder="ابحث بكود أو اسم المنتج..."
                />
                {productSelected && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={clearProduct}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                {productResults.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {productResults.map(p => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => pickProduct(p)}
                        className="w-full text-right px-3 py-2 hover:bg-muted text-sm border-b last:border-b-0"
                      >
                        <div className="font-medium font-mono">{p.code} - <span className="font-sans">{p.name}</span></div>
                        <div className="text-xs text-muted-foreground">{p.description || ''} • السعر: {Number(p.price).toFixed(2)}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {productSelected && (
                <div className="rounded-md bg-muted/40 p-3 text-sm space-y-1">
                  <div><span className="text-muted-foreground">الكود:</span> <span className="font-mono font-medium">{form.product_code}</span></div>
                  <div><span className="text-muted-foreground">الاسم:</span> {form.product_name}</div>
                  {form.product_description && <div><span className="text-muted-foreground">الوصف:</span> {form.product_description}</div>}
                </div>
              )}
            </div>

            {/* Quantity & price */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>الكمية المرتجعة *</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>سعر الوحدة</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unit_price}
                  onChange={(e) => setForm({ ...form, unit_price: Number(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <Label>ملاحظات</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="سبب المرتجع أو أي ملاحظة..." />
            </div>

            <div className="flex items-center justify-between rounded-md bg-primary/10 p-3">
              <span className="font-medium">إجمالي المرتجع:</span>
              <span className="text-lg font-bold text-primary">{total.toFixed(2)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Check className="h-4 w-4" />
              {saving ? 'جاري الحفظ...' : 'إنهاء'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Created details dialog */}
      <Dialog open={!!createdReturn} onOpenChange={(o) => !o && setCreatedReturn(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Check className="h-5 w-5" /> تم تسجيل المرتجع بنجاح
            </DialogTitle>
          </DialogHeader>
          {createdReturn && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border border-border p-3 space-y-2">
                <div className="font-semibold text-base">بيانات العميل</div>
                <div><span className="text-muted-foreground">الاسم:</span> {createdReturn.customer_name}</div>
                {createdReturn.shop_name && <div><span className="text-muted-foreground">المحل:</span> {createdReturn.shop_name}</div>}
                <div><span className="text-muted-foreground">الهاتف:</span> <span dir="ltr">{createdReturn.phone}</span></div>
                {createdReturn.address && <div><span className="text-muted-foreground">العنوان:</span> {createdReturn.address}</div>}
              </div>

              <div className="rounded-md border border-border p-3 space-y-2">
                <div className="font-semibold text-base">المنتج المرتجع</div>
                <div><span className="text-muted-foreground">الكود:</span> <span className="font-mono">{createdReturn.product_code}</span></div>
                <div><span className="text-muted-foreground">الاسم:</span> {createdReturn.product_name}</div>
                {createdReturn.product_description && <div><span className="text-muted-foreground">الوصف:</span> {createdReturn.product_description}</div>}
                <div><span className="text-muted-foreground">الكمية:</span> {createdReturn.quantity}</div>
                <div><span className="text-muted-foreground">سعر الوحدة:</span> {Number(createdReturn.unit_price).toFixed(2)}</div>
                <div className="flex justify-between pt-2 border-t border-border">
                  <span className="font-semibold">الإجمالي:</span>
                  <span className="font-bold text-primary">{Number(createdReturn.total_amount).toFixed(2)}</span>
                </div>
              </div>

              {createdReturn.notes && (
                <div className="rounded-md border border-border p-3">
                  <div className="font-semibold mb-1">ملاحظات</div>
                  <div className="text-muted-foreground">{createdReturn.notes}</div>
                </div>
              )}

              <div className="text-xs text-muted-foreground text-center pt-2">
                تاريخ ووقت المرتجع: {new Date(createdReturn.created_at).toLocaleString('ar-EG')}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCreatedReturn(null)} className="w-full">تم</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrdersReturn;
