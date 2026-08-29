import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { ChevronRight, MapPin, Search, AlertCircle, RefreshCw, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/site/PageHeader";
import { ProductCard } from "@/components/menu/ProductCard";
import { CatalogSection } from "@/components/catalog/CatalogSection";
import { CategorySelector } from "@/components/catalog/CategorySelector";
import { useCart } from "@/lib/cart";
import { useBranch } from "@/lib/branch";
import {
  fetchPublicCategoryTree,
  fetchPublicCatalogSections,
  fetchPublicProducts,
  type PublicCategoryNode,
  type PublicCatalogSection,
  apiGet,
} from "@/lib/api";
import { vnd } from "@/lib/data";
import menuBannerImg from "@/assets/menu.jpg";

export const Route = createFileRoute("/menu")({
  validateSearch: (search: Record<string, unknown>): {
    table_id?: string;
    store_id?: string;
    category?: string;
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
  const { table_id, store_id, category } = useSearch({ from: "/menu" });
  const { selectedStore: storeInfo, status: branchStatus, selectStore, bindTable, clearTable } = useBranch();
  const { items, subtotal, count } = useCart();

  // State
  const [categoryTree, setCategoryTree] = useState<PublicCategoryNode[]>([]);
  const [sections, setSections] = useState<PublicCatalogSection[]>([]);
  const [categoryProducts, setCategoryProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [notFoundError, setNotFoundError] = useState(false);

  // Table binding
  const [tableInfo, setTableInfo] = useState<{
    table: { id: number; name: string; store_id: number; store_name: string; store_address: string };
  } | null>(null);

  const effectiveStoreId = storeInfo?.id || (store_id ? Number(store_id) : 1);

  // 1. Fetch category tree
  useEffect(() => {
    let cancelled = false;
    fetchPublicCategoryTree()
      .then((tree) => {
        if (!cancelled && Array.isArray(tree)) setCategoryTree(tree);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

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
          setTableInfo(res);
          bindTable(res.table.id, res.table.name, res.table.store_id);
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
  const loadCatalogData = async () => {
    setLoading(true);
    setNotFoundError(false);

    try {
      if (!category) {
        // Grouped sections view
        const res = await fetchPublicCatalogSections(effectiveStoreId, 12);
        setSections(res.sections || []);
        setCategoryProducts([]);
      } else {
        // Subtree products view
        const res = await fetchPublicProducts({
          store_id: effectiveStoreId,
          category: category,
          search: searchQuery || undefined,
        });
        const productsList = (res as any).products || res || [];
        setCategoryProducts(productsList);
        setSections([]);
      }
    } catch (err: any) {
      if (err?.status === 404 || err?.message?.includes("404") || err?.message?.includes("Không tìm thấy")) {
        setNotFoundError(true);
      }
      setSections([]);
      setCategoryProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalogData();
  }, [category, effectiveStoreId, searchQuery]);

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
        title="Danh Mục Sản Phẩm & Thực Đơn"
        description="Khám phá các sản phẩm tươi ngon & merchandise chất lượng cao từ hệ thống Trà Trái Cây Tô."
        badge="Catalog Đa Ngành V2"
        image={menuBannerImg}
      />

      <div className="container-page py-8 space-y-6">
        {/* Branch & Category Filter Controls */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-6">
          <CategorySelector
            categoryTree={categoryTree}
            activeCategorySlug={category}
            searchParams={{ store_id, table_id }}
          />

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

        {/* Content Area */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <RefreshCw className="size-8 text-primary animate-spin mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Đang tải danh mục sản phẩm…</p>
          </div>
        ) : notFoundError ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-2xl p-8">
            <AlertCircle className="size-12 text-destructive mb-3" />
            <h3 className="font-display text-lg font-bold text-foreground">Không tìm thấy danh mục</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              Danh mục "{category}" không tồn tại hoặc đã ngừng phục vụ. Vui lòng quay lại trang danh mục chính.
            </p>
            <Link to="/menu" search={{ store_id, table_id, category: undefined }} className="mt-4">
              <Button variant="hero" size="sm">
                Xem tất cả danh mục
              </Button>
            </Link>
          </div>
        ) : !category ? (
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
                Danh sách sản phẩm ({categoryProducts.length})
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
          </div>
        )}
      </div>
    </div>
  );
}
export default MenuPage;
