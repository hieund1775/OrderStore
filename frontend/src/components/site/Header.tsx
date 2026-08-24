import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import {
  Bell,
  Heart,
  MapPin,
  Menu as MenuIcon,
  ShoppingBag,
  User,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useCart } from '@/lib/cart';
import { useBranch } from '@/lib/branch';
import {
  apiPost,
  getCustomerToken,
  getCustomerUser,
  setCustomerToken,
  setCustomerUser,
  clearCustomerToken,
} from '@/lib/api';
import { brand, notifications, products, vnd } from '@/lib/data';

const navItems = [
  { to: '/', label: 'Trang chủ' },
  { to: '/gioi-thieu', label: 'Giới thiệu' },
  { to: '/menu', label: 'Menu' },
  { to: '/cua-hang', label: 'Cửa hàng' },
  { to: '/tuyen-dung', label: 'Tuyển dụng' },
] as const;

function Logo() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2">
      <span className="gradient-warm flex size-9 items-center justify-center rounded-full text-lg shadow-glow">
        🍹
      </span>
      <span className="font-display text-lg leading-tight font-bold sm:text-xl">
        Trà Trái Cây <span className="text-primary">Tô</span>
      </span>
    </Link>
  );
}

function BranchSelector() {
  const { stores, selectedStoreId, status, selectStore } = useBranch();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const placeholder =
    status === 'loading'
      ? 'Đang tải chi nhánh...'
      : status === 'error'
        ? 'Không tải được chi nhánh'
        : status === 'empty'
          ? 'Chưa có chi nhánh'
          : 'Chọn chi nhánh';

  const handleSelectStore = (value: string) => {
    if (!selectStore(value)) return;
    if (pathname === '/menu') {
      void navigate({ to: '/menu', search: { store_id: value }, replace: true });
    } else if (pathname === '/thanh-toan') {
      void navigate({ to: '/thanh-toan', search: {}, replace: true });
    }
  };

  return (
    <Select
      value={selectedStoreId == null ? undefined : String(selectedStoreId)}
      onValueChange={handleSelectStore}
      disabled={status !== 'ready' || stores.length === 0}
    >
      <SelectTrigger className="h-9 w-full max-w-56 rounded-full border-dashed text-xs">
        <MapPin className="text-primary size-3.5 shrink-0" />
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {stores.map((s) => (
          <SelectItem key={s.id} value={String(s.id)}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function QuickCart() {
  const { items, count, subtotal, setQty, removeItem } = useCart();
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full" aria-label="Giỏ hàng">
          <ShoppingBag className="size-5" />
          {count > 0 && (
            <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex size-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[10px] font-bold">
              {count}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display">Giỏ hàng ({count} món)</SheetTitle>
        </SheetHeader>
        <div className="flex-1 space-y-3 overflow-y-auto px-4">
          {items.length === 0 && (
            <p className="text-muted-foreground py-12 text-center text-sm">
              Giỏ hàng đang trống. Ghé Menu chọn ly trà bạn thích nhé!
            </p>
          )}
          {items.map((i) => (
            <div key={i.key} className="bg-card flex gap-3 rounded-xl border p-3">
              <img
                src={i.image}
                alt={i.name}
                loading="lazy"
                className="size-16 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{i.name}</p>
                <p className="text-muted-foreground text-xs">
                  {i.size} · {i.sugar} đường · {i.ice} đá
                </p>
                {i.toppings.length > 0 && (
                  <p className="text-muted-foreground truncate text-xs">
                    + {i.toppings.join(', ')}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex items-center gap-1 rounded-full border px-1">
                    <button className="px-1.5 text-sm" onClick={() => setQty(i.key, i.qty - 1)}>
                      −
                    </button>
                    <span className="w-5 text-center text-xs font-semibold">{i.qty}</span>
                    <button className="px-1.5 text-sm" onClick={() => setQty(i.key, i.qty + 1)}>
                      +
                    </button>
                  </div>
                  <span className="text-primary ml-auto text-sm font-bold">
                    {vnd(i.unitPrice * i.qty)}
                  </span>
                  <button onClick={() => removeItem(i.key)} aria-label="Xóa món">
                    <Trash2 className="text-muted-foreground size-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-3 border-t p-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tạm tính</span>
            <span className="font-bold">{vnd(subtotal)}</span>
          </div>
          <Button asChild variant="hero" className="w-full">
            <Link to="/thanh-toan">
              Thanh toán ngay <ChevronRight className="size-4" />
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function WishlistButton() {
  const { wishlist } = useCart();
  const saved = products.filter((p) => wishlist.includes(p.id));
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="hidden rounded-full sm:inline-flex"
          aria-label="Yêu thích"
        >
          <Heart className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display">Món yêu thích</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 px-4">
          {saved.length === 0 && (
            <p className="text-muted-foreground text-sm">Chưa có món nào được thả tim.</p>
          )}
          {saved.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-xl border p-3">
              <img
                src={p.image}
                alt={p.name}
                loading="lazy"
                className="size-14 rounded-lg object-cover"
              />
              <div className="flex-1">
                <p className="text-sm font-semibold">{p.name}</p>
                <p className="text-primary text-sm">{vnd(p.price)}</p>
              </div>
              <Heart className="fill-berry text-berry size-4" />
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function NotificationButton() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative hidden rounded-full sm:inline-flex"
          aria-label="Thông báo"
        >
          <Bell className="size-5" />
          <span className="bg-berry absolute top-1.5 right-2 size-2 rounded-full" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <p className="px-2 py-1 text-sm font-semibold">Thông báo</p>
        {notifications.map((n) => (
          <div key={n.id} className="hover:bg-accent rounded-lg px-2 py-2">
            <p className="text-sm">{n.title}</p>
            <p className="text-muted-foreground text-xs">{n.time}</p>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// Client ID Google OAuth — công khai, chỉ backend verify mới dùng secret
const GOOGLE_CLIENT_ID = '443383680289-fadvfm00s63umkb06mjtffeuilufs1ic.apps.googleusercontent.com';

function ProfileButton() {
  // Keep the first render identical between SSR and the browser. Reading
  // localStorage in a state initializer makes Render hydration disagree with
  // the server whenever a user already has a session.
  const [loggedIn, setLoggedIn] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [userTier, setUserTier] = useState('Đồng');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [nameInput, setNameInput] = useState('');
  const [open, setOpen] = useState(false);
  const [googleScriptLoaded, setGoogleScriptLoaded] = useState(false);
  const [googleBtnNode, setGoogleBtnNode] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const customerUser = getCustomerUser();
    setLoggedIn(Boolean(getCustomerToken()));
    setUserName(customerUser?.fullname || '');
    setUserTier(customerUser?.tier || 'Đồng');
  }, []);

  // Load Google Identity Services script (chỉ 1 lần)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as any;
    if (w.google?.accounts?.id) {
      setGoogleScriptLoaded(true);
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => setGoogleScriptLoaded(true);
    document.head.appendChild(s);
  }, []);

  // Render nút Google khi dialog mở + script sẵn sàng + ô chứa đã mount
  useEffect(() => {
    if (!open || !googleScriptLoaded || !googleBtnNode) return;
    const w = window as any;
    if (!w.google?.accounts?.id) return;
    try {
      googleBtnNode.innerHTML = '';
      w.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
      });
      const width = Math.min(400, Math.max(250, googleBtnNode.clientWidth || 340));
      w.google.accounts.id.renderButton(googleBtnNode, {
        theme: 'outline',
        size: 'large',
        width,
        shape: 'rectangular',
        text: 'signin_with',
      });
    } catch (e) {
      console.error('Google button render error:', e);
    }
  }, [open, googleScriptLoaded, googleBtnNode]);

  async function handleGoogleCredential(res: { credential: string }) {
    try {
      setLoading(true);
      setError('');
      const data = await apiPost<{
        token: string;
        user: { id: number; fullname: string; phone: string | null; tier: string; points: number };
      }>('/api/auth/google', { credential: res.credential });
      setCustomerToken(data.token);
      setCustomerUser({ ...data.user, phone: data.user.phone || '' });
      setUserName(data.user.fullname);
      setUserTier(data.user.tier);
      setLoggedIn(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Đăng nhập Google thất bại');
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordAuth() {
    const cleanName = nameInput.trim();
    if (authMode === 'register' && (cleanName.length < 2 || !/^[\p{L}\s']+$/u.test(cleanName))) {
      setError('Vui lòng nhập họ tên hợp lệ');
      return;
    }
    if (phone.replace(/\s/g, '').length < 10) {
      setError('Vui lòng nhập số điện thoại hợp lệ (ít nhất 10 số)');
      return;
    }
    if (password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await apiPost<{
        token: string;
        user: { id: number; fullname: string; phone: string; tier: string; points: number; is_admin?: boolean; admin_role?: string; admin_branch_id?: number | null };
      }>(authMode === 'register' ? '/api/auth/register' : '/api/auth/login', {
        phone,
        ...(authMode === 'register' ? { fullname: cleanName } : {}),
        password,
      });
      setUserName(data.user.fullname);
      setUserTier(data.user.tier);
      setCustomerToken(data.token);
      setCustomerUser(data.user);
      setLoggedIn(true);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể kết nối đến máy chủ');
    } finally {
      setLoading(false);
    }
  }

  function resetLogin() {
    clearCustomerToken();
    setLoggedIn(false);
    setPhone('');
    setPassword('');
    setAuthMode('login');
    setError('');
    setUserName('');
    setNameInput('');
  }

  if (!loggedIn) {
    return (
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setAuthMode('login');
            setError('');
            setPassword('');
          }
        }}
      >
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="Tài khoản">
            <User className="size-5" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-center">
              {authMode === 'login' ? 'Đăng nhập' : 'Đăng ký tài khoản'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <>
              {authMode === 'register' && (
                <Input
                  placeholder="Họ và tên"
                  value={nameInput}
                  onChange={(e) => { setNameInput(e.target.value); setError(''); }}
                />
              )}
              <Input
                placeholder="Số điện thoại"
                inputMode="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setError(''); }}
              />
              <Input
                placeholder="Mật khẩu (tối thiểu 8 ký tự)"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
              />
              {error && <p className="text-berry text-xs">{error}</p>}
              <Button variant="hero" className="w-full" onClick={handlePasswordAuth} disabled={loading}>
                {loading ? 'Đang xử lý…' : authMode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
              </Button>
              <button
                className="text-muted-foreground text-xs text-center w-full underline"
                onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setError(''); }}
              >
                {authMode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
              </button>
              <div className="text-muted-foreground flex items-center gap-3 text-xs">
                <Separator className="flex-1" /> hoặc <Separator className="flex-1" />
              </div>
              <div ref={setGoogleBtnNode} className="w-full flex justify-center min-h-[44px] items-center" />
            </>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  const initial = userName.charAt(0).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Tài khoản">
          <span className="gradient-warm text-primary-foreground flex size-7 items-center justify-center rounded-full text-xs font-bold">
            {initial}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="font-bold">{userName}</span>
            <span className="text-muted-foreground text-xs font-normal">
              Hạng {userTier}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/ho-so">Hồ sơ cá nhân</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={resetLogin}>Đăng xuất</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StandaloneBanner() {
  const [show, setShow] = useState(() => {
    if (typeof window === 'undefined') return false;
    return import.meta.env.VITE_STANDALONE === 'true' || window.location.hostname.includes('vercel.app');
  });

  if (!show) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-300 py-1.5 px-4 text-center text-xs flex items-center justify-center gap-2">
      <span>⚡ Đang chạy Chế độ Vercel Standalone (Dữ liệu lưu trên thiết bị này)</span>
      <button onClick={() => setShow(false)} className="hover:opacity-100 opacity-60 font-bold ml-2" aria-label="Đóng thông báo">
        ✕
      </button>
    </div>
  );
}

export function Header() {
  return (
    <header className="bg-background/85 sticky top-0 z-50 border-b backdrop-blur-md">
      <StandaloneBanner />
      <div className="bg-primary text-primary-foreground py-1.5 text-center text-xs">
        🍓 Freeship 0đ cho đơn từ 99.000₫ · Hotline {brand.hotline}
      </div>
      <div className="container-page flex h-16 items-center gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full lg:hidden"
              aria-label="Menu"
            >
              <MenuIcon className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72">
            <SheetHeader>
              <SheetTitle>
                <Logo />
              </SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col px-4">
              {navItems.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  className="hover:text-primary border-b py-3 text-sm font-medium"
                  activeProps={{ className: 'text-primary' }}
                >
                  {n.label}
                </Link>
              ))}
              <Link to="/ho-so" className="hover:text-primary border-b py-3 text-sm font-medium">
                Hồ sơ cá nhân
              </Link>
            </nav>
            <div className="px-4">
              <BranchSelector />
            </div>
          </SheetContent>
        </Sheet>

        <Logo />

        <nav className="ml-4 hidden items-center gap-1 lg:flex">
          {navItems.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="hover:bg-accent rounded-full px-2.5 py-2 text-[13px] font-medium whitespace-nowrap transition-colors"
              activeProps={{ className: 'bg-accent text-accent-foreground' }}
              activeOptions={{ exact: n.to === '/' }}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden sm:block">
            <BranchSelector />
          </div>
          <NotificationButton />
          <WishlistButton />
          <QuickCart />
          <ProfileButton />
        </div>
      </div>
    </header>
  );
}
