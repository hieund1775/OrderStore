import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw,
  PackageCheck,
  Building2,
  FolderTree,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  fetchBranchOffers,
  fetchCatalogCategories,
  apiGet,
  getUser,
} from '@/lib/api';
import { BranchOfferTable, type BranchOfferRow } from '@/components/admin/catalog/BranchOfferTable';
import { toast } from 'sonner';

type CatalogCategory = {
  id: number;
  name: string;
  parent_id: number | null;
  depth: number;
};

export const Route = createFileRoute('/admin/hang-dang-ban')({
  component: AdminHangDangBanPage,
  head: () => ({
    meta: [
      { title: 'Hàng đang bán & Tồn kho SKU Chi Nhánh | Trà Trái Cây Tô Admin' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
});

function AdminHangDangBanPage() {
  const [offers, setOffers] = useState<BranchOfferRow[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('1');
  const [selectedRootId, setSelectedRootId] = useState<string>('all');
  const [selectedChildId, setSelectedChildId] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const currentUser = getUser();
  const isSuperAdmin = currentUser?.role === 'super';
  const userBranchId = currentUser?.branch_id ? String(currentUser.branch_id) : '1';

  const effectiveStoreId = isSuperAdmin ? selectedStoreId : userBranchId;
  const rootCategories = useMemo(
    () => categories.filter((category) => category.parent_id == null && Number(category.depth) === 0),
    [categories],
  );
  const childCategories = useMemo(
    () => selectedRootId === 'all'
      ? []
      : categories.filter((category) => Number(category.parent_id) === Number(selectedRootId)),
    [categories, selectedRootId],
  );

  const effectiveCategoryId = useMemo(() => {
    if (selectedChildId !== 'all') return Number(selectedChildId);
    if (selectedRootId !== 'all') return Number(selectedRootId);
    return undefined;
  }, [selectedChildId, selectedRootId]);

  const handleRootChange = (newRootId: string) => {
    setSelectedRootId(newRootId);
    setSelectedChildId('all');
    setPage(1);
  };

  const handleChildChange = (newChildId: string) => {
    setSelectedChildId(newChildId);
    setPage(1);
  };

  const handleStoreChange = (newStoreId: string) => {
    setSelectedStoreId(newStoreId);
    setPage(1);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (isSuperAdmin && stores.length === 0) {
        const storeList = await apiGet<any[]>('/admin/branches');
        setStores(storeList || []);
      }

      const [offersRes, categoryList] = await Promise.all([
        fetchBranchOffers({
          store_id: effectiveStoreId,
          category_id: effectiveCategoryId,
          search: debouncedSearch.trim() || undefined,
          page,
          limit: 5,
        }),
        fetchCatalogCategories(),
      ]);
      let list: BranchOfferRow[] = [];
      if (Array.isArray(offersRes)) {
        list = offersRes;
      } else if (offersRes && typeof offersRes === 'object') {
        list = Array.isArray(offersRes.items) ? offersRes.items : [];
        if (offersRes.pagination) {
          const tp = Math.max(1, offersRes.pagination.totalPages || 1);
          setTotalPages(tp);
          if (offersRes.pagination.totalPages > 0 && page > offersRes.pagination.totalPages) {
            setPage(offersRes.pagination.totalPages);
          }
        }
      }
      setOffers(list);
      setCategories(categoryList || []);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi nạp danh sách hàng đang bán');
    } finally {
      setLoading(false);
    }
  }, [effectiveStoreId, effectiveCategoryId, debouncedSearch, page, isSuperAdmin, stores.length]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-primary/10 text-primary rounded-lg p-2">
              <PackageCheck className="size-5" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight">
                Hàng Đang Bán & Tồn Kho SKU Chi Nhánh
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Quản lý bảng giá chi nhánh, bật/tắt bán SKU và theo dõi sổ cái xuất nhập tồn thành phẩm.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isSuperAdmin && stores.length > 0 && (
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-muted-foreground" />
              <select
                className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-semibold"
                value={selectedStoreId}
                onChange={(e) => handleStoreChange(e.target.value)}
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.district || s.city})
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`size-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3">
        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
          <FolderTree className="size-4 text-primary" />
          Lọc theo catalog
        </div>
        <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
          Ngành hàng gốc
          <select
            className="h-9 min-w-48 rounded-md border border-input bg-background px-3 text-xs font-semibold text-foreground"
            value={selectedRootId}
            onChange={(event) => handleRootChange(event.target.value)}
          >
            <option value="all">Tất cả ngành hàng</option>
            {rootCategories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
        {selectedRootId !== 'all' && (
          <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
            Danh mục con
            <select
              className="h-9 min-w-48 rounded-md border border-input bg-background px-3 text-xs font-semibold text-foreground"
              value={selectedChildId}
              onChange={(event) => handleChildChange(event.target.value)}
            >
              <option value="all">Tất cả trong ngành</option>
              {childCategories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">
          Đang tải dữ liệu hàng bán chi nhánh...
        </div>
      ) : (
        <>
          <BranchOfferTable
            offers={offers}
            storeId={effectiveStoreId}
            search={search}
            onSearchChange={setSearch}
            onRefresh={loadData}
          />
          {offers.length > 0 && (
            <div className="flex items-center justify-between border-t pt-4 text-sm text-muted-foreground">
              <span>Trang {page} / {Math.max(1, totalPages)}</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                >
                  Trang trước
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => (p < totalPages ? p + 1 : p))}
                  disabled={page >= totalPages || loading}
                >
                  Trang sau
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
