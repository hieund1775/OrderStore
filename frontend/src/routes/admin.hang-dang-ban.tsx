import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { AdminPagination } from '@/components/admin/AdminUI';
import { toast } from 'sonner';

type CatalogCategory = {
  id: number;
  name: string;
  parent_id: number | null;
  depth: number;
};

export const Route = createFileRoute('/admin/hang-dang-ban')({
  validateSearch: (search: Record<string, unknown>) => ({
    page: Number(search.page) > 0 ? Number(search.page) : 1,
    store_id: typeof search.store_id === 'string' ? search.store_id : undefined,
    root_id: typeof search.root_id === 'string' ? search.root_id : undefined,
    child_id: typeof search.child_id === 'string' ? search.child_id : undefined,
    search: typeof search.search === 'string' ? search.search : undefined,
  }),
  component: AdminHangDangBanPage,
  head: () => ({
    meta: [
      { title: 'Hàng Bán Chi Nhánh | Trà Trái Cây Tô Admin' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
});

export function AdminHangDangBanPage() {
  const navigate = useNavigate();
  const searchParams = Route.useSearch();

  const page = searchParams.page || 1;
  const selectedStoreId = searchParams.store_id || '1';
  const selectedRootId = searchParams.root_id || 'all';
  const selectedChildId = searchParams.child_id || 'all';

  const [offers, setOffers] = useState<BranchOfferRow[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [search, setSearch] = useState<string>(searchParams.search || '');
  const [debouncedSearch, setDebouncedSearch] = useState<string>(searchParams.search || '');
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOffers, setTotalOffers] = useState(0);

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

  const setPage = (newPageOrFn: number | ((prev: number) => number)) => {
    const nextVal = typeof newPageOrFn === 'function' ? newPageOrFn(page) : newPageOrFn;
    navigate({
      search: (prev: any) => ({
        ...prev,
        page: nextVal > 1 ? nextVal : undefined,
      }),
      replace: true,
    });
  };

  const handleRootChange = (newRootId: string) => {
    navigate({
      search: (prev: any) => ({
        ...prev,
        root_id: newRootId !== 'all' ? newRootId : undefined,
        child_id: undefined,
        page: undefined,
      }),
      replace: true,
    });
  };

  const handleChildChange = (newChildId: string) => {
    navigate({
      search: (prev: any) => ({
        ...prev,
        child_id: newChildId !== 'all' ? newChildId : undefined,
        page: undefined,
      }),
      replace: true,
    });
  };

  const handleStoreChange = (newStoreId: string) => {
    navigate({
      search: (prev: any) => ({
        ...prev,
        store_id: newStoreId !== '1' ? newStoreId : undefined,
        page: undefined,
      }),
      replace: true,
    });
  };

  const isSearchFirstMount = useRef(true);
  useEffect(() => {
    if (isSearchFirstMount.current) {
      isSearchFirstMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      navigate({
        search: (prev: any) => ({
          ...prev,
          search: search.trim() || undefined,
          page: undefined,
        }),
        replace: true,
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, navigate]);

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
          limit: 20,
        }),
        fetchCatalogCategories(),
      ]);
      let list: BranchOfferRow[] = [];
      if (Array.isArray(offersRes)) {
        list = offersRes;
        setTotalPages(1);
        setTotalOffers(offersRes.length);
      } else if (offersRes && typeof offersRes === 'object') {
        list = Array.isArray(offersRes.items) ? offersRes.items : [];
        if (offersRes.pagination) {
          const tp = Math.max(1, offersRes.pagination.totalPages || 1);
          setTotalPages(tp);
          setTotalOffers(Number(offersRes.pagination.totalItems) || 0);
          if (offersRes.pagination.totalPages > 0 && page > offersRes.pagination.totalPages) {
            setPage(offersRes.pagination.totalPages);
          }
        } else {
          setTotalPages(1);
          setTotalOffers(list.length);
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
                Hàng Bán Chi Nhánh
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Quản lý bảng giá chi nhánh và trạng thái bật/tắt bán SKU.
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

      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground whitespace-nowrap">
          <FolderTree className="size-4 text-primary" />
          Lọc theo catalog:
        </div>
        <select
          aria-label="Lọc theo danh mục"
          className="h-9 min-w-48 rounded-md border border-input bg-background px-3 text-xs font-semibold text-foreground"
          value={selectedRootId}
          onChange={(event) => handleRootChange(event.target.value)}
        >
          <option value="all">Tất cả danh mục</option>
          {rootCategories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
        {selectedRootId !== 'all' && (
          <select
            aria-label="Lọc theo danh mục con"
            className="h-9 min-w-48 rounded-md border border-input bg-background px-3 text-xs font-semibold text-foreground"
            value={selectedChildId}
            onChange={(event) => handleChildChange(event.target.value)}
          >
            <option value="all">Tất cả danh mục con</option>
            {childCategories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
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
            <AdminPagination
              page={page}
              totalPages={totalPages}
              totalItems={totalOffers}
              itemLabel="SKU"
              onPageChange={setPage}
              loading={loading}
            />
          )}
        </>
      )}
    </div>
  );
}
