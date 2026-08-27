import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import {
  Store,
  RefreshCw,
  Sliders,
  CheckCircle2,
  PackageCheck,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  fetchBranchOffers,
  apiGet,
  getUser,
} from '@/lib/api';
import { BranchOfferTable, type BranchOfferRow } from '@/components/admin/catalog/BranchOfferTable';
import { toast } from 'sonner';

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
  const [selectedStoreId, setSelectedStoreId] = useState<string>('1');
  const [loading, setLoading] = useState(true);

  const currentUser = getUser();
  const isSuperAdmin = currentUser?.role === 'super';
  const userBranchId = currentUser?.branch_id ? String(currentUser.branch_id) : '1';

  const effectiveStoreId = isSuperAdmin ? selectedStoreId : userBranchId;

  const loadData = async () => {
    setLoading(true);
    try {
      if (isSuperAdmin && stores.length === 0) {
        const storeList = await apiGet<any[]>('/stores');
        setStores(storeList || []);
      }

      const offerList = await fetchBranchOffers({ store_id: effectiveStoreId });
      setOffers(offerList || []);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi nạp danh sách hàng đang bán');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [effectiveStoreId]);

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
                onChange={(e) => setSelectedStoreId(e.target.value)}
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

      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">
          Đang tải dữ liệu hàng bán chi nhánh...
        </div>
      ) : (
        <BranchOfferTable
          offers={offers}
          storeId={effectiveStoreId}
          onRefresh={loadData}
        />
      )}
    </div>
  );
}
