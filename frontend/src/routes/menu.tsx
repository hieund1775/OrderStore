import { useCallback, useDeferredValue, useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, MapPin, Search, AlertCircle, RefreshCw, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/site/PageHeader";
import { ProductCard } from "@/components/menu/ProductCard";
import { CatalogSection } from "@/components/catalog/CatalogSection";
import { CategorySelector } from "@/components/catalog/CategorySelector";
import { useCart } from "@/lib/cart";
import { useBranch } from "@/lib/branch";
import {
  fetchPublicCatalogSections,
  fetchPublicProducts,
  type PublicCatalogSection,
  apiGet,
} from "@/lib/api";
import { mapApiProduct, vnd, type Product } from "@/lib/data";
import { usePublicCategoryTree } from "@/lib/catalog-navigation";
import menuBannerImg from "@/assets/menu.jpg";

export const Route = createFileRoute("/menu")({
  validateSearch: (search: Record<string, unknown>): {
    table_id?: string;
    store_id?: string;
    category?: string;
    page?: number;
  } => ({
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
    category: typeof search.category === "string" && search.category.trim() ? search.category.trim() : undefined,
    page:
      Number.isInteger(Number(search.page)) && Number(search.page) > 1
        ? Number(search.page)
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Danh mục sản phẩm & Thực đơn — Trà Trái Cây Tô" },
      {
        name: "description",
        content:
          "Khám phá danh mục đa ngành hàng: Trà trái cây, Trà sữa đậm vị, Đồ ăn vặt và Thời trang merchandise độc quyền.",
      },
      { property: "og:title", content: "Danh mục sản phẩm & Thực đơn — Trà Trái Cây Tô" },
      {
        property: "og:description",
        content: "Duyệt theo từng danh mục ngành hàng, tùy biến sản phẩm và đặt hàng ngay.",
      },
    ],
  }),
  component: MenuPage,
});

function MenuPage() {
  const { table_id, store_id, category, page } = useSearch({ from: "/menu" });
  const { selectedStore: storeInfo, status: branchStatus, selectStore, bindTable, clearTable } = useBranch();
  const { items, subtotal, count } = useCart();

  // State
  const [sections, setSections] = useState<PublicCatalogSection[]>([]);
  const [categoryProducts, setCategoryProducts] = useState<Product[]>([]);
  const [categoryProductsTotal, setCategoryProductsTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [notFoundError, setNotFoundError] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const catalogRequestId = useRef(0);

  // Table binding
  const [tableInfo, setTableInfo] = useState<{
    table: { id: number; name: string; store_id: number; store_name: string; store_address: string };
  } | null>(null);

  const effectiveStoreId = storeInfo?.id ?? null;
  const deferredSearchQuery = useDeferredValue(searchQuery.trim());
  const showProductList = Boolean(category || deferredSearchQuery);
  const currentPage = deferredSearchQuery ? 1 : page || 1;
  const pageSize = 24;
  const totalPages = Math.max(1, Math.ceil(categoryProductsTotal / pageSize));
  const categoryTreeQuery = usePublicCategoryTree();
  const categoryTree = categoryTreeQuery.data || [];

  // 2. Resolve table if present in URL
  useEffect(() => {
    if (!table_id && store_id && branchStatus === "ready") selectStore(store_id);
  }, [branchStatus, selectStore, store_id, table_id]);

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
        if (!cancelled) {
          if (bindTable(res.table.id, res.table.store_id)) setTableInfo(res);
          else setTableInfo(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTableInfo(null);
          clearTable();
        }
      });
    return () => { cancelled = true; };
  }, [table_id, bindTable, clearTable]);

  // 3. Fetch Catalog Data (Grouped Sections if no category, Subtree Products if category selected)
  const loadCatalogData = useCallback(async () => {
    const requestId = ++catalogRequestId.current;
    if (!effectiveStoreId) {
      setSections([]);
      setCategoryProducts([]);
      setCategoryProductsTotal(0);
      setLoading(branchStatus === "loading");
      setCatalogError(
        branchStatus === "error"
          ? "Không thể tải danh sách chi nhánh. Vui lòng thử lại."
          : branchStatus === "empty"
            ? "Hiện chưa có chi nhánh nào đang hoạt động."
            : null,
      );
      return;
    }

    setLoading(true);
    setNotFoundError(false);
    setCatalogError(null);

    try {
      if (!category && !deferredSearchQuery) {
        // Grouped sections view
        const res = await fetchPublicCatalogSections(effectiveStoreId, 12);
        if (requestId !== catalogRequestId.current) return;
        setSections(res.sections || []);
        setCategoryProducts([]);
        setCategoryProductsTotal(0);
      } else {
        // Subtree products view
        const res = await fetchPublicProducts({
          store_id: effectiveStoreId,
          category: category,
          search: deferredSearchQuery || undefined,
          limit: pageSize,
          offset: (currentPage - 1) * pageSize,
        });
        if (requestId !== catalogRequestId.current) return;
        setCategoryProducts((res.products || []).map(mapApiProduct));
        setCategoryProductsTotal(Number(res.total || 0));
        setSections([]);
      }
    } catch (err: unknown) {
      if (requestId !== catalogRequestId.current) return;
      const apiError = err as { status?: number; message?: string };
      if (category && (apiError.status === 404 || apiError.message?.includes("404") || apiError.message?.includes("Không tìm thấy"))) {
        setNotFoundError(true);
      } else {
        const rawMsg = apiError.message || '';
        const safeMsg = rawMsg && !rawMsg.includes('Route ') && !rawMsg.includes('not found') && !rawMsg.includes('HTML')
          ? rawMsg
          : 'Không thể tải danh mục sản phẩm lúc này. Vui lòng thử lại sau.';
        setCatalogError(safeMsg);
      }
      setSections([]);
      setCategoryProducts([]);
      setCategoryProductsTotal(0);
    } finally {
      if (requestId === catalogRequestId.current) setLoading(false);
    }
  }, [branchStatus, category, currentPage, deferredSearchQuery, effectiveStoreId]);

  useEffect(() => {
    void loadCatalogData();
  }, [loadCatalogData]);

  return (
    <div className="min-h-screen bg-background">
      {/* Table Banner */}
      {tableInfo && (
        <div className="bg-primary text-primary-foreground py-2.5 px-4">
          <div className="container-page flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
            <span className="flex items-center gap-1.5 font-semibold">
              <MapPin className="size-4" />
              Bạn đang quét QR tại <b>{tableInfo.table.name}</b> · {tableInfo.table.store_name}
            </span>
            <span className="text-[11px] opacity-90">Đơn hàng sẽ tự động gắn vào bàn này</span>
          </div>
        </div>
      )}

      {/* Hero Page Header */}
      <PageHeader
        eyebrow="Catalog đa ngành"
        title="Danh Mục Sản Phẩm & Thực Đơn"
        desc="Khám phá các sản phẩm tươi ngon & merchandise chất lượng cao từ hệ thống Trà Trái Cây Tô."
        bannerImg={menuBannerImg}
      />

      <div className="container-page py-8 space-y-6">
        {/* Branch & Category Filter Controls */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-6">
          <CategorySelector
            categoryTree={categoryTree}
            activeCategorySlug={category}
            searchParams={{ store_id, table_id }}
          />
          {categoryTreeQuery.isError && (
            <Button variant="outline" size="sm" onClick={() => void categoryTreeQuery.refetch()}>
              <RefreshCw className="mr-1.5 size-3.5" /> Tải lại danh mục
            </Button>
          )}

          {/* Search bar */}
          <div className="relative w-full md:w-64 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm sản phẩm…"
              className="pl-9 h-9 text-xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <main>
        {/* Content Area */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <RefreshCw className="size-8 text-primary animate-spin mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Đang tải danh mục sản phẩm…</p>
          </div>
        ) : catalogError ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed p-8 py-16 text-center">
            <AlertCircle className="mb-3 size-12 text-destructive" />
            <h3 className="font-display text-lg font-bold">Không thể tải danh mục</h3>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">{catalogError}</p>
            <Button className="mt-4" variant="outline" size="sm" onClick={() => void loadCatalogData()}>
              <RefreshCw className="mr-1.5 size-3.5" /> Thử lại
            </Button>
          </div>
        ) : notFoundError ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-2xl p-8">
            <AlertCircle className="size-12 text-destructive mb-3" />
            <h3 className="font-display text-lg font-bold text-foreground">Không tìm thấy danh mục</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              Danh mục "{category}" không tồn tại hoặc đã ngừng phục vụ. Vui lòng quay lại trang danh mục chính.
            </p>
            <Link to="/menu" search={{ store_id, table_id, category: undefined, page: undefined }} className="mt-4">
              <Button variant="hero" size="sm">
                Xem tất cả danh mục
              </Button>
            </Link>
          </div>
        ) : !showProductList ? (
          /* Default Grouped Sections View */
          sections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-2xl p-8">
              <ShoppingBag className="size-12 text-muted-foreground/40 mb-3" />
              <p className="text-base font-semibold text-foreground">Chưa có sản phẩm nào khả dụng</p>
              <p className="text-xs text-muted-foreground mt-1">
                Chi nhánh hiện tại chưa cập nhật bảng giá hoặc sản phẩm đang tạm ngừng bán.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {sections.map((section) => (
                <CatalogSection
                  key={section.root_id}
                  section={section}
                  searchParams={{ store_id, table_id }}
                />
              ))}
            </div>
          )
        ) : (
          /* Subtree Products Grid View */
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-bold tracking-tight">
                Danh sách sản phẩm ({categoryProductsTotal})
              </h2>
            </div>

            {categoryProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-2xl p-8">
                <ShoppingBag className="size-12 text-muted-foreground/40 mb-3" />
                <p className="text-base font-semibold text-foreground">Chưa có sản phẩm trong danh mục này</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Vui lòng chọn danh mục khác hoặc quay lại danh mục gốc.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {categoryProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
            {!deferredSearchQuery && categoryProductsTotal > pageSize && (
              <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Phân trang sản phẩm">
                {currentPage <= 1 ? (
                  <Button variant="outline" size="sm" disabled>
                    <ChevronLeft className="mr-1 size-4" /> Trang trước
                  </Button>
                ) : (
                  <Button asChild variant="outline" size="sm">
                    <Link
                      to="/menu"
                      search={{ store_id, table_id, category, page: currentPage > 2 ? currentPage - 1 : undefined }}
                    >
                      <ChevronLeft className="mr-1 size-4" /> Trang trước
                    </Link>
                  </Button>
                )}
                <span className="text-sm text-muted-foreground">
                  Trang {currentPage}/{totalPages}
                </span>
                {currentPage >= totalPages ? (
                  <Button variant="outline" size="sm" disabled>
                    Trang sau <ChevronRight className="ml-1 size-4" />
                  </Button>
                ) : (
                  <Button asChild variant="outline" size="sm">
                    <Link
                      to="/menu"
                      search={{ store_id, table_id, category, page: currentPage + 1 }}
                    >
                      Trang sau <ChevronRight className="ml-1 size-4" />
                    </Link>
                  </Button>
                )}
              </nav>
            )}
          </div>
        )}
          </main>

          {/* Cart overview */}
          <aside className="hidden lg:block">
            <div className="bg-card sticky top-32 rounded-2xl border p-5">
              <p className="font-display text-lg font-bold">Giỏ hàng của bạn</p>
              <p className="text-muted-foreground text-xs">{count} món đã chọn</p>
              <div className="mt-4 max-h-80 space-y-3 overflow-y-auto">
                {items.length === 0 && (
                  <p className="text-muted-foreground text-sm">Chọn sản phẩm để bắt đầu đơn hàng.</p>
                )}
                {items.map((item) => (
                  <div key={item.key} className="flex gap-3 border-b pb-3 last:border-0">
                    <img src={item.image} alt={item.name} loading="lazy" className="size-12 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{item.qty}× {item.name}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {item.size} · {item.sugar} đường · {item.ice} đá
                        {item.toppings?.length ? ` · ${item.toppings.join(", ")}` : ""}
                      </p>
                    </div>
                    <span className="text-sm font-bold">{vnd(item.unitPrice * item.qty)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between border-t pt-4">
                <span className="text-muted-foreground text-sm">Tạm tính</span>
                <span className="text-primary text-lg font-extrabold">{vnd(subtotal)}</span>
              </div>
              <Button asChild variant="hero" className="mt-4 w-full">
                <Link to="/thanh-toan">Thanh toán <ChevronRight className="size-4" /></Link>
              </Button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
export default MenuPage;
