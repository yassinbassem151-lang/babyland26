import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useVersion } from '@/contexts/VersionContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Pencil, Trash2, Truck, Check, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';

interface ShippingDetail {
  id: string;
  customer_name: string;
  shop_name: string | null;
  phone: string;
  shipping_company: string;
  shipping_data: string;
  is_correct: boolean;
  created_at: string;
}

const empty = { customer_name: '', shop_name: '', phone: '', shipping_company: '', shipping_data: '' };

const ShippingDetails = () => {
  const { activeVersion } = useVersion();
  const [items, setItems] = useState<ShippingDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!activeVersion) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('shipping_details')
      .select('*')
      .eq('version_id', activeVersion.id)
      .order('created_at', { ascending: false });
    if (error) toast.error('فشل تحميل البيانات');
    else setItems((data as ShippingDetail[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [activeVersion?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i =>
      i.customer_name.toLowerCase().includes(q) ||
      (i.shop_name || '').toLowerCase().includes(q) ||
      i.phone.toLowerCase().includes(q) ||
      i.shipping_company.toLowerCase().includes(q) ||
      i.shipping_data.toLowerCase().includes(q)
    );
  }, [items, search]);

  const openNew = () => {
    setEditingId(null);
    setForm(empty);
    setDialogOpen(true);
  };

  const openEdit = (item: ShippingDetail) => {
    setEditingId(item.id);
    setForm({
      customer_name: item.customer_name,
      shop_name: item.shop_name || '',
      phone: item.phone,
      shipping_company: item.shipping_company,
      shipping_data: item.shipping_data,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!activeVersion) return;
    if (!form.customer_name.trim() || !form.phone.trim() || !form.shipping_company.trim() || !form.shipping_data.trim()) {
      toast.error('يرجى ملء كل الحقول المطلوبة');
      return;
    }
    setSaving(true);
    const payload = {
      customer_name: form.customer_name.trim(),
      shop_name: form.shop_name.trim() || null,
      phone: form.phone.trim(),
      shipping_company: form.shipping_company.trim(),
      shipping_data: form.shipping_data.trim(),
      version_id: activeVersion.id,
    };
    const { error } = editingId
      ? await supabase.from('shipping_details').update(payload).eq('id', editingId)
      : await supabase.from('shipping_details').insert(payload);
    setSaving(false);
    if (error) {
      toast.error('فشل الحفظ');
      return;
    }
    toast.success(editingId ? 'تم التعديل' : 'تمت الإضافة');
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    const { error } = await supabase.from('shipping_details').delete().eq('id', id);
    if (error) { toast.error('فشل الحذف'); return; }
    toast.success('تم الحذف');
    load();
  };

  const toggleCorrect = async (item: ShippingDetail) => {
    const newVal = !item.is_correct;
    // Optimistic update
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_correct: newVal } : i));
    const { error } = await supabase
      .from('shipping_details')
      .update({ is_correct: newVal })
      .eq('id', item.id);
    if (error) {
      toast.error('فشل التحديث');
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_correct: !newVal } : i));
      return;
    }
    toast.success(newVal ? 'تم التأشير كصحيح' : 'تم إلغاء التأشير');
  };

  const exportExcel = () => {
    if (filtered.length === 0) {
      toast.error('لا توجد بيانات للتصدير');
      return;
    }
    const rows = filtered.map((i, idx) => ({
      '#': idx + 1,
      'اسم العميل': i.customer_name,
      'اسم المحل': i.shop_name || '',
      'رقم الهاتف': i.phone,
      'شركة الشحن': i.shipping_company,
      'بيانات الشحن': i.shipping_data,
      'الحالة': i.is_correct ? 'صحيح' : 'غير مؤكد',
      'تاريخ الإضافة': new Date(i.created_at).toLocaleString('ar-EG'),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 5 }, { wch: 20 }, { wch: 20 }, { wch: 15 },
      { wch: 18 }, { wch: 25 }, { wch: 12 }, { wch: 22 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'تفاصيل الشحن');
    const versionName = activeVersion?.name || 'all';
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `shipping-details-${versionName}-${date}.xlsx`);
    toast.success('تم تصدير الملف');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Truck className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">تفاصيل الشحن</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={exportExcel} variant="outline" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" /> تصدير Excel
          </Button>
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" /> إضافة شحنة
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>البحث</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم، المحل، الهاتف، شركة الشحن أو رقم الشحنة..."
              className="pr-10"
            />
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
                <TableHead className="text-right">شركة الشحن</TableHead>
                <TableHead className="text-right">بيانات الشحن</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد بيانات</TableCell></TableRow>
              ) : filtered.map(item => (
                <TableRow
                  key={item.id}
                  className={cn(item.is_correct && 'bg-green-500/10 hover:bg-green-500/15')}
                >
                  <TableCell className="font-medium">{item.customer_name}</TableCell>
                  <TableCell>{item.shop_name || '-'}</TableCell>
                  <TableCell dir="ltr" className="text-right">{item.phone}</TableCell>
                  <TableCell>{item.shipping_company}</TableCell>
                  <TableCell>{item.shipping_data}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        variant={item.is_correct ? 'default' : 'outline'}
                        onClick={() => toggleCorrect(item)}
                        className={cn(
                          item.is_correct && 'bg-green-600 hover:bg-green-700 text-white border-green-600',
                        )}
                        title={item.is_correct ? 'تم التأشير كصحيح - اضغط للإلغاء' : 'تأشير كصحيح'}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(item.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'تعديل شحنة' : 'إضافة شحنة'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>اسم العميل *</Label>
              <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
            </div>
            <div>
              <Label>اسم المحل</Label>
              <Input value={form.shop_name} onChange={(e) => setForm({ ...form, shop_name: e.target.value })} />
            </div>
            <div>
              <Label>رقم الهاتف *</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" />
            </div>
            <div>
              <Label>شركة الشحن *</Label>
              <Input value={form.shipping_company} onChange={(e) => setForm({ ...form, shipping_company: e.target.value })} />
            </div>
            <div>
              <Label>بيانات الشحن (الاسم أو الرقم) *</Label>
              <Input value={form.shipping_data} onChange={(e) => setForm({ ...form, shipping_data: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShippingDetails;
