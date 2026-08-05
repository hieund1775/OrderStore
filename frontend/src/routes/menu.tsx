import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { ChevronRight, MapPin, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/site/PageHeader";
import { ProductCard } from "@/components/menu/ProductCard";
import { useCart } from "@/lib/cart";
import { fruitGroups, products, teaLines, vnd } from "@/lib/data";
import { apiGet } from "@/lib/api";

export const Route = createFileRoute("/menu")({
  validateSearch: (search: Record<string, unknown>): { table_id?: string } => ({
    table_id: typeof search.table_id === "string" ? search.table_id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Thực đơn trà trái cây — Trà Trái Cây Tô" },
      {
        name: "description",
        content:
          "Menu trà trái cây tươi, trà đậm vị, trà tuyết và Hi-Tea detox. Lọc theo dòng trà, vị trái cây và đặt hàng ngay.",
      },
      { property: "og:title", content: "Thực đơn trà trái cây — Trà Trái Cây Tô" },
      {
        property: "og:description",
        content: "Lọc theo dòng trà và vị trái cây, tùy chỉnh từng ly.",
      },
    ],
  }),
  component: MenuPage,
});

function MenuPage() {
  const [line, setLine] = useState<string>("Tất cả");
  const [fruit, setFruit] = useState<string>("Tất cả");
  const { items, subtotal, count } = useCart();
  const { table_id } = useSearch({ from: "/menu" });
  const [tableInfo, setTableInfo] = useState<{
    table: { id: number; name: string; store_id: number; store_name: string; store_address: string };
  } | null>(null);

  useEffect(() => {
    if (table_id) {
      // Giữ table_id qua các trang (link "Thanh toán" không mang search params)
      sessionStorage.setItem("teaplus_table_id", table_id);
    }
  }, [table_id]);

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

  const filtered = useMemo(
    () =>
      products.filter(
        (p) => (line === "Tất cả" || p.line === line) && (fruit === "Tất cả" || p.fruit === fruit),
      ),
    [line, fruit],
  );

  return (
    <>
      <PageHeader
        eyebrow="Menu"
        title="Thực đơn trà trái cây tươi"
        desc="Chọn dòng trà yêu thích, tùy chỉnh mức đường – đá – topping theo đúng khẩu vị của bạn."
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

      <div className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_320px]">
        <div>
          {/* Filters */}
          <div className="bg-card sticky top-32 z-20 mb-6 space-y-3 rounded-2xl border p-4">
            <div className="text-muted-foreground flex items-center gap-2 text-xs font-bold tracking-wide uppercase">
              <SlidersHorizontal className="size-3.5" /> Dòng trà
            </div>
            <div className="flex flex-wrap gap-2">
              {["Tất cả", ...teaLines].map((l) => (
                <FilterChip key={l} active={line === l} onClick={() => setLine(l)} label={l} />
              ))}
            </div>
            <div className="text-muted-foreground flex items-center gap-2 pt-1 text-xs font-bold tracking-wide uppercase">
              Vị trái cây
            </div>
            <div className="flex flex-wrap gap-2">
              {["Tất cả", ...fruitGroups].map((f) => (
                <FilterChip key={f} active={fruit === f} onClick={() => setFruit(f)} label={f} />
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
              Chưa có món nào khớp bộ lọc. Thử bỏ bớt một tiêu chí nhé.
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
