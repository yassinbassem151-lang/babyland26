import { useEffect, useState } from 'react';
import { useNavigate, Link, Outlet, useLocation } from 'react-router-dom';
import { Package, ShoppingCart, Users, BarChart3, LogOut, Wallet, SearchCode, FileText, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import babylandLogo from '@/assets/babyland-logo.jpg';
import { VersionProvider } from '@/contexts/VersionContext';
import VersionSelector from '@/components/VersionSelector';

const navItems = [
  { path: '/admin/dashboard', label: 'الإحصائيات', icon: BarChart3 },
  { path: '/admin/dashboard/products', label: 'المنتجات', icon: Package },
  { path: '/admin/dashboard/orders', label: 'الطلبات', icon: ShoppingCart },
  { path: '/admin/dashboard/customers', label: 'العملاء', icon: Users },
  { path: '/admin/dashboard/deposits', label: 'العربون', icon: Wallet },
  { path: '/admin/dashboard/search-by-code', label: 'البحث بالكود', icon: SearchCode },
  { path: '/admin/dashboard/customer-extra-info', label: 'معلومات إضافية', icon: FileText },
  { path: '/admin/dashboard/product-images', label: 'صور المنتجات', icon: ImagePlus },
];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    const auth = sessionStorage.getItem('babyland_admin');
    if (!auth) {
      navigate('/admin');
    } else {
      setIsAuth(true);
    }
  }, [navigate]);

  const handleLogout = () => {
    sessionStorage.removeItem('babyland_admin');
    navigate('/admin');
  };

  if (!isAuth) return null;

  return (
    <VersionProvider>
      <div className="min-h-screen bg-background flex">
        {/* Sidebar */}
        <aside className="w-64 bg-card border-l border-border flex flex-col">
          <div className="p-4 border-b border-border">
            <Link to="/" className="flex items-center gap-3">
              <img src={babylandLogo} alt="Babyland" className="h-10 w-10 rounded-full" />
              <span className="font-bold gradient-text">لوحة التحكم</span>
            </Link>
          </div>

          <VersionSelector />
          
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-baby'
                      : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-border">
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-5 w-5" />
              تسجيل الخروج
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </VersionProvider>
  );
};

export default AdminDashboard;
