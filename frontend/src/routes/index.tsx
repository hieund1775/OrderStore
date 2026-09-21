import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  Clock,
  Copy,
  Flame,
  Leaf,
  MapPin,
  Navigation,
  Phone,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Tag,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductCard } from "@/components/menu/ProductCard";
import {
  mapApiProduct,
  products as fallbackProducts,
  promotions as fallbackPromotions,
  stores as fallbackStores,
  vnd,
  type ApiCatalogProduct,
  type Product,
  type ProductTag,
  type Store,
} from "@/lib/data";
import { apiGet } from "@/lib/api";
import { useBranch } from "@/lib/branch";
import { formatVoucherDate } from "@/lib/promotion-status";
import heroImg from "@/assets/hero-tea.jpg";
import storyImg from "@/assets/story.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Trà Trái Cây Tô — Đặt trà trái cây tươi & tích điểm" },
      {
        name: "description",
        content:
          "Đặt trà trái cây tươi online: tùy chỉnh trà nền, đường, đá, topping. Giao nhanh, tích điểm đổi quà mỗi ly.",
      },
      { property: "og:title", content: "Trà Trái Cây Tô — Trà trái cây tươi mỗi ngày" },
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

type EnrichedPromo = {
  id: string | number;
  title: string;
  code: string;
  discountText: string;
  tag: string;
  emoji: string;
  period: string;
  minOrder?: string;
  maxDiscount?: string;
  rule: string;
};

const defaultFeaturedPromos: EnrichedPromo[] = [
  {
    id: "p1",
    title: "Mua 1 Tặng 1 Trà Cam Sả",
    code: "CAMSA11",
    discountText: "MUA 1 TẶNG 1",
    tag: "Hot Deal",
    emoji: "🍊",
    period: "01/07 – 31/07",
    minOrder: "Đơn từ 0₫",
    maxDiscount: "Tối đa 1 ly",
    rule: "Áp dụng cho đơn tại quầy và đặt online từ 14:00 – 17:00 mỗi ngày.",
  },
  {
    id: "p2",
    title: "Giảm 30% Trà Trái Cây Tuyết",
    code: "SNOW30",
    discountText: "GIẢM 30%",
    tag: "Ưu đãi hot",
    emoji: "🍉",
    period: "10/07 – 20/07",
    minOrder: "Đơn từ 89.000₫",
    maxDiscount: "Tối đa 30.000₫",
    rule: "Giảm tối đa 30.000₫, áp dụng cho toàn bộ dòng Trà Tuyết mát lạnh.",
  },
  {
    id: "p3",
    title: "Freeship Đơn Hàng Đầu Tiên",
    code: "FREESHIP",
    discountText: "FREESHIP 0Đ",
    tag: "Khách mới",
    emoji: "🚚",
    period: "Cả tuần",
    minOrder: "Đơn từ 50.000₫",
    maxDiscount: "Tối đa 25.000₫",
    rule: "Miễn phí giao hàng bán kính 5km cho đơn hàng trải nghiệm đầu tiên.",
  },
];

function getStoreAmenities(amenities: unknown): string[] {
  if (!amenities) return ["Máy lạnh", "Mua mang đi", "Chỗ đỗ xe"];
  if (Array.isArray(amenities)) return amenities.map(String);
  if (typeof amenities === "string") {
    try {
      const parsed = JSON.parse(amenities);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return amenities.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return ["Máy lạnh", "Mua mang đi", "Chỗ đỗ xe"];
}

function formatAmenityLabel(amenity: string): string {
  const lower = amenity.toLowerCase();
  if (lower.includes("lạnh")) return "❄️ Máy lạnh";
  if (lower.includes("đỗ") || lower.includes("xe") || lower.includes("ô tô")) return "🚗 Đỗ ô tô";
  if (lower.includes("mang đi")) return "🛵 Mua mang đi";
  if (lower.includes("giao")) return "⚡ Giao 25p";
  if (lower.includes("wifi")) return "📶 Wifi miễn phí";
  if (lower.includes("rộng") || lower.includes("view")) return "🌿 Không gian thoáng";
  return `✨ ${amenity}`;
}

function Home() {
  const navigate = useNavigate();
  const { selectStore } = useBranch();
  const [catalogProducts, setCatalogProducts] = useState<Product[]>(fallbackProducts);
  const [storeList, setStoreList] = useState<Store[]>(fallbackStores);
  const [apiPromos, setApiPromos] = useState<any[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<ApiCatalogProduct[]>("/api/products")
      .then((rows) => {
        if (!cancelled && rows && rows.length > 0) {
          const activeRows = rows.filter(
            (r: any) =>
              (r.status === undefined || r.status === "active") &&
              !r.archived_at &&
              r.is_available !== false &&
              !r.slug?.includes("--archived-"),
          );
          setCatalogProducts(activeRows.map(mapApiProduct));
        }
      })
      .catch(() => {});

    apiGet<Store[]>("/api/stores")
      .then((rows) => {
        if (!cancelled && rows && rows.length > 0) {
          setStoreList(rows);
        }
      })
      .catch(() => {});

    apiGet<any[]>("/api/promotions")
      .then((rows) => {
        if (!cancelled && rows && rows.length > 0) {
          setApiPromos(rows.filter((p) => p.is_active !== false && p.status !== "Đã kết thúc"));
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCopyCode = (code: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(code);
    }
    setCopiedCode(code);
    toast.success(`Đã sao chép mã voucher "${code}". Nhập tại bước thanh toán nhé!`);
    setTimeout(() => {
      setCopiedCode((prev) => (prev === code ? null : prev));
    }, 2500);
  };

  const handleUsePromo = (code: string) => {
    handleCopyCode(code);
    void navigate({ to: "/menu" });
  };

  const handleOrderAtBranch = (store: Store) => {
    selectStore(store.id);
    toast.success(`Đã chọn chi nhánh ${store.name} — Bắt đầu gọi món!`);
    void navigate({ to: "/menu" });
  };

  const activePromos: EnrichedPromo[] = useMemo(() => {
    if (apiPromos.length > 0) {
      const mapped: EnrichedPromo[] = apiPromos.map((p) => {
        const discountText =
          p.discount_type === "percent"
            ? `GIẢM ${p.discount_value}%`
            : p.discount_value
              ? `GIẢM ${vnd(p.discount_value)}`
              : "ƯU ĐÃI";
        const rawCode = (p.code || "UUDAI").trim();
        const code = rawCode.toUpperCase() === "NEW1000%" ? "NEW100%" : rawCode;
        const title = (p.title || "Ưu đãi đặc biệt").replace(/NEW1000%/g, "NEW100%");
        const period = p.end_date ? `Đến ${formatVoucherDate(p.end_date)}` : "Vô thời hạn";
        const rule = (
          p.rule ||
          p.description ||
          `Áp dụng giảm ${discountText} cho đơn hàng trực tuyến & tại quầy.`
        ).replace(/NEW1000%/g, "NEW100%");

        return {
          id: p.id,
          title,
          code,
          discountText,
          tag: p.voucher_type === "single_use" ? "Mã cá nhân" : "Ưu đãi hot",
          emoji: p.discount_type === "percent" ? "🏷️" : "🎁",
          period,
          minOrder: p.min_order ? `Đơn từ ${vnd(p.min_order)}` : undefined,
          maxDiscount: p.max_discount ? `Tối đa ${vnd(p.max_discount)}` : undefined,
          rule,
        };
      });
      const existingCodes = new Set(mapped.map((m) => m.code));
      const extra = defaultFeaturedPromos.filter((d) => !existingCodes.has(d.code));
      return [...mapped, ...extra].slice(0, 3);
    }
    return defaultFeaturedPromos;
  }, [apiPromos]);

  const bestSellers = useMemo(() => {
    const activeProducts = catalogProducts.filter(
      (p) =>
        (p as any).status !== "archived" &&
        (p as any).status !== "inactive" &&
        !p.slug?.includes("--archived-"),
    );
    const filtered = activeProducts.filter(
      (p) => p.tags && (p.tags.includes("best-seller") || p.tags.includes("new")),
    );
    let list: Product[] = [];
    if (filtered.length >= 4) {
      list = filtered.slice(0, 4);
    } else if (filtered.length > 0) {
      const extra = activeProducts.filter((p) => !filtered.some((f) => f.id === p.id));
      list = [...filtered, ...extra].slice(0, 4);
    } else {
      list = activeProducts.length > 0 ? activeProducts.slice(0, 4) : fallbackProducts.slice(0, 4);
    }

    // Curated tag patterns from Image 1:
    // Card 1: Best Seller + Trái Cây Theo Mùa
    // Card 2: Best Seller
    // Card 3: Món Mới
    // Card 4: Món Mới + Trái Cây Theo Mùa
    const defaultTagPatterns: ProductTag[][] = [
      ["best-seller", "seasonal"],
      ["best-seller"],
      ["new"],
      ["new", "seasonal"],
    ];

    return list.slice(0, 4).map((p, idx) => {
      const hasTags = p.tags && p.tags.length > 0;
      return {
        ...p,
        tags: hasTags ? p.tags : defaultTagPatterns[idx % defaultTagPatterns.length],
      };
    });
  }, [catalogProducts]);

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
                  <Link to="/cua-hang">Ghé cửa hàng</Link>
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
      <section className="bg-secondary/40 border-y py-16">
        <div className="container-page">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Flame className="size-3.5" />
                </span>
                <p className="text-primary text-xs font-bold tracking-[0.2em] uppercase">
                  Tiết kiệm mỗi ngày
                </p>
              </div>
              <h2 className="font-display mt-1 text-2xl font-extrabold md:text-3xl">
                Ưu đãi đang diễn ra
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Thu thập mã giảm giá & voucher độc quyền, nhập mã khi thanh toán để nhận ngay ưu đãi.
              </p>
            </div>
            <Button asChild variant="soft" size="sm">
              <Link to="/menu">
                Xem toàn bộ món <ArrowRight className="size-4 ml-1" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {activePromos.map((promo) => (
              <div
                key={promo.id}
                className="bg-card group relative flex flex-col justify-between overflow-hidden rounded-2xl border shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg"
              >
                {/* Coupon top banner */}
                <div className="gradient-warm flex items-center justify-between px-4 py-3 text-primary-foreground">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{promo.emoji}</span>
                    <span className="font-display text-base font-black tracking-wide">
                      {promo.discountText}
                    </span>
                  </div>
                  <span className="bg-white/20 backdrop-blur-xs rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    {promo.tag}
                  </span>
                </div>

                {/* Coupon Body */}
                <div className="flex flex-1 flex-col justify-between p-4">
                  <div>
                    <h3 className="font-display group-hover:text-primary text-base font-bold leading-snug transition-colors line-clamp-1">
                      {promo.title}
                    </h3>

                    {/* Expiry & conditions */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="size-3 text-amber-500" />
                        HSD: {promo.period}
                      </span>
                      {promo.minOrder && (
                        <span className="bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 text-[11px] font-medium">
                          {promo.minOrder}
                        </span>
                      )}
                      {promo.maxDiscount && (
                        <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[11px] font-medium">
                          {promo.maxDiscount}
                        </span>
                      )}
                    </div>

                    <p className="text-muted-foreground mt-2 text-xs leading-relaxed line-clamp-2">
                      {promo.rule}
                    </p>
                  </div>

                  {/* Voucher code box & Action */}
                  <div className="mt-4 space-y-2 border-t border-dashed pt-3">
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-2.5 py-1.5">
                      <div className="min-w-0">
                        <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">
                          Mã ưu đãi
                        </p>
                        <p className="font-mono text-xs font-extrabold tracking-wider text-primary truncate">
                          {promo.code}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={copiedCode === promo.code ? "default" : "secondary"}
                        className={`h-7 px-2.5 text-xs font-semibold shrink-0 transition-all ${
                          copiedCode === promo.code
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : ""
                        }`}
                        onClick={(e) => handleCopyCode(promo.code, e)}
                      >
                        {copiedCode === promo.code ? (
                          <>
                            <Check className="size-3 mr-1" />
                            Đã chép
                          </>
                        ) : (
                          <>
                            <Copy className="size-3 mr-1" />
                            Sao chép
                          </>
                        )}
                      </Button>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      className="w-full gap-1 font-semibold text-xs h-8"
                      onClick={() => handleUsePromo(promo.code)}
                    >
                      Dùng ngay <ArrowRight className="size-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {/* Membership VIP Box */}
            <div className="gradient-warm text-primary-foreground relative flex flex-col justify-between overflow-hidden rounded-2xl p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
              <div>
                <div className="flex size-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-xs text-white">
                  <Sparkles className="size-5" />
                </div>
                <span className="mt-3 inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                  Quyền lợi thành viên
                </span>
                <h3 className="font-display mt-2 text-lg font-extrabold leading-tight">
                  Tích điểm đổi quà mỗi ly trà
                </h3>
                <p className="mt-2 text-xs leading-relaxed opacity-95">
                  Mỗi 10.000₫ = 1 điểm thưởng. Đổi ngay voucher giảm 50%, freeship và nhận ly miễn phí vào dịp sinh nhật!
                </p>
              </div>

              <div className="mt-5 space-y-2">
                <Button
                  asChild
                  size="sm"
                  className="bg-card text-foreground hover:bg-card/90 w-full text-xs font-bold shadow-sm h-8"
                >
                  <Link to="/ho-so">
                    Tích điểm ngay <ArrowRight className="ml-1 size-3" />
                  </Link>
                </Button>
                <p className="text-center text-[10px] opacity-80">
                  Áp dụng cùng lúc với voucher khuyến mãi
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stores teaser */}
      <section className="container-page py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MapPin className="size-3.5" />
              </span>
              <p className="text-primary text-xs font-bold tracking-[0.2em] uppercase">
                Không gian & Chi nhánh
              </p>
            </div>
            <h2 className="font-display mt-1 text-2xl font-extrabold md:text-3xl">
              Ghé tiệm gần bạn
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {storeList.length > 0
                ? `Hệ thống ${storeList.length} không gian thưởng thức trà trái cây tươi mát, hiện đại sẵn sàng phục vụ tại chỗ và mang đi.`
                : "Không gian thưởng thức trà trái cây tươi mát, hiện đại sẵn sàng phục vụ tại chỗ và mang đi."}
            </p>
          </div>
          <Button asChild variant="soft" size="sm">
            <Link to="/cua-hang">
              Tất cả chi nhánh ({storeList.length}) <ArrowRight className="size-4 ml-1" />
            </Link>
          </Button>
        </div>

        {/* Store Cards Grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {storeList.slice(0, 3).map((s) => (
            <div
              key={s.id}
              className="bg-card group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg"
            >
              <div>
                {/* Store status & district */}
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                    Đang mở cửa
                  </span>
                  {(s.district || s.city) && (
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                      {s.district || s.city}
                    </span>
                  )}
                </div>

                {/* Store Name */}
                <h3 className="font-display group-hover:text-primary text-lg font-bold transition-colors line-clamp-1">
                  {s.name}
                </h3>

                {/* Details list */}
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <MapPin className="text-primary mt-0.5 size-4 shrink-0" />
                    <span className="line-clamp-2 leading-snug">{s.address}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="text-primary size-4 shrink-0" />
                    <span>Mở cửa {s.hours || "07:00 – 22:30"}</span>
                  </div>
                  {s.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="text-primary size-4 shrink-0" />
                      <a
                        href={`tel:${s.phone.replace(/\s+/g, "")}`}
                        className="hover:text-primary hover:underline font-medium"
                      >
                        {s.phone}
                      </a>
                    </div>
                  )}
                </div>

                {/* Amenities pills */}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {getStoreAmenities(s.amenities).slice(0, 3).map((amenity, idx) => (
                    <span
                      key={idx}
                      className="bg-muted/70 text-muted-foreground inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium"
                    >
                      {formatAmenityLabel(amenity)}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-5 grid grid-cols-2 gap-2 border-t pt-4">
                <Button
                  type="button"
                  size="sm"
                  className="w-full gap-1.5 font-semibold text-xs shadow-sm"
                  onClick={() => handleOrderAtBranch(s)}
                >
                  <ShoppingBag className="size-3.5" />
                  Đặt tại đây
                </Button>
                <Button
                  asChild
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full gap-1.5 font-medium text-xs hover:bg-secondary"
                >
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.name}, ${s.address}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Navigation className="size-3.5" />
                    Chỉ đường
                  </a>
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Benefits bar */}
        <div className="mt-8 grid gap-4 rounded-2xl border bg-secondary/30 p-5 sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Clock className="size-5" />
            </span>
            <div>
              <p className="text-sm font-bold">Giao nhanh 25 phút</p>
              <p className="text-muted-foreground text-xs">Đá để riêng, giữ trọn hương vị tươi ngon</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShoppingBag className="size-5" />
            </span>
            <div>
              <p className="text-sm font-bold">Nhận tại quầy nhanh chóng</p>
              <p className="text-muted-foreground text-xs">Đặt trước qua website, ghé tiệm nhận ngay</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Navigation className="size-5" />
            </span>
            <div>
              <p className="text-sm font-bold">Không gian mát lạnh & Wifi</p>
              <p className="text-muted-foreground text-xs">Chỗ ngồi làm việc và gặp gỡ thoải mái</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
