import { useState } from 'react';
import { Package, ZoomIn } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface ProductImageProps {
  imageUrl?: string | null;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-16 w-16',
  md: 'h-24 w-24',
  lg: 'h-32 w-32',
};

const ProductImage = ({ imageUrl, alt, size = 'md', className = '' }: ProductImageProps) => {
  const [fullscreen, setFullscreen] = useState(false);

  if (!imageUrl) {
    return (
      <div className={`${sizeClasses[size]} rounded-xl bg-muted flex items-center justify-center flex-shrink-0 ${className}`}>
        <Package className={size === 'sm' ? 'h-6 w-6' : size === 'md' ? 'h-10 w-10' : 'h-12 w-12'} style={{ color: 'hsl(var(--muted-foreground))' }} />
      </div>
    );
  }

  return (
    <>
      <div
        className={`${sizeClasses[size]} rounded-xl overflow-hidden relative group cursor-pointer flex-shrink-0 ${className}`}
        onClick={() => setFullscreen(true)}
      >
        <img
          src={imageUrl}
          alt={alt}
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-110"
        />
        {/* Zoom hint overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center">
          <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-lg" />
        </div>
        {/* Small zoom icon always visible at corner */}
        <div className="absolute bottom-1 left-1 bg-black/40 rounded-full p-0.5">
          <ZoomIn className="h-3 w-3 text-white" />
        </div>
      </div>

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-2 bg-black/95 border-none">
          <div className="flex items-center justify-center w-full h-full">
            <img
              src={imageUrl}
              alt={alt}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProductImage;
