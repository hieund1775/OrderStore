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
  promotions as fallbackPromotions,
  vnd,
  type ApiCatalogProduct,
  type Product,
  type ProductTag,
  type Store,
} from "@/lib/data";
import { apiGet } from "@/lib/api";
import { useBranch } from "@/lib/branch";
import { isStoreOpen } from "@/lib/store-hours";
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

export const DEFAULT_STORE_AMENITIES = [
  "Chỗ đỗ ô tô",
  "Máy lạnh",
  "Mua mang đi",
  "Giao 25p",
  "Không gian thoáng",
];

export function getStoreAmenities(amenities: unknown): string[] {
  if (!amenities) return DEFAULT_STORE_AMENITIES;
  if (Array.isArray(amenities)) {
    const list = amenities.map(String).map((s) => s.trim()).filter(Boolean);
    return list.length > 0 ? list : DEFAULT_STORE_AMENITIES;
  }
  if (typeof amenities === "string") {
    try {
      const parsed = JSON.parse(amenities);
      if (Array.isArray(parsed)) {
        const list = parsed.map(String).map((s) => s.trim()).filter(Boolean);
        return list.length > 0 ? list : DEFAULT_STORE_AMENITIES;
      }
    } catch {
      const list = amenities.split(",").map((s) => s.trim()).filter(Boolean);
      return list.length > 0 ? list : DEFAULT_STORE_AMENITIES;
    }
  }
  return DEFAULT_STORE_AMENITIES;
}

export function formatAmenityLabel(amenity: string): string {
  const lower = amenity.toLowerCase();
  if (lower.includes("lạnh")) return "❄️ Máy lạnh";
  if (lower.includes("đỗ") || lower.includes("xe") || lower.includes("ô tô")) return "🚗 Đỗ ô tô";
  if (lower.includes("mang đi")) return "🛵 Mua mang đi";
  if (lower.includes("giao")) return "⚡ Giao 25p";
  if (lower.includes("wifi")) return "📶 Wifi miễn phí";
  if (lower.includes("rộng") || lower.includes("view") || lower.includes("thoáng")) return "🌿 Không gian thoáng";
  return `✨ ${amenity}`;
}

export function Home() {
  const navigate = useNavigate();
  const { selectStore } = useBranch();
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [storeList, setStoreList] = useState<Store[]>([]);
  const [loadingStores, setLoadingStores] = useState(true);
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
        } else if (!cancelled) {
          setCatalogProducts([]);
        }
      })
      .catch(() => {
        if (!cancelled) setCatalogProducts([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingProducts(false);
      });

    apiGet<Store[]>("/api/stores")
      .then((rows) => {
        if (!cancelled && rows && rows.length > 0) {
          setStoreList(rows);
        } else if (!cancelled) {
          setStoreList([]);
        }
      })
      .catch(() => {
        if (!cancelled) setStoreList([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingStores(false);
      });

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
    if (!store.is_active) {
      toast.error(`${store.name} đang tạm ngưng phục vụ`);
      return;
    }
    if (!isStoreOpen(store.hours || "07:00 – 22:30")) {
      toast.error("Quán hiện đã đóng cửa");
      return;
    }
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

    if (activeProducts.length === 0) {
      return [];
    }

    // 1. Quality Gate:
    // If a product has reviews (reviews > 0), its rating MUST be >= 3.5.
    // Products with rating < 3.5 are excluded from Best Seller candidacy.
    const qualifiedProducts = activeProducts.filter((p) => {
      const revCount = Number(p.reviews || 0);
      if (revCount > 0) {
        return Number(p.rating || 0) >= 3.5;
      }
      return true;
    });

    const candidates = qualifiedProducts.length > 0 ? qualifiedProducts : activeProducts;

    // 2. Best Seller Score:
    // Balance between actual sales volume (total_sold) and verified reviews with logarithmic scaling.
    const scoredProducts = candidates.map((p) => {
      const sold = Number(p.total_sold || 0);
      const reviews = Number(p.reviews || 0);
      const rating = Number(p.rating || 0);

      // Logarithmic review score ensures 4.0 with 120 reviews can legitimately outrank 5.0 with 1 review
      const reviewScore = reviews > 0 ? rating * Math.log10(reviews + 9) * 10 : 0;
      const score = sold * 0.6 + reviewScore * 0.4;

      return {
        product: p,
        score,
        sold,
        reviews,
        rating,
        category: p.line || p.base || "Khác",
      };
    });

    // Primary: Score DESC; Secondary: sold DESC; Tertiary: rating DESC
    scoredProducts.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.sold !== a.sold) return b.sold - a.sold;
      return b.rating - a.rating;
    });

    // 3. Category Round-Robin (Diversity Distribution):
    // Distribute across diverse categories so homepage doesn't display only 1 category.
    const selected: Product[] = [];
    const usedCategories = new Set<string>();
    const usedProductIds = new Set<string>();

    // Pass 1: Select highest-scoring item from each distinct category
    for (const item of scoredProducts) {
      if (selected.length >= 4) break;
      if (!usedCategories.has(item.category)) {
        selected.push(item.product);
        usedCategories.add(item.category);
        usedProductIds.add(item.product.id);
      }
    }

    // Pass 2: Fill remaining slots with next highest-scoring items
    if (selected.length < 4) {
      for (const item of scoredProducts) {
        if (selected.length >= 4) break;
        if (!usedProductIds.has(item.product.id)) {
          selected.push(item.product);
          usedProductIds.add(item.product.id);
        }
      }
    }

    // Pass 3: Fallback if still under 4 items
    if (selected.length < 4) {
      for (const p of activeProducts) {
        if (selected.length >= 4) break;
        if (!usedProductIds.has(p.id)) {
          selected.push(p);
          usedProductIds.add(p.id);
        }
      }
    }

    // 4. Dynamic Badges/Tags (without seasonal fruit tags):
    // Selected items receive 'best-seller'. Items created within 30 days also get 'new'.
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    return selected.slice(0, 4).map((p) => {
      const dynamicTags: ProductTag[] = ["best-seller"];
      const isRecent = p.created_at
        ? new Date(p.created_at).getTime() >= thirtyDaysAgo
        : false;
      const hadNewTag = Array.isArray(p.tags) && p.tags.includes("new");

      if ((isRecent || hadNewTag) && !dynamicTags.includes("new")) {
        dynamicTags.push("new");
      }

      return {
        ...p,
        tags: dynamicTags,
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
        {loadingProducts ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-card rounded-2xl border p-3 sm:p-4 h-[350px] flex flex-col justify-between animate-pulse"
              >
                <div className="bg-muted aspect-square w-full rounded-xl" />
                <div className="space-y-2 mt-3 flex-1">
                  <div className="bg-muted h-4 w-3/4 rounded" />
                  <div className="bg-muted h-3 w-1/2 rounded" />
                  <div className="bg-muted h-3 w-1/3 rounded" />
                  <div className="bg-muted h-5 w-1/2 rounded mt-2" />
                </div>
                <div className="bg-muted h-9 w-full rounded-xl mt-3" />
              </div>
            ))}
          </div>
        ) : bestSellers.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {bestSellers.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-muted-foreground border rounded-2xl bg-muted/20">
            <p className="text-sm font-medium">Hiện chưa có sản phẩm nào</p>
          </div>
        )}
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
              {!loadingStores && storeList.length > 0
                ? `Hệ thống ${storeList.length} không gian thưởng thức trà trái cây tươi mát, hiện đại sẵn sàng phục vụ tại chỗ và mang đi.`
                : "Không gian thưởng thức trà trái cây tươi mát, hiện đại sẵn sàng phục vụ tại chỗ và mang đi."}
            </p>
          </div>
          <Button asChild variant="soft" size="sm">
            <Link to="/cua-hang">
              Tất cả chi nhánh {!loadingStores && storeList.length > 0 ? `(${storeList.length})` : ""} <ArrowRight className="size-4 ml-1" />
            </Link>
          </Button>
        </div>

        {/* Store Cards Grid */}
        {loadingStores ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-card flex flex-col justify-between overflow-hidden rounded-2xl border p-5 shadow-sm min-h-[310px] animate-pulse"
              >
                <div>
                  {/* Status & location badge skeleton */}
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="h-5 w-24 rounded-full bg-muted" />
                    <div className="h-5 w-20 rounded-full bg-muted" />
                  </div>

                  {/* Store Name skeleton */}
                  <div className="mt-3 h-6 w-3/4 rounded bg-muted" />

                  {/* Details skeleton */}
                  <div className="mt-3 space-y-2">
                    <div className="h-4 w-full rounded bg-muted" />
                    <div className="h-4 w-2/3 rounded bg-muted" />
                    <div className="h-4 w-1/2 rounded bg-muted" />
                  </div>

                  {/* Amenities pills skeleton */}
                  <div className="mt-4 flex flex-wrap gap-1.5 min-h-[26px]">
                    <div className="h-5 w-16 rounded-md bg-muted" />
                    <div className="h-5 w-20 rounded-md bg-muted" />
                    <div className="h-5 w-18 rounded-md bg-muted" />
                  </div>
                </div>

                {/* Action buttons skeleton */}
                <div className="mt-5 grid grid-cols-2 gap-2 border-t pt-4">
                  <div className="h-8 w-full rounded-md bg-muted" />
                  <div className="h-8 w-full rounded-md bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : storeList.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {storeList.slice(0, 3).map((s) => (
              <div
                key={s.id}
                className="bg-card group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg min-h-[310px]"
              >
                <div>
                  {/* Store status & district */}
                  <div className="mb-3 flex items-center justify-between gap-2">
                    {!s.is_active ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                        🔴 Tạm ngưng
                      </span>
                    ) : isStoreOpen(s.hours || "07:00 – 22:30") ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                        Đang mở cửa
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                        🔴 Đã đóng cửa
                      </span>
                    )}
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
                  <div className="mt-4 flex flex-wrap gap-1.5 min-h-[26px]">
                    {getStoreAmenities(s.amenities).slice(0, 5).map((amenity, idx) => (
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
                    variant={!s.is_active || !isStoreOpen(s.hours || "07:00 – 22:30") ? "secondary" : "default"}
                    className={`w-full gap-1.5 font-semibold text-xs shadow-sm ${
                      !s.is_active || !isStoreOpen(s.hours || "07:00 – 22:30")
                        ? "opacity-50 cursor-not-allowed bg-muted text-muted-foreground"
                        : ""
                    }`}
                    disabled={!s.is_active || !isStoreOpen(s.hours || "07:00 – 22:30")}
                    title={
                      !s.is_active
                        ? "Chi nhánh tạm ngưng"
                        : !isStoreOpen(s.hours || "07:00 – 22:30")
                        ? "Quán hiện đã đóng cửa"
                        : "Đặt tại đây"
                    }
                    onClick={() => handleOrderAtBranch(s)}
                  >
                    <ShoppingBag className="size-3.5" />
                    {!s.is_active
                      ? "Tạm đóng"
                      : !isStoreOpen(s.hours || "07:00 – 22:30")
                      ? "Quán hiện đã đóng cửa"
                      : "Đặt tại đây"}
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
        ) : (
          <div className="py-12 text-center text-muted-foreground border rounded-2xl bg-muted/20">
            <p className="text-sm font-medium">Hiện chưa có chi nhánh nào hoạt động</p>
          </div>
        )}

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
