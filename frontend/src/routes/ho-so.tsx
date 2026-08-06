import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, QrCode, Star, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/site/PageHeader";
import { useCart } from "@/lib/cart";
import { getCustomerToken, getCustomerUser } from "@/lib/api";
import { notifications, products, vnd } from "@/lib/data";

const tiers = [
  { name: "Đồng", min: 0, color: "from-stone-400 to-stone-500" },
  { name: "Bạc", min: 500, color: "from-slate-300 to-slate-400" },
  { name: "Vàng", min: 1500, color: "from-amber-400 to-amber-500" },
  { name: "Kim Cương", min: 3000, color: "from-cyan-400 to-blue-500" },
];

function getNextTier(points: number) {
  for (const t of tiers) {
    if (points < t.min) return t;
  }
  return null;
}

export const Route = createFileRoute("/ho-so")({
  head: () => ({
    meta: [
      { title: "Hồ sơ cá nhân & lịch sử đơn hàng — Trà Trái Cây Tô" },
      {
        name: "description",
        content:
          "Quản lý thông tin cá nhân, thẻ hội viên điện tử, mã QR tích điểm, lịch sử đơn hàng và danh sách yêu thích.",
      },
      { property: "og:title", content: "Hồ sơ cá nhân — Trà Trái Cây Tô" },
      { property: "og:description", content: "Đặt lại đơn cũ chỉ với 1 chạm." },
    ],
  }),
  component: Profile,
});

function Profile() {
  const { wishlist, toggleWishlist } = useCart();
  const saved = products.filter((p) => wishlist.includes(p.id));
  const user = getCustomerUser();
  const isLoggedIn = !!getCustomerToken();

  if (!isLoggedIn || !user) {
    return (
      <>
        <PageHeader
          eyebrow="Tài khoản"
          title="Hồ sơ cá nhân"
          desc="Đăng nhập để xem thông tin tài khoản"
        />
        <div className="container-page flex flex-col items-center justify-center py-20">
          <p className="text-muted-foreground mb-4 text-sm">Bạn chưa đăng nhập</p>
          <p className="text-muted-foreground text-xs">
            Nhấn vào icon <LogIn className="inline size-3" /> ở góc phải trên để đăng nhập.
          </p>
        </div>
      </>
    );
  }

  const userName = user.fullname || "Khách";
  const userTier = user.tier || "Đồng";
  const userPoints = user.points || 0;
  const nextTier = getNextTier(userPoints);
  const currentTierIdx = tiers.findIndex((t) => t.name === userTier);
  const currentTierMin = currentTierIdx >= 0 ? tiers[currentTierIdx].min : 0;
  const nextTierMin = nextTier ? nextTier.min : userPoints;
  const progressPct = nextTier ? Math.min(100, Math.round(((userPoints - currentTierMin) / (nextTierMin - currentTierMin)) * 100)) : 100;

  return (
    <>
      <PageHeader
        eyebrow="Tài khoản"
        title="Hồ sơ cá nhân"
        desc={`${userName} · Hội viên hạng ${userTier}`}
      />

      <div className="container-page grid gap-6 py-10 lg:grid-cols-[340px_1fr]">
        <aside className="space-y-4">
          <div className="gradient-warm text-primary-foreground rounded-2xl p-5 shadow-glow">
            <p className="text-xs tracking-widest uppercase opacity-80">Thẻ hội viên điện tử</p>
            <p className="font-display mt-1 text-2xl font-extrabold">{userName}</p>
            <p className="text-sm opacity-90">Hạng {userTier} · {userPoints.toLocaleString()} điểm</p>
            {nextTier && (
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs opacity-90">
                  <span>Còn {nextTierMin - userPoints} điểm lên {nextTier.name}</span>
                  <span>{progressPct}%</span>
                </div>
                <Progress value={progressPct} className="h-2" />
              </div>
            )}
            <div className="bg-card mt-5 flex items-center gap-3 rounded-xl p-3">
              <QrCode className="text-foreground size-14" />
              <div className="text-foreground">
                <p className="text-sm font-semibold">Mã QR tích điểm</p>
                <p className="text-muted-foreground text-xs">Đưa mã này cho thu ngân tại quầy</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl border p-5">
            <p className="mb-3 text-sm font-semibold">Thông báo</p>
            {notifications.map((n) => (
              <div key={n.id} className="border-b py-2 last:border-0">
                <p className="text-sm">{n.title}</p>
                <p className="text-muted-foreground text-xs">{n.time}</p>
              </div>
            ))}
          </div>
        </aside>

        <Tabs defaultValue="orders">
          <TabsList className="mb-4 flex-wrap">
            <TabsTrigger value="orders">Lịch sử đơn hàng</TabsTrigger>
            <TabsTrigger value="wishlist">Yêu thích</TabsTrigger>
            <TabsTrigger value="review">Đánh giá</TabsTrigger>
            <TabsTrigger value="info">Thông tin</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-4">
            <div className="bg-card rounded-2xl border p-8 text-center">
              <p className="text-muted-foreground text-sm">Chưa có đơn hàng nào.</p>
              <Button asChild variant="hero" size="sm" className="mt-3">
                <Link to="/menu">Đặt món ngay</Link>
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="wishlist">
            <div className="grid gap-4 sm:grid-cols-2">
              {saved.length === 0 && (
                <p className="text-muted-foreground text-sm">Chưa có món yêu thích nào.</p>
              )}
              {saved.map((p) => (
                <div key={p.id} className="bg-card flex items-center gap-3 rounded-2xl border p-4">
                  <img
                    src={p.image}
                    alt={p.name}
                    loading="lazy"
                    className="size-16 rounded-xl object-cover"
                  />
                  <div className="flex-1">
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-muted-foreground text-xs">{p.base}</p>
                    <p className="text-primary font-bold">{vnd(p.price)}</p>
                  </div>
                  <button onClick={() => toggleWishlist(p.id)} aria-label="Bỏ yêu thích">
                    <Heart className="fill-berry text-berry size-5" />
                  </button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="review">
            <div className="bg-card space-y-4 rounded-2xl border p-5">
              <p className="font-display text-lg font-bold">Đánh giá đơn VX240712</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="fill-primary text-primary size-6" />
                ))}
              </div>
              <Textarea rows={3} placeholder="Chia sẻ cảm nhận của bạn về ly trà…" />
              <label className="hover:border-primary text-muted-foreground flex cursor-pointer items-center justify-center rounded-xl border border-dashed p-4 text-sm">
                Tải ảnh ly trà thực tế
              </label>
              <Button variant="hero" onClick={() => toast.success("Cảm ơn bạn đã đánh giá!")}>
                Gửi đánh giá
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="info">
            <div className="bg-card grid gap-4 rounded-2xl border p-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="p-name">Họ tên</Label>
                <Input id="p-name" defaultValue={userName} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-phone">Số điện thoại</Label>
                <Input id="p-phone" defaultValue={user.phone} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="p-email">Email</Label>
                <Input id="p-email" defaultValue="minhtrang@email.com" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Địa chỉ đã lưu</Label>
                <div className="text-muted-foreground space-y-2 text-sm">
                  <p className="rounded-xl border p-3">🏠 Nhà · 125 Nguyễn Huệ, Quận 1</p>
                  <p className="rounded-xl border p-3">🏢 Công ty · 88 Võ Văn Tần, Quận 3</p>
                </div>
              </div>
              <Button
                variant="hero"
                className="sm:col-span-2"
                onClick={() => toast.success("Đã lưu thay đổi")}
              >
                Lưu thay đổi
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
