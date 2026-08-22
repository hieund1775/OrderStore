import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { ChevronRight, MapPin, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/site/PageHeader";
import { ProductCard } from "@/components/menu/ProductCard";
import { useCart } from "@/lib/cart";
import { mapApiProduct, products, vnd, type ApiCatalogProduct } from "@/lib/data";
import { apiGet } from "@/lib/api";

export const Route = createFileRoute("/menu")({
  validateSearch: (search: Record<string, unknown>): { table_id?: string; store_id?: string } => ({
    table_id:
      typeof search.table_id === "string"
        ? search.table_id
        : typeof search.table_id === "number"
          ? String(search.table_id)
          : undefined,
    store_id:
      typeof search.store_id === "string"
        ? search.store_id
        : typeof search.store_id === "number"
          ? String(search.store_id)
          : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Thực đơn trà trái cây — Trà Trái Cây Tô" },
      {
        name: "description",
        content:
          "Menu trà trái cây tươi, trà đậm vị, trà tuyết và Hi-Tea detox. Lọc theo danh mục, cốt trà nền và đặt hàng ngay.",
      },
      { property: "og:title", content: "Thực đơn trà trái cây — Trà Trái Cây Tô" },
      {
        property: "og:description",
        content: "Lọc theo danh mục và cốt trà nền, tùy chỉnh từng ly.",
      },
    ],
  }),
  component: MenuPage,
});

function MenuPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("Tất cả");
  const [selectedBase, setSelectedBase] = useState<string>("Tất cả");
  const [catalogProducts, setCatalogProducts] = useState(products);
  const [dbCategories, setDbCategories] = useState<{ id: number; name: string }[]>([]);
  const [dbBases, setDbBases] = useState<{ id: number; name: string }[]>([]);
  const { items, subtotal, count } = useCart();
  const { table_id, store_id } = useSearch({ from: "/menu" });
  const [tableInfo, setTableInfo] = useState<{
    table: { id: number; name: string; store_id: number; store_name: string; store_address: string };
  } | null>(null);
  const [storeInfo, setStoreInfo] = useState<{ id: number; name: string; address?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    // 1. Fetch Products
    apiGet<ApiCatalogProduct[]>("/api/products")
      .then((rows) => {
        if (!cancelled && rows.length > 0) setCatalogProducts(rows.map(mapApiProduct));
      })
      .catch(() => {});

    // 2. Fetch Categories directly from Database API
    apiGet<{ id: number; name: string }[]>("/api/categories")
      .then((rows) => {
        if (!cancelled && Array.isArray(rows)) setDbCategories(rows);
      })
      .catch(() => {});

    // 3. Fetch Base Options directly from Database API
    apiGet<{ id: number; name: string }[]>("/api/options/bases")
      .then((rows) => {
        if (!cancelled && Array.isArray(rows)) setDbBases(rows);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (table_id) {
      // Giữ table_id qua các trang (link "Thanh toán" không mang search params)
      sessionStorage.setItem("teaplus_table_id", table_id);
    }
  }, [table_id]);

  useEffect(() => {
    if (store_id) {
      sessionStorage.setItem("teaplus_store_id", store_id);
    }
  }, [store_id]);

  useEffect(() => {
    if (!table_id) {
      setTableInfo(null);
      return;
    }
    let cancelled = false;
    apiGet<{ table: { id: number; name: string; store_id: number; store_name: string; store_address: string } }>(
      `/api/table/resolve?table_id=${encodeURIComponent(table_id)}`,
    )
      .then((res) => {
        if (!cancelled) setTableInfo(res);
      })
      .catch(() => {
        if (!cancelled) setTableInfo(null);
      });
    return () => {
      cancelled = true;
    };
  }, [table_id]);

  useEffect(() => {
    if (!store_id) {
      setStoreInfo(null);
      return;
    }
    let cancelled = false;
    apiGet<{ id: number; name: string; address?: string }[]>("/api/stores")
      .then((rows) => {
        if (cancelled) return;
        const found = rows.find((s) => String(s.id) === String(store_id));
        if (found) setStoreInfo(found);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [store_id]);

  const categoryList = useMemo(() => {
    if (dbCategories.length > 0) {
      return ["Tất cả", ...dbCategories.map((c) => c.name)];
    }
    const derived = Array.from(new Set(catalogProducts.map((p) => p.line).filter(Boolean)));
    return ["Tất cả", ...derived];
  }, [dbCategories, catalogProducts]);

  const baseList = useMemo(() => {
    if (dbBases.length > 0) {
      return ["Tất cả", ...dbBases.map((b) => b.name)];
    }
    const derived = Array.from(new Set(catalogProducts.map((p) => p.base).filter(Boolean)));
    return ["Tất cả", ...derived];
  }, [dbBases, catalogProducts]);

  const filtered = useMemo(
    () =>
      catalogProducts.filter(
        (p) =>
          (selectedCategory === "Tất cả" || p.line === selectedCategory) &&
          (selectedBase === "Tất cả" || p.base === selectedBase),
      ),
    [catalogProducts, selectedCategory, selectedBase],
  );

  return (
    <>
      <PageHeader
        eyebrow="Menu"
        title="Thực đơn trà trái cây tươi"
        desc="Chọn danh mục và cốt trà nền yêu thích, tùy chỉnh mức đường – đá – topping theo đúng khẩu vị của bạn."
      />

      {tableInfo && (
        <div className="container-page mt-6">
          <div className="gradient-warm text-primary-foreground flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/20 px-5 py-4 shadow-glow">
            <div className="flex items-center gap-3">
              <span className="bg-white/20 flex size-11 shrink-0 items-center justify-center rounded-xl">
                <MapPin className="size-6" />
              </span>
              <div>
                <p className="font-display text-base font-bold">
                  Bạn đang ngồi tại: {tableInfo.table.name}
                </p>
                <p className="text-sm opacity-90">
                  {tableInfo.table.store_name} · {tableInfo.table.store_address}
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-white/95">
              Đặt món tại bàn
            </Badge>
          </div>
        </div>
      )}

      {storeInfo && !tableInfo && (
        <div className="container-page mt-6">
          <div className="gradient-warm text-primary-foreground flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/20 px-5 py-4 shadow-glow">
            <div className="flex items-center gap-3">
              <span className="bg-white/20 flex size-11 shrink-0 items-center justify-center rounded-xl">
                <MapPin className="size-6" />
              </span>
              <div>
                <p className="font-display text-base font-bold">
                  Quý khách đang quét Mã QR Chi nhánh: {storeInfo.name}
                </p>
                <p className="text-sm opacity-90">
                  {storeInfo.address || "Chi nhánh chính thức Trà Trái Cây Tô"}
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-white/95">
              Mang đi / Tại quầy
            </Badge>
          </div>
        </div>
      )}

      <div className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_320px]">
        <div>
          {/* Filters */}
          <div className="bg-card top-32 z-20 mb-6 space-y-3 rounded-2xl border p-4 shadow-sm">
            <div className="text-muted-foreground flex items-center gap-2 text-xs font-bold tracking-wide uppercase">
              <SlidersHorizontal className="size-3.5" /> Danh mục
            </div>
            <div className="flex flex-wrap gap-2">
              {categoryList.map((c) => (
                <FilterChip
                  key={c}
                  active={selectedCategory === c}
                  onClick={() => setSelectedCategory(c)}
                  label={c}
                />
              ))}
            </div>
            <div className="text-muted-foreground flex items-center gap-2 pt-1 text-xs font-bold tracking-wide uppercase">
              Cốt trà nền
            </div>
            <div className="flex flex-wrap gap-2">
              {baseList.map((b) => (
                <FilterChip
                  key={b}
                  active={selectedBase === b}
                  onClick={() => setSelectedBase(b)}
                  label={b}
                />
              ))}
            </div>
          </div>

          <p className="text-muted-foreground mb-4 text-sm">{filtered.length} món phù hợp</p>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          {filtered.length === 0 && (
            <p className="text-muted-foreground py-16 text-center text-sm">
              Chưa có món nào khớp bộ lọc. Thử chọn danh mục hoặc cốt trà khác nhé.
            </p>
          )}
        </div>

        {/* Cart overview */}
        <aside className="hidden lg:block">
          <div className="bg-card sticky top-32 rounded-2xl border p-5">
            <p className="font-display text-lg font-bold">Giỏ hàng của bạn</p>
            <p className="text-muted-foreground text-xs">{count} món đã chọn</p>
            <div className="mt-4 max-h-80 space-y-3 overflow-y-auto">
              {items.length === 0 && (
                <p className="text-muted-foreground text-sm">Chọn món để bắt đầu đơn hàng.</p>
              )}
              {items.map((i) => (
                <div key={i.key} className="flex gap-3 border-b pb-3 last:border-0">
                  <img
                    src={i.image}
                    alt={i.name}
                    loading="lazy"
                    className="size-12 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {i.qty}× {i.name}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {i.size} · {i.sugar} đường · {i.ice} đá
                      {i.toppings.length ? ` · ${i.toppings.join(", ")}` : ""}
                    </p>
                  </div>
                  <span className="text-sm font-bold">{vnd(i.unitPrice * i.qty)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t pt-4">
              <span className="text-muted-foreground text-sm">Tạm tính</span>
              <span className="text-primary text-lg font-extrabold">{vnd(subtotal)}</span>
            </div>
            <Button asChild variant="hero" className="mt-4 w-full">
              <Link to="/thanh-toan">
                Thanh toán <ChevronRight className="size-4" />
              </Link>
            </Button>
          </div>
        </aside>
      </div>
    </>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick}>
      <Badge
        variant={active ? "default" : "secondary"}
        className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium ${active ? "" : "hover:bg-accent"}`}
      >
        {label}
      </Badge>
    </button>
  );
}
