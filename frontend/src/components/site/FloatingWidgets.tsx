import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowUp, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/lib/cart';
import { clearBuyNowIntent } from '@/lib/buy-now';
import { vnd } from '@/lib/data';
import { useCustomerSession } from '@/lib/customer-session';

export function FloatingWidgets() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed right-4 bottom-24 z-40 flex flex-col gap-2 md:bottom-6">
      <button
        aria-label="Lên đầu trang"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="bg-card text-foreground flex size-11 items-center justify-center rounded-full border shadow-card-soft"
      >
        <ArrowUp className="size-5" />
      </button>
    </div>
  );
}

export function MobileCartBar() {
  const session = useCustomerSession();
  const { count, subtotal } = useCart();
  if (!session || count === 0) return null;
  return (
    <div className="bg-card/95 fixed inset-x-0 bottom-0 z-50 border-t p-3 backdrop-blur md:hidden">
      <div className="flex items-center gap-3">
        <div className="relative">
          <ShoppingCart className="text-primary size-6" />
          <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full text-[10px] font-bold">
            {count}
          </span>
        </div>
        <div className="flex-1">
          <p className="text-muted-foreground text-xs">Tạm tính</p>
          <p className="text-sm font-bold">{vnd(subtotal)}</p>
        </div>
        <Button asChild variant="hero" size="sm">
          <Link
            to="/thanh-toan"
            search={{ source: 'cart' }}
            onClick={() => {
              clearBuyNowIntent();
            }}
          >
            Thanh toán
          </Link>
        </Button>
      </div>
    </div>
  );
}
