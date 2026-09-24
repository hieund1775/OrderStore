import { Link, useRouterState, useNavigate } from '@tanstack/react-router';
import { Home, UtensilsCrossed, ShoppingCart, Receipt, User } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { useCustomerSession, openCustomerLoginModal } from '@/lib/customer-session';

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search }) as { tab?: string } | undefined;
  const currentTab = search?.tab;
  const session = useCustomerSession();
  const { count } = useCart();
  const navigate = useNavigate();

  const isHomeActive = pathname === '/';
  const isMenuActive = pathname.startsWith('/menu');
  const isOrdersActive =
    (pathname === '/ho-so' && currentTab === 'orders') || pathname === '/theo-doi-don';
  const isProfileActive = pathname === '/ho-so' && currentTab !== 'orders';

  const handleOpenCart = (e: React.MouseEvent) => {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('teaplus:open-cart'));
  };

  const handleOrdersClick = (e: React.MouseEvent) => {
    if (!session) {
      e.preventDefault();
      openCustomerLoginModal();
    }
  };

  const handleProfileClick = (e: React.MouseEvent) => {
    if (!session) {
      e.preventDefault();
      openCustomerLoginModal();
    }
  };

  return (
    <nav
      aria-label="Điều hướng dưới đáy màn hình"
      className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-border/80 bg-background/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg shadow-lg md:hidden"
    >
      {/* 1. Trang chủ */}
      <Link
        to="/"
        className={`flex flex-1 flex-col items-center justify-center py-1 transition-all select-none ${
          isHomeActive ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Home className={`size-5 transition-transform ${isHomeActive ? 'scale-110' : ''}`} />
        <span className="mt-1 text-[11px] leading-tight">Trang chủ</span>
      </Link>

      {/* 2. Thực đơn */}
      <Link
        to="/menu"
        className={`flex flex-1 flex-col items-center justify-center py-1 transition-all select-none ${
          isMenuActive ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <UtensilsCrossed className={`size-5 transition-transform ${isMenuActive ? 'scale-110' : ''}`} />
        <span className="mt-1 text-[11px] leading-tight">Thực đơn</span>
      </Link>

      {/* 3. Giỏ hàng */}
      <button
        type="button"
        onClick={handleOpenCart}
        aria-label={`Giỏ hàng (${count} món)`}
        className="relative flex flex-1 flex-col items-center justify-center py-1 text-muted-foreground hover:text-foreground transition-all select-none cursor-pointer"
      >
        <div className="relative">
          <ShoppingCart className="size-5" />
          {count > 0 && (
            <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-xs animate-in zoom-in-75">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </div>
        <span className="mt-1 text-[11px] leading-tight">Giỏ hàng</span>
      </button>

      {/* 4. Đơn mua */}
      <Link
        to="/ho-so"
        search={{ tab: 'orders' } as any}
        onClick={handleOrdersClick}
        className={`flex flex-1 flex-col items-center justify-center py-1 transition-all select-none ${
          isOrdersActive ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Receipt className={`size-5 transition-transform ${isOrdersActive ? 'scale-110' : ''}`} />
        <span className="mt-1 text-[11px] leading-tight">Đơn mua</span>
      </Link>

      {/* 5. Tài khoản */}
      <Link
        to="/ho-so"
        onClick={handleProfileClick}
        className={`flex flex-1 flex-col items-center justify-center py-1 transition-all select-none ${
          isProfileActive ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <User className={`size-5 transition-transform ${isProfileActive ? 'scale-110' : ''}`} />
        <span className="mt-1 text-[11px] leading-tight">Tài khoản</span>
      </Link>
    </nav>
  );
}
