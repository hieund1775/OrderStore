import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import {
  Bell,
  Heart,
  MapPin,
  Menu as MenuIcon,
  ShoppingCart,
  User,
  ChevronRight,
  Trash2,
  Loader2,
  RefreshCw,
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
import { buildWishlistQuickCartItem, useWishlist, type WishlistItem } from '@/lib/wishlist';
import { toast } from 'sonner';
import {
  apiPost,
  getCustomerToken,
  getCustomerUser,
  setCustomerToken,
  setCustomerUser,
  clearCustomerToken,
} from '@/lib/api';
import { brand, vnd } from '@/lib/data';
import {
  isSafeInternalLink,
  useCustomerNotifications,
  type AppNotification,
} from '@/lib/notifications';

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
          <ShoppingCart className="size-5" />
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
  const { addItem } = useCart();
  const { items, count, isLoading, isError, refetch, removeFavorite, isPending } = useWishlist();

  const handleQuickAdd = (item: WishlistItem) => {
    const cartItem = buildWishlistQuickCartItem(item);
    if (!cartItem) {
      toast.error('Thông tin món chưa đầy đủ, vui lòng chọn lại từ thực đơn');
      return;
    }
    const success = addItem(cartItem);
    if (success) {
      toast.success(`Đã thêm "${item.product_name}" vào giỏ hàng`);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative hidden rounded-full sm:inline-flex"
          aria-label={`Yêu thích (${count})`}
        >
          <Heart className="size-5" />
          {count > 0 && (
            <span className="bg-berry text-white absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display">Món yêu thích ({count})</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3 px-4">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-sm">Đang tải danh sách yêu thích...</p>
            </div>
          )}

          {!isLoading && isError && (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
              <p className="text-destructive text-sm">Không thể tải danh sách yêu thích.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="mr-1.5 size-3.5" /> Thử lại
              </Button>
            </div>
          )}

          {!isLoading && !isError && items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Heart className="mb-2 size-10 stroke-1 text-muted-foreground/40" />
              <p className="text-sm font-medium">Chưa có món nào trong danh sách yêu thích</p>
              <p className="text-xs text-muted-foreground/80 mt-1">Hãy bấm thả tim các món bạn yêu thích trên thực đơn nhé!</p>
            </div>
          )}

          {!isLoading && !isError && items.map((p) => {
            const pending = isPending(p.product_id);
            return (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border p-3 bg-card shadow-sm">
                <img
                  src={p.image_url || '/placeholder.png'}
                  alt={p.product_name || 'Món'}
                  loading="lazy"
                  className="size-14 rounded-lg object-cover bg-muted"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{p.product_name}</p>
                  <p className="text-xs text-muted-foreground">{p.base_tea || 'Thiếu dữ liệu cốt trà'}</p>
                  <p className="text-primary text-sm font-bold mt-0.5">{vnd(p.price)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="soft"
                    size="sm"
                    className="text-xs h-8 px-2.5"
                    onClick={() => handleQuickAdd(p)}
                  >
                    + Giỏ
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeFavorite(p.product_id)}
                    aria-label={`Xóa ${p.product_name} khỏi yêu thích`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function NotificationButton() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { user, data, isLoading, isError, refetch, markRead, markAllRead, isMutating } = useCustomerNotifications();
  const items = (data?.notifications ?? []).slice(0, 5);
  const unreadCount = data?.unread_count ?? 0;

  async function handleItemClick(n: AppNotification) {
    if (user?.id && !n.is_read) await markRead(n.id).catch(() => undefined);
    setOpen(false);
    if (isSafeInternalLink(n.link)) {
      navigate({ to: n.link as any });
    }
  }

  async function handleReadAll() {
    if (!user?.id) return;
    await markAllRead().catch(() => undefined);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative inline-flex rounded-full"
          aria-label="Thông báo"
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex size-4 min-w-4 items-center justify-center rounded-full text-[10px] font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <div className="flex items-center justify-between px-2 py-1.5 border-b mb-1">
          <p className="text-sm font-bold">Thông báo</p>
          {user && unreadCount > 0 && (
            <button
              onClick={handleReadAll}
              disabled={isMutating}
              className="text-[11px] text-primary hover:underline font-medium"
            >
              Đọc tất cả
            </button>
          )}
        </div>
        {!user ? (
          <div className="py-6 text-center text-xs text-muted-foreground px-3">
            <Bell className="size-8 mx-auto mb-2 opacity-30" />
            <p className="font-medium text-foreground">Chưa đăng nhập</p>
            <p className="mt-1">Đăng nhập tài khoản để theo dõi thông báo đơn hàng và ưu đãi.</p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : isError ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            <p>Không tải được thông báo.</p>
            <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs" onClick={() => void refetch()}>
              <RefreshCw className="mr-1 size-3" /> Thử lại
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            <Bell className="size-8 mx-auto mb-2 opacity-30" />
            <p>Bạn không có thông báo nào mới</p>
          </div>
        ) : (
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {items.map((n) => (
              <div
                key={n.id}
                onClick={() => handleItemClick(n)}
                className={`cursor-pointer rounded-lg p-2 transition-colors ${
                  !n.is_read ? 'bg-primary/5 hover:bg-primary/10 font-semibold' : 'hover:bg-accent text-muted-foreground'
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <p className="text-xs text-foreground font-medium">{n.title}</p>
                  {!n.is_read && <span className="size-2 rounded-full bg-primary shrink-0 mt-1" />}
                </div>
                {n.body && <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>}
                <p className="text-[10px] text-muted-foreground/70 mt-1">
                  {new Date(n.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · {new Date(n.created_at).toLocaleDateString('vi-VN')}
                </p>
              </div>
            ))}
            <div className="pt-2 border-t text-center">
              <Link
                to="/ho-so"
                search={{ tab: 'notifications' } as any}
                onClick={() => setOpen(false)}
                className="text-xs text-primary hover:underline font-medium block py-1"
              >
                Xem tất cả thông báo ➔
              </Link>
            </div>
          </div>
        )}
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
