import { useState } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { QrCode, X, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface QRScannerProps {
  onScan: (code: string) => void;
}

const QRScanner = ({ onScan }: QRScannerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScan = (result: any) => {
    if (result && result[0]?.rawValue) {
      const scannedCode = result[0].rawValue;
      onScan(scannedCode);
      setIsOpen(false);
      setError(null);
    }
  };

  const handleError = (err: any) => {
    console.error('QR Scanner error:', err);
    setError('فشل في تشغيل الكاميرا');
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        size="lg"
        className="w-full gap-3 rounded-2xl bg-gradient-to-l from-primary to-secondary py-8 text-lg font-bold shadow-baby-lg transition-all hover:shadow-pink hover:scale-[1.02] btn-bounce"
      >
        <QrCode className="h-8 w-8" />
        <span>مسح كود QR</span>
        <Camera className="h-6 w-6 opacity-70" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center justify-between">
              <span className="gradient-text">مسح كود المنتج</span>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          <div className="relative aspect-square w-full bg-foreground/5">
            <Scanner
              onScan={handleScan}
              onError={handleError}
              constraints={{ facingMode: 'environment' }}
              styles={{
                container: { width: '100%', height: '100%' },
                video: { width: '100%', height: '100%', objectFit: 'cover' },
              }}
            />
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-16 border-4 border-primary rounded-2xl opacity-50" />
              <div className="absolute top-16 left-16 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
              <div className="absolute top-16 right-16 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
              <div className="absolute bottom-16 left-16 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
              <div className="absolute bottom-16 right-16 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
            </div>
          </div>

          {error && (
            <div className="p-4 text-center text-destructive text-sm">{error}</div>
          )}

          <div className="p-4 text-center text-muted-foreground text-sm">
            وجّه الكاميرا نحو كود QR الخاص بالمنتج
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default QRScanner;
