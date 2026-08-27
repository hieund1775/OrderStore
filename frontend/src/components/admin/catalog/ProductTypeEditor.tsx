import React, { useState } from 'react';
import {
  Boxes,
  Plus,
  ArrowRight,
  ShieldCheck,
  PackageCheck,
  UtensilsCrossed,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { createProductType } from '@/lib/api';
import { toast } from 'sonner';

export type ProductType = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  default_stock_mode: 'tracked' | 'made_to_order';
  default_fulfillment_lane: 'kitchen' | 'packing';
  published_version: number | null;
  published_schema_id: number | null;
  products_count: number;
};

interface ProductTypeEditorProps {
  productTypes: ProductType[];
  selectedTypeId: number | null;
  onSelectType: (type: ProductType) => void;
  onRefresh: () => void;
  isSuperAdmin: boolean;
}

export function ProductTypeEditor({
  productTypes,
  selectedTypeId,
  onSelectType,
  onRefresh,
  isSuperAdmin,
}: ProductTypeEditorProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    default_stock_mode: 'made_to_order' as 'tracked' | 'made_to_order',
    default_fulfillment_lane: 'kitchen' as 'kitchen' | 'packing',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleOpenCreate = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      default_stock_mode: 'made_to_order',
      default_fulfillment_lane: 'kitchen',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error('Vui lòng nhập mã và tên loại sản phẩm');
      return;
    }

    setSubmitting(true);
    try {
      await createProductType({
        code: formData.code.trim().toLowerCase(),
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        default_stock_mode: formData.default_stock_mode,
        default_fulfillment_lane: formData.default_fulfillment_lane,
      });
      toast.success('Đã tạo loại sản phẩm & schema v1 bản nháp');
      setModalOpen(false);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi tạo loại sản phẩm');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Boxes className="text-primary size-5" />
          <h3 className="font-display text-lg font-bold">Ngành Hàng & Loại Sản Phẩm (Product Types)</h3>
        </div>
        {isSuperAdmin && (
          <Button onClick={handleOpenCreate} size="sm">
            <Plus className="size-4 mr-1.5" /> Thêm ngành hàng
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {productTypes.map((pt) => {
          const isSelected = pt.id === selectedTypeId;
          return (
            <div
              key={pt.id}
              onClick={() => onSelectType(pt)}
              className={`cursor-pointer rounded-2xl border p-4 transition-all hover:shadow-md ${
                isSelected
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'bg-card hover:border-primary/40'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-base">{pt.name}</h4>
                  <span className="font-mono text-xs text-muted-foreground">{pt.code}</span>
                </div>
                {pt.published_version ? (
                  <span className="bg-emerald-500/10 text-emerald-600 rounded-full px-2 py-0.5 text-xs font-semibold">
                    v{pt.published_version} (Published)
                  </span>
                ) : (
                  <span className="bg-amber-500/10 text-amber-600 rounded-full px-2 py-0.5 text-xs font-semibold">
                    Draft
                  </span>
                )}
              </div>

              {pt.description && (
                <p className="text-muted-foreground line-clamp-2 text-xs mt-2">{pt.description}</p>
              )}

              <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-medium ${
                      pt.default_fulfillment_lane === 'kitchen'
                        ? 'bg-orange-500/10 text-orange-600'
                        : 'bg-blue-500/10 text-blue-600'
                    }`}
                  >
                    {pt.default_fulfillment_lane === 'kitchen' ? (
                      <>
                        <UtensilsCrossed className="size-3" /> Bếp pha chế
                      </>
                    ) : (
                      <>
                        <PackageCheck className="size-3" /> Soạn đóng gói
                      </>
                    )}
                  </span>
                </div>

                <div className="text-primary flex items-center gap-1 font-semibold">
                  Cấu hình Schema <ArrowRight className="size-3" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Thêm Loại Sản Phẩm / Ngành Hàng</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Tên loại sản phẩm *</Label>
              <Input
                value={formData.name}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    name: val,
                    code: prev.code || val.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
                  }));
                }}
                placeholder="VD: Nước Uống Pha Chế, Thời Trang Nam, Bánh Ngọt..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Mã định danh (Code snake_case) *</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
                placeholder="VD: beverage, fashion_apparel, pastry"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Mô tả ngành hàng</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Mô tả tóm tắt đặc thù sản phẩm..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Chế độ tồn kho</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.default_stock_mode}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, default_stock_mode: e.target.value as any }))
                  }
                >
                  <option value="made_to_order">Pha chế theo order</option>
                  <option value="tracked">Kiểm đếm tồn kho SKU</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Line xử lý đơn</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.default_fulfillment_lane}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      default_fulfillment_lane: e.target.value as any,
                    }))
                  }
                >
                  <option value="kitchen">Màn hình Bếp (KDS)</option>
                  <option value="packing">Soạn kho / Đóng gói</option>
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setModalOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Đang tạo...' : 'Tạo ngành hàng'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
