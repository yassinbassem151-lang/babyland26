import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Upload, Database, FileJson, AlertTriangle, Loader2, FileArchive } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import JSZip from 'jszip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';

// All tables in the database — each backed up as a separate file.
const TABLES = [
  'versions',
  'app_settings',
  'staff_members',
  'products',
  'customers',
  'orders',
  'order_items',
  'deposits',
  'expenses',
  'shipping_details',
  'stock_alerts',
] as const;

type TableName = typeof TABLES[number];

const TABLE_LABELS: Record<TableName, string> = {
  versions: 'النسخ',
  app_settings: 'إعدادات التطبيق',
  staff_members: 'الموظفين',
  products: 'المنتجات',
  customers: 'العملاء',
  orders: 'الطلبات',
  order_items: 'عناصر الطلبات',
  deposits: 'العرابين',
  expenses: 'المصروفات',
  shipping_details: 'تفاصيل الشحن',
  stock_alerts: 'تنبيهات المخزون',
};

// Restore order respects foreign-key-like dependencies.
const RESTORE_ORDER: TableName[] = [
  'versions',
  'app_settings',
  'staff_members',
  'products',
  'customers',
  'orders',
  'order_items',
  'deposits',
  'expenses',
  'shipping_details',
  'stock_alerts',
];

interface TableStats {
  table: TableName;
  count: number;
}

const fetchAllRows = async (table: TableName): Promise<any[]> => {
  const pageSize = 1000;
  let from = 0;
  const rows: any[] = [];
  // Loop until we get less than pageSize rows
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const getTimestamp = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
};

const Backup = () => {
  const [loading, setLoading] = useState(false);
  const [downloadingTable, setDownloadingTable] = useState<TableName | null>(null);
  const [stats, setStats] = useState<TableStats[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<{ files: { table: TableName; rows: any[] }[]; mode: 'full' | 'partial' } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const results = await Promise.all(
        TABLES.map(async (table) => {
          const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });
          if (error) throw error;
          return { table, count: count || 0 };
        })
      );
      setStats(results);
    } catch (err: any) {
      toast.error('فشل في تحميل الإحصائيات: ' + err.message);
    } finally {
      setStatsLoading(false);
    }
  };

  // Download ZIP containing one JSON per table + manifest
  const downloadFullBackup = async () => {
    setLoading(true);
    try {
      const zip = new JSZip();
      const manifest: any = {
        version: 1,
        created_at: new Date().toISOString(),
        app: 'babyland',
        tables: {},
      };

      for (const table of TABLES) {
        const rows = await fetchAllRows(table);
        const fileName = `${table}.json`;
        const payload = {
          table,
          version: 1,
          exported_at: new Date().toISOString(),
          count: rows.length,
          rows,
        };
        zip.file(fileName, JSON.stringify(payload, null, 2));
        manifest.tables[table] = { count: rows.length, file: fileName };
      }

      zip.file('manifest.json', JSON.stringify(manifest, null, 2));
      zip.file(
        'README.txt',
        `Babyland Backup\n` +
          `Created: ${new Date().toISOString()}\n\n` +
          `This archive contains a full backup of the website database.\n` +
          `Each table is stored in a separate JSON file so you can restore individual parts.\n\n` +
          `Tables included:\n` +
          TABLES.map((t) => `  - ${t}.json (${manifest.tables[t].count} rows)`).join('\n') +
          `\n\nTo restore: upload the entire ZIP, or upload individual JSON files.\n`
      );

      const blob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(blob, `babyland-backup-${getTimestamp()}.zip`);
      toast.success('تم تنزيل النسخة الاحتياطية الكاملة');
    } catch (err: any) {
      toast.error('فشل في إنشاء النسخة الاحتياطية: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Download single-table JSON
  const downloadSingleTable = async (table: TableName) => {
    setDownloadingTable(table);
    try {
      const rows = await fetchAllRows(table);
      const payload = {
        table,
        version: 1,
        exported_at: new Date().toISOString(),
        count: rows.length,
        rows,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `${table}-${getTimestamp()}.json`);
      toast.success(`تم تنزيل ${TABLE_LABELS[table]} (${rows.length} سجل)`);
    } catch (err: any) {
      toast.error('فشل التنزيل: ' + err.message);
    } finally {
      setDownloadingTable(null);
    }
  };

  // Parse uploaded file(s) into a normalized list of {table, rows}
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // reset input so same file can be selected again later
    if (fileInputRef.current) fileInputRef.current.value = '';

    try {
      let parsed: { table: TableName; rows: any[] }[] = [];

      if (file.name.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(file);
        for (const table of TABLES) {
          const entry = zip.file(`${table}.json`);
          if (!entry) continue;
          const content = await entry.async('string');
          const data = JSON.parse(content);
          if (Array.isArray(data?.rows)) {
            parsed.push({ table, rows: data.rows });
          }
        }
        if (parsed.length === 0) throw new Error('الملف المضغوط لا يحتوي على بيانات معروفة');
        setPendingRestore({ files: parsed, mode: 'full' });
      } else if (file.name.endsWith('.json')) {
        const content = await file.text();
        const data = JSON.parse(content);
        const table = data?.table as TableName;
        if (!table || !TABLES.includes(table)) {
          throw new Error('ملف JSON غير صالح: حقل table مفقود أو غير معروف');
        }
        if (!Array.isArray(data?.rows)) {
          throw new Error('ملف JSON غير صالح: حقل rows مفقود');
        }
        parsed = [{ table, rows: data.rows }];
        setPendingRestore({ files: parsed, mode: 'partial' });
      } else {
        throw new Error('يجب اختيار ملف .zip أو .json');
      }

      setRestoreDialogOpen(true);
    } catch (err: any) {
      toast.error('فشل في قراءة الملف: ' + err.message);
    }
  };

  const performRestore = async () => {
    if (!pendingRestore) return;
    setRestoring(true);
    try {
      // Sort files by RESTORE_ORDER to respect dependencies
      const ordered = [...pendingRestore.files].sort(
        (a, b) => RESTORE_ORDER.indexOf(a.table) - RESTORE_ORDER.indexOf(b.table)
      );

      for (const { table, rows } of ordered) {
        if (rows.length === 0) continue;

        // Delete existing rows in this table (only those tables being restored)
        // Use a safe delete that targets all rows.
        const { error: deleteError } = await supabase
          .from(table)
          .delete()
          .not('id', 'is', null);
        if (deleteError) {
          throw new Error(`فشل حذف بيانات ${table}: ${deleteError.message}`);
        }

        // Insert in batches of 200
        const batchSize = 200;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const { error: insertError } = await supabase.from(table).insert(batch as any);
          if (insertError) {
            throw new Error(`فشل استعادة ${table} (دفعة ${i}): ${insertError.message}`);
          }
        }
      }

      toast.success('تمت استعادة البيانات بنجاح');
      setRestoreDialogOpen(false);
      setPendingRestore(null);
      await loadStats();
    } catch (err: any) {
      toast.error(err.message || 'فشلت عملية الاستعادة');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold gradient-text mb-2">النسخ الاحتياطي والاستعادة</h1>
        <p className="text-muted-foreground">
          قم بتنزيل نسخة احتياطية كاملة من جميع بيانات الموقع، أو نزّل جدولًا واحدًا فقط. يمكنك أيضًا استعادة البيانات من ملف نسخة احتياطية.
        </p>
      </div>

      {/* Full backup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileArchive className="h-5 w-5 text-primary" />
            نسخة احتياطية كاملة
          </CardTitle>
          <CardDescription>
            ملف ZIP يحتوي على ملف JSON منفصل لكل جدول + ملف manifest. يمكنك استخدامه لاستعادة كل شيء أو فقط جزء منه.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={downloadFullBackup} disabled={loading} size="lg" className="gap-2">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
            تنزيل النسخة الكاملة (.zip)
          </Button>
        </CardContent>
      </Card>

      {/* Per-table backup */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                تنزيل جدول واحد
              </CardTitle>
              <CardDescription>اختر جدولًا محددًا لتنزيله كملف JSON مستقل.</CardDescription>
            </div>
            <Button variant="outline" onClick={loadStats} disabled={statsLoading}>
              {statsLoading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
              عرض عدد السجلات
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {TABLES.map((table) => {
              const stat = stats.find((s) => s.table === table);
              const isLoading = downloadingTable === table;
              return (
                <div
                  key={table}
                  className="flex items-center justify-between p-3 border border-border rounded-xl bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileJson className="h-4 w-4 text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{TABLE_LABELS[table]}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {table}
                        {stat ? ` • ${stat.count} سجل` : ''}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => downloadSingleTable(table)}
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Restore */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Upload className="h-5 w-5" />
            استعادة من نسخة احتياطية
          </CardTitle>
          <CardDescription>
            ارفع ملف <Badge variant="outline">.zip</Badge> لاستعادة كل شيء، أو ملف{' '}
            <Badge variant="outline">.json</Badge> لاستعادة جدول واحد فقط. سيتم استبدال البيانات الحالية للجداول المضمّنة.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,.json,application/zip,application/json"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            variant="destructive"
            onClick={() => fileInputRef.current?.click()}
            className="gap-2"
            size="lg"
          >
            <Upload className="h-5 w-5" />
            اختيار ملف للاستعادة
          </Button>
        </CardContent>
      </Card>

      {/* Confirm restore dialog */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              تأكيد الاستعادة
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  سيتم <strong>حذف البيانات الحالية</strong> للجداول التالية واستبدالها بمحتوى الملف. هذا الإجراء لا يمكن التراجع عنه.
                </p>
                {pendingRestore && (
                  <div className="bg-muted rounded-lg p-3 space-y-1 max-h-60 overflow-y-auto">
                    {pendingRestore.files.map((f) => (
                      <div key={f.table} className="flex justify-between text-sm">
                        <span className="font-medium">{TABLE_LABELS[f.table]}</span>
                        <span className="text-muted-foreground">{f.rows.length} سجل</span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  نصيحة: قم بتنزيل نسخة احتياطية كاملة قبل المتابعة.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                performRestore();
              }}
              disabled={restoring}
              className="bg-destructive hover:bg-destructive/90"
            >
              {restoring ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  جاري الاستعادة...
                </>
              ) : (
                'تأكيد الاستعادة'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Backup;
