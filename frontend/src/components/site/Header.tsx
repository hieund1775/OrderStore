import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  Bell,
  Heart,
  MapPin,
  Menu as MenuIcon,
  Search,
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
import { apiPost, getCustomerToken, getCustomerUser, setCustomerToken, setCustomerUser, clearCustomerToken } from '@/lib/api';
import { brand, notifications, products, searchSuggestions, stores, vnd } from '@/lib/data';

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

function SearchBar({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              onFocus={() => setOpen(true)}
              placeholder="Tìm món, trà nền, trái cây hoặc topping…"
              className="bg-secondary/60 h-10 rounded-full border-transparent pl-9"
            />
          </div>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[--radix-popover-trigger-width] min-w-72 p-2">
          <p className="text-muted-foreground px-2 py-1 text-xs font-semibold tracking-wide uppercase">
            Từ khóa hot
          </p>
          <div className="flex flex-wrap gap-1.5 px-2 pb-2">
            {searchSuggestions.map((s) => (
              <Badge
                key={s}
                variant="secondary"
                className="cursor-pointer rounded-full font-normal"
              >
                {s}
              </Badge>
            ))}
          </div>
          <Separator />
          <p className="text-muted-foreground px-2 pt-2 pb-1 text-xs font-semibold tracking-wide uppercase">
            Bán chạy
          </p>
          {products.slice(0, 3).map((p) => (
            <Link
              key={p.id}
              to="/menu"
              onClick={() => setOpen(false)}
              className="hover:bg-accent flex items-center gap-3 rounded-lg p-2"
            >
              <img
                src={p.image}
                alt={p.name}
                loading="lazy"
                className="size-9 rounded-md object-cover"
              />
              <span className="flex-1 text-sm">{p.name}</span>
              <span className="text-primary text-sm font-semibold">{vnd(p.price)}</span>
            </Link>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function BranchSelector() {
  return (
    <Select defaultValue={stores[0].id}>
      <SelectTrigger className="h-9 w-full max-w-56 rounded-full border-dashed text-xs">
        <MapPin className="text-primary size-3.5" />
        <SelectValue placeholder="Chọn chi nhánh" />
      </SelectTrigger>
      <SelectContent>
        {stores.map((s) => (
          <SelectItem key={s.id} value={s.id}>
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
  const [loggedIn, setLoggedIn] = useState(() => !!getCustomerToken());
  const [phone, setPhone] = useState('');
  const [userName, setUserName] = useState(() => getCustomerUser()?.fullname || '');
  const [userTier, setUserTier] = useState(() => getCustomerUser()?.tier || 'Đồng');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [demoOtp, setDemoOtp] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [open, setOpen] = useState(false);
  const [googleScriptLoaded, setGoogleScriptLoaded] = useState(false);
  const [googleBtnNode, setGoogleBtnNode] = useState<HTMLDivElement | null>(null);

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
  }, [open, googleScriptLoaded, googleBtnNode, step]);

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

  async function handleSendOtp() {
    const name = nameInput.trim();
    if (!name) {
      setError('Vui lòng nhập tên của bạn');
      return;
    }
    if (name.length < 2) {
      setError('Tên quá ngắn, vui lòng nhập họ tên đầy đủ');
      return;
    }
    // Chỉ cho phép chữ cái (có dấu tiếng Việt), khoảng trắng và dấu nháy đơn
    if (!/^[\p{L}\s']+$/u.test(name)) {
      setError('Tên không được chứa số hoặc ký tự đặc biệt');
      return;
    }
    if (!phone || phone.replace(/\s/g, '').length < 10) {
      setError('Vui lòng nhập số điện thoại hợp lệ (ít nhất 10 số)');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await apiPost<{ message: string; demo_otp?: string }>('/api/auth/send-otp', {
        phone,
        fullname: nameInput.trim(),
      });
      setStep('otp');
      setOtpSent(true);
      setDemoOtp(data.demo_otp || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể kết nối đến máy chủ');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (!otp || otp.length < 6) {
      setError('Vui lòng nhập đủ 6 số mã OTP');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await apiPost<{
        token: string;
        user: { id: number; fullname: string; phone: string; tier: string; points: number };
      }>('/api/auth/verify-otp', {
        phone,
        code: otp,
        fullname: nameInput.trim(),
      });
      setCustomerToken(data.token);
      setCustomerUser(data.user);
      setUserName(data.user.fullname);
      setUserTier(data.user.tier);
      setLoggedIn(true);
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
    setOtp('');
    setStep('phone');
    setError('');
    setOtpSent(false);
    setDemoOtp('');
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
            setStep('phone');
            setError('');
            setOtp('');
            setOtpSent(false);
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
              {step === 'phone' ? 'Đăng nhập / Đăng ký' : 'Nhập mã OTP'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {step === 'phone' ? (
              <>
                <Input
                  placeholder="Tên của bạn"
                  value={nameInput}
                  onChange={(e) => { setNameInput(e.target.value); setError(''); }}
                />
                <Input
                  placeholder="Số điện thoại"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setError(''); }}
                />
                {error && <p className="text-berry text-xs">{error}</p>}
                <Button variant="hero" className="w-full" onClick={handleSendOtp} disabled={loading}>
                  {loading ? 'Đang gửi mã…' : 'Nhận mã OTP'}
                </Button>
                <div className="text-muted-foreground flex items-center gap-3 text-xs">
                  <Separator className="flex-1" /> hoặc <Separator className="flex-1" />
                </div>
                <div ref={setGoogleBtnNode} className="w-full flex justify-center min-h-[44px] items-center" />
                <p className="text-muted-foreground text-center text-xs">
                  Nhập tên & SĐT để nhận mã OTP xác thực.
                </p>
              </>
            ) : (
              <>
                <p className="text-muted-foreground text-center text-sm">
                  Mã OTP đã được gửi đến <strong>{phone}</strong>
                </p>
                {demoOtp && (
                  <p className="text-leaf text-center text-xs font-semibold bg-leaf/10 rounded py-1">
                    🔢 Demo OTP: {demoOtp}
                  </p>
                )}
                <Input
                  placeholder="Nhập mã OTP 6 số"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                  className="text-center text-lg tracking-[0.3em]"
                />
                {error && <p className="text-berry text-xs">{error}</p>}
                <Button variant="hero" className="w-full" onClick={handleVerifyOtp} disabled={loading}>
                  {loading ? 'Đang xác thực…' : 'Xác nhận'}
                </Button>
                <button
                  className="text-muted-foreground text-xs text-center w-full underline"
                  onClick={() => { setStep('phone'); setError(''); setOtp(''); setOtpSent(false); }}
                >
                  Quay lại
                </button>
              </>
            )}
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
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>{userName} · Hạng {userTier}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/ho-so">Hồ sơ cá nhân</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/ho-so">QR tích điểm</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/theo-doi-don" search={{ code: undefined }}>Theo dõi đơn hàng</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={resetLogin}>Đăng xuất</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header() {
  return (
    <header className="bg-background/85 sticky top-0 z-50 border-b backdrop-blur-md">
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

        <div className="ml-auto flex items-center gap-1">
          <SearchBar className="hidden w-64 xl:block" />
          <div className="hidden md:block">
            <BranchSelector />
          </div>
          <NotificationButton />
          <WishlistButton />
          <QuickCart />
          <ProfileButton />
        </div>
      </div>
      <div className="container-page pb-3 xl:hidden">
        <SearchBar />
      </div>
    </header>
  );
}
