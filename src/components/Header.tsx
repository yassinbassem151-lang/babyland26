import { Link } from 'react-router-dom';
import { ShoppingCart, Settings } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import babylandLogo from '@/assets/baby-land-logo.jpg';

const Header = () => {
  const { totalItems } = useCart();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-3 transition-transform hover:scale-105">
          <img src={babylandLogo} alt="Babyland" className="h-12 w-auto object-contain" />
          <span className="text-xl font-bold gradient-text">Babyland</span>
        </Link>

        <nav className="flex items-center gap-4">
          <Link
            to="/checkout"
            className="relative flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-primary-foreground transition-all hover:shadow-baby btn-bounce"
          >
            <ShoppingCart className="h-5 w-5" />
            <span className="font-semibold">السلة</span>
            {totalItems > 0 && (
              <span className="absolute -top-2 -left-2 flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground animate-bounce-soft">
                {totalItems}
              </span>
            )}
          </Link>

          <Link
            to="/admin"
            className="rounded-full bg-muted p-2.5 text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground"
          >
            <Settings className="h-5 w-5" />
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default Header;
