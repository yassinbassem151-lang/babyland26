import { useState, useRef, useEffect } from 'react';
import { Upload, Check, X, Image, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useVersion } from '@/contexts/VersionContext';

interface UploadResult {
  filename: string;
  code: string;
  status: 'success' | 'error' | 'no-match';
  message: string;
}

const ProductImages = () => {
  const { activeVersion } = useVersion();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [processedFiles, setProcessedFiles] = useState(0);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeVersion) return;

    setUploading(true);
    setResults([]);
    setTotalFiles(files.length);
    setProcessedFiles(0);
    setProgress(0);

    const uploadResults: UploadResult[] = [];

    // Get all products for this version
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('id, code')
      .eq('version_id', activeVersion.id);

    if (prodError) {
      toast.error('فشل في تحميل المنتجات');
      setUploading(false);
      return;
    }

    const productMap = new Map(products?.map(p => [p.code.toLowerCase(), p.id]) || []);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const code = file.name.replace(/\.[^/.]+$/, '').trim(); // Remove extension

      const matchedProductId = productMap.get(code.toLowerCase());

      if (!matchedProductId) {
        uploadResults.push({
          filename: file.name,
          code,
          status: 'no-match',
          message: 'لا يوجد منتج بهذا الكود',
        });
        setProcessedFiles(i + 1);
        setProgress(Math.round(((i + 1) / files.length) * 100));
        continue;
      }

      try {
        // Upload to storage
        const filePath = `${code}.${file.name.split('.').pop()}`;
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);

        // Update product image_url
        const { error: updateError } = await supabase
          .from('products')
          .update({ image_url: urlData.publicUrl })
          .eq('id', matchedProductId);

        if (updateError) throw updateError;

        uploadResults.push({
          filename: file.name,
          code,
          status: 'success',
          message: 'تم الرفع بنجاح',
        });
      } catch (err: any) {
        uploadResults.push({
          filename: file.name,
          code,
          status: 'error',
          message: err.message || 'خطأ في الرفع',
        });
      }

      setProcessedFiles(i + 1);
      setProgress(Math.round(((i + 1) / files.length) * 100));
      setResults([...uploadResults]);
    }

    setResults(uploadResults);
    setUploading(false);

    const successCount = uploadResults.filter(r => r.status === 'success').length;
    const errorCount = uploadResults.filter(r => r.status === 'error').length;
    const noMatchCount = uploadResults.filter(r => r.status === 'no-match').length;

    toast.success(`تم رفع ${successCount} صورة بنجاح${errorCount > 0 ? ` | ${errorCount} خطأ` : ''}${noMatchCount > 0 ? ` | ${noMatchCount} بدون تطابق` : ''}`);
  };

  if (!activeVersion) {
    return <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>;
  }

  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const noMatchCount = results.filter(r => r.status === 'no-match').length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">رفع صور المنتجات</h1>
      <p className="text-muted-foreground">
        اختر صور المنتجات. يجب أن يكون اسم كل صورة هو كود المنتج (مثال: 8662.jpg)
      </p>

      <Card className="border-2 border-dashed border-primary/30 hover:border-primary/60 transition-colors">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
            disabled={uploading}
          />
          <div className="rounded-full bg-primary/10 p-6 mb-4">
            <Upload className="h-12 w-12 text-primary" />
          </div>
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            size="lg"
            className="gap-2 rounded-xl"
          >
            {uploading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                جاري الرفع...
              </>
            ) : (
              <>
                <Image className="h-5 w-5" />
                اختر الصور
              </>
            )}
          </Button>
          <p className="text-sm text-muted-foreground mt-2">يمكنك اختيار عدة صور مرة واحدة</p>
        </CardContent>
      </Card>

      {uploading && (
        <Card>
          <CardContent className="py-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>جاري الرفع...</span>
                <span>{processedFiles} / {totalFiles}</span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && !uploading && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">نتائج الرفع</CardTitle>
            <div className="flex gap-4 text-sm">
              {successCount > 0 && <span className="text-green-600">✅ نجاح: {successCount}</span>}
              {errorCount > 0 && <span className="text-red-600">❌ خطأ: {errorCount}</span>}
              {noMatchCount > 0 && <span className="text-yellow-600">⚠️ بدون تطابق: {noMatchCount}</span>}
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {results.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-2 rounded-lg text-sm ${
                    r.status === 'success' ? 'bg-green-50 text-green-800' :
                    r.status === 'error' ? 'bg-red-50 text-red-800' :
                    'bg-yellow-50 text-yellow-800'
                  }`}
                >
                  {r.status === 'success' ? <Check className="h-4 w-4 flex-shrink-0" /> :
                   r.status === 'error' ? <X className="h-4 w-4 flex-shrink-0" /> :
                   <span className="text-yellow-600 flex-shrink-0">⚠</span>}
                  <span className="font-mono">{r.code}</span>
                  <span className="text-xs">{r.message}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProductImages;
