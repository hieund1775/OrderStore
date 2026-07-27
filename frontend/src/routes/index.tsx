import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Leaf, ShieldCheck, Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductCard } from "@/components/menu/ProductCard";
import { products, promotions, stores } from "@/lib/data";
import heroImg from "@/assets/hero-tea.jpg";
import storyImg from "@/assets/story.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tiệm Trà Vườn Xanh — Đặt trà trái cây tươi & tích điểm" },
      {
        name: "description",
        content:
          "Đặt trà trái cây tươi online: tùy chỉnh trà nền, đường, đá, topping. Giao nhanh, tích điểm đổi quà mỗi ly.",
      },
      { property: "og:title", content: "Tiệm Trà Vườn Xanh — Trà trái cây tươi mỗi ngày" },
      {
        property: "og:description",
        content: "Trà ủ mới trong ngày, 100% trái cây tươi. Đặt online, tích điểm, đổi quà.",
      },
    ],
  }),
  component: Home,
});

const commitments = [
  { icon: Leaf, title: "100% Trái cây tươi", desc: "Nhập mới mỗi sáng, sơ chế tại quầy." },
  { icon: Sparkles, title: "Không chất bảo quản", desc: "Trà ủ trong ngày, hết ngày là bỏ." },
  {
    icon: ShieldCheck,
    title: "Đạt chuẩn ATVSTP",
    desc: "Quy trình kiểm định định kỳ toàn hệ thống.",
  },
];

function Home() {
  const bestSellers = products.filter(
    (p) => p.tags.includes("best-seller") || p.tags.includes("new"),
  );

  return (
    <>
      {/* Hero */}
      <section className="relative">
        <img
          src={heroImg}
          alt="Ly trà trái cây tươi cùng dâu, xoài và cam"
          width={1920}
          height={1088}
          className="h-[62vh] max-h-[560px] min-h-80 w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/25 to-transparent" />
        <div className="absolute inset-0 flex items-center">
          <div className="container-page">
            <div className="text-primary-foreground max-w-xl">
              <Badge className="bg-card text-foreground mb-4 rounded-full">
                🍑 Seasonal Menu 2026
              </Badge>
              <h1 className="font-display text-3xl leading-tight font-extrabold drop-shadow md:text-5xl">
                Trà đậm vị, trái cây tươi
                <br />
                pha mới từng ly
              </h1>
              <p className="mt-4 max-w-md text-sm drop-shadow md:text-base">
                Chọn cốt trà, mức đường, mức đá và topping theo đúng khẩu vị của bạn — giao đến
                trong 25 phút.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild variant="hero" size="lg">
                  <Link to="/menu">
                    Đặt món ngay <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="lg">
                  <Link to="/su-kien">Xem ưu đãi</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Commitments */}
      <section className="container-page -mt-10 relative z-10">
        <div className="bg-card grid gap-4 rounded-2xl border p-5 shadow-card-soft sm:grid-cols-3">
          {commitments.map((c) => (
            <div key={c.title} className="flex items-start gap-3">
              <span className="bg-accent text-accent-foreground flex size-10 shrink-0 items-center justify-center rounded-xl">
                <c.icon className="size-5" />
              </span>
              <div>
                <p className="text-sm font-bold">{c.title}</p>
                <p className="text-muted-foreground text-xs">{c.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Brand story */}
      <section className="container-page grid items-center gap-8 py-16 md:grid-cols-2 md:py-20">
        <div className="overflow-hidden rounded-3xl">
          <img
            src={storyImg}
            alt="Sơ chế trái cây tươi và trà lá rời tại quầy"
            loading="lazy"
            width={1024}
            height={768}
            className="w-full object-cover"
          />
        </div>
        <div>
          <p className="text-primary text-xs font-bold tracking-[0.2em] uppercase">
            Câu chuyện thương hiệu
          </p>
          <h2 className="font-display mt-2 text-2xl font-extrabold md:text-3xl">
            Mỗi ly trà bắt đầu từ 5 giờ sáng
          </h2>
          <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
            Trà được ủ mới mỗi 4 tiếng từ lá trà Thái Nguyên và Bảo Lộc. Trái cây được chọn tại
            vườn, giao đến cửa hàng trước giờ mở cửa và cắt gọt thủ công ngay tại quầy — không siro
            cô đặc, không chất bảo quản.
          </p>
          <div className="mt-6 grid grid-cols-3 gap-4">
            {[
              { n: "48", l: "Chi nhánh" },
              { n: "1.2M", l: "Ly trà mỗi năm" },
              { n: "4.8★", l: "Điểm hài lòng" },
            ].map((s) => (
              <div key={s.l} className="bg-secondary/60 rounded-2xl p-4 text-center">
                <p className="font-display text-primary text-2xl font-extrabold">{s.n}</p>
                <p className="text-muted-foreground text-xs">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Best sellers */}
      <section className="container-page pb-16">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-primary text-xs font-bold tracking-[0.2em] uppercase">
              Hot trong ngày
            </p>
            <h2 className="font-display text-2xl font-extrabold md:text-3xl">Best Seller</h2>
          </div>
          <Button asChild variant="soft" size="sm">
            <Link to="/menu">
              Xem toàn bộ menu <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {bestSellers.slice(0, 4).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* Promotions teaser */}
      <section className="bg-secondary/50 border-y py-16">
        <div className="container-page">
          <h2 className="font-display mb-6 text-2xl font-extrabold md:text-3xl">
            Ưu đãi đang diễn ra
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {promotions
              .filter((p) => p.status === "Đang diễn ra")
              .map((p) => (
                <div key={p.id} className="bg-card rounded-2xl border p-5">
                  <span className="text-3xl">{p.emoji}</span>
                  <p className="font-display mt-3 text-lg font-bold">{p.title}</p>
                  <p className="text-muted-foreground text-xs">{p.period}</p>
                  <p className="text-muted-foreground mt-2 text-sm">{p.rule}</p>
                </div>
              ))}
            <div className="gradient-warm text-primary-foreground flex flex-col justify-center rounded-2xl p-5">
              <Star className="mb-2 size-6" />
              <p className="font-display text-lg font-bold">Tích điểm mỗi ly</p>
              <p className="mt-1 text-sm opacity-90">
                1 điểm cho mỗi 10.000₫ — đổi voucher, topping và quà tặng.
              </p>
              <Button asChild variant="secondary" size="sm" className="mt-4 w-fit">
                <Link to="/hoi-vien">Xem đặc quyền</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stores teaser */}
      <section className="container-page py-16">
        <div className="mb-6 flex items-end justify-between gap-3">
          <h2 className="font-display text-2xl font-extrabold md:text-3xl">Ghé tiệm gần bạn</h2>
          <Button asChild variant="soft" size="sm">
            <Link to="/cua-hang">Tất cả chi nhánh</Link>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stores.slice(0, 3).map((s) => (
            <div key={s.id} className="bg-card rounded-2xl border p-5">
              <p className="font-semibold">{s.name}</p>
              <p className="text-muted-foreground mt-1 text-sm">{s.address}</p>
              <p className="text-muted-foreground mt-2 text-xs">Mở cửa {s.hours}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
