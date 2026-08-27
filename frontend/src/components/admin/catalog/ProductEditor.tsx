import React, { useState } from 'react';
import {
  ShoppingBag,
  Plus,
  Edit2,
  Trash2,
  Image as ImageIcon,
  Barcode,
  Sparkles,
  Layers,
  CheckCircle2,
  Search,
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  createCatalogProduct,
  updateCatalogProduct,
  archiveCatalogProduct,
  fetchCatalogProductDetails,
  fetchSchemaDetails,
} from '@/lib/api';
import { VariantGenerator } from './VariantGenerator';
import { toast } from 'sonner';

export type ProductV2 = {
  id: number;
  category_id: number;
  category_name?: string;
  product_type_schema_id: number | null;
  product_type_name?: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  image_url: string | null;
  status: 'draft' | 'active' | 'archived';
  fulfillment_lane: 'kitchen' | 'packing';
  stock_mode: 'tracked' | 'made_to_order';
  variants_count: number;
  media: { id: number; image_url: string; alt_text?: string }[];
};

interface ProductEditorProps {
  products: ProductV2[];
  categories: any[];
  onRefresh: () => void;
  isSuperAdmin: boolean;
}

export function ProductEditor({
  products,
  categories,
  onRefresh,
  isSuperAdmin,
}: ProductEditorProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductV2 | null>(null);

  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [detailedProduct, setDetailedProduct] = useState<any | null>(null);
  const [activeSchema, setActiveSchema] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    category_id: '' as string | number,
    price: 0,
    description: '',
    image_url: '',
    fulfillment_lane: 'kitchen' as 'kitchen' | 'packing',
    stock_mode: 'made_to_order' as 'tracked' | 'made_to_order',
  });
  const [submitting, setSubmitting] = useState(false);

  const filtered = products.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.slug.toLowerCase().includes(search.toLowerCase());
    const matchCat =
      selectedCategory === 'all' || String(p.category_id) === selectedCategory;
    return matchSearch && matchCat;
  });

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      slug: '',
      category_id: categories.find((c) => c.depth >= 0)?.id || '',
      price: 35000,
      description: '',
      image_url: '',
      fulfillment_lane: 'kitchen',
      stock_mode: 'made_to_order',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (p: ProductV2) => {
    setEditingProduct(p);
    setFormData({
      name: p.name,
      slug: p.slug,
      category_id: p.category_id,
      price: p.price,
      description: p.description || '',
      image_url: p.image_url || '',
      fulfillment_lane: p.fulfillment_lane,
      stock_mode: p.stock_mode,
    });
    setModalOpen(true);
  };

  const handleOpenDetail = async (p: ProductV2) => {
    setLoadingDetail(true);
    setDetailSheetOpen(true);
    try {
      const details = await fetchCatalogProductDetails(p.id);
      setDetailedProduct(details);
      if (details.product_type_schema_id) {
        const schema = await fetchSchemaDetails(details.product_type_schema_id);
        setActiveSchema(schema);
      } else {
        setActiveSchema(null);
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi tải chi tiết sản phẩm');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.slug.trim() || !formData.category_id) {
      toast.error('Vui lòng điền đủ tên, slug và chọn danh mục');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        slug: formData.slug.trim().toLowerCase(),
        category_id: Number(formData.category_id),
        price: Number(formData.price) || 0,
        description: formData.description.trim() || null,
        image_url: formData.image_url.trim() || null,
        fulfillment_lane: formData.fulfillment_lane,
        stock_mode: formData.stock_mode,
      };

      if (editingProduct) {
        await updateCatalogProduct(editingProduct.id, payload);
        toast.success('Đã cập nhật sản phẩm');
      } else {
        await createCatalogProduct(payload);
        toast.success('Đã tạo sản phẩm mới & sinh SKU mặc định');
      }
      setModalOpen(false);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi lưu sản phẩm');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (p: ProductV2) => {
    if (!confirm(`Bạn có chắc muốn lưu trữ sản phẩm "${p.name}"?`)) return;
    try {
      await archiveCatalogProduct(p.id);
      toast.success('Đã lưu trữ sản phẩm');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi lưu trữ');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShoppingBag className="text-primary size-5" />
          <h3 className="font-display text-lg font-bold">Danh Sách Sản Phẩm Đa Ngành Hàng</h3>
        </div>

        {isSuperAdmin && (
          <Button onClick={handleOpenCreate} size="sm">
            <Plus className="size-4 mr-1.5" /> Tạo sản phẩm mới
          </Button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="text-muted-foreground absolute left-3 top-2.5 size-4" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên hoặc slug sản phẩm..."
            className="pl-9"
          />
        </div>

        <select
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="all">Tất cả danh mục</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.depth > 0 ? `└─ ${c.name}` : c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Products Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <div
            key={p.id}
            className="group rounded-2xl border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="size-16 shrink-0 overflow-hidden rounded-xl border bg-muted">
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt={p.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <ImageIcon className="size-6" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h4
                  onClick={() => handleOpenDetail(p)}
                  className="cursor-pointer font-bold text-sm hover:text-primary truncate"
                >
                  {p.name}
                </h4>
                <p className="text-muted-foreground text-xs font-mono truncate">/{p.slug}</p>
                <p className="text-primary font-bold text-sm mt-1">
                  {p.price.toLocaleString('vi-VN')}₫
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between border-t pt-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="bg-muted text-muted-foreground rounded px-2 py-0.5 text-[11px]">
                  {p.category_name || 'Danh mục'}
                </span>
                <span className="bg-primary/10 text-primary font-semibold rounded px-2 py-0.5 text-[11px]">
                  {p.variants_count || 1} SKU
                </span>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenDetail(p)}
                  className="h-7 px-2 text-xs"
                >
                  Chi tiết SKU
                </Button>
                {isSuperAdmin && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(p)}
                      className="h-7 w-7 p-0"
                    >
                      <Edit2 className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleArchive(p)}
                      className="hover:bg-destructive/10 text-destructive h-7 w-7 p-0"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Thêm / Sửa Product */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Chỉnh sửa sản phẩm' : 'Tạo sản phẩm mới'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Tên sản phẩm *</Label>
              <Input
                value={formData.name}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    name: val,
                    slug: prev.slug || val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
                  }));
                }}
                placeholder="VD: Trà Đào Cam Sả, Áo Thun Polo Nam..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Slug URL *</Label>
              <Input
                value={formData.slug}
                onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                placeholder="VD: tra-dao-cam-sa"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Danh mục *</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.category_id}
                  onChange={(e) => setFormData((prev) => ({ ...prev, category_id: e.target.value }))}
                  required
                >
                  <option value="">(Chọn danh mục)</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.depth > 0 ? `└─ ${c.name}` : c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Giá bán cơ sở (VNĐ)</Label>
                <Input
                  type="number"
                  min="0"
                  step="1000"
                  value={formData.price}
                  onChange={(e) => setFormData((prev) => ({ ...prev, price: Number(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Link ảnh đại diện (Image URL)</Label>
              <Input
                value={formData.image_url}
                onChange={(e) => setFormData((prev) => ({ ...prev, image_url: e.target.value }))}
                placeholder="https://... /images/product.jpg"
              />
            </div>

            <div className="space-y-2">
              <Label>Mô tả sản phẩm</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Mô tả thành phần, xuất xứ, chất liệu..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Line xử lý</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.fulfillment_lane}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      fulfillment_lane: e.target.value as any,
                    }))
                  }
                >
                  <option value="kitchen">Bếp pha chế</option>
                  <option value="packing">Soạn hàng đóng gói</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Kiểu quản lý tồn</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.stock_mode}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      stock_mode: e.target.value as any,
                    }))
                  }
                >
                  <option value="made_to_order">Pha chế theo order</option>
                  <option value="tracked">Theo dõi tồn kho SKU</option>
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setModalOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Đang lưu...' : editingProduct ? 'Lưu thay đổi' : 'Tạo mới'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Drawer Chi Tiết Sản Phẩm & Quản Lý SKU */}
      <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Quản Lý Biến Thể SKU & Thuộc Tính</SheetTitle>
          </SheetHeader>

          {loadingDetail || !detailedProduct ? (
            <div className="py-12 text-center text-muted-foreground">Đang tải chi tiết...</div>
          ) : (
            <div className="space-y-6 py-4">
              <div className="flex items-start gap-3 rounded-2xl border bg-muted/20 p-4">
                <div className="size-14 shrink-0 overflow-hidden rounded-xl border bg-muted">
                  {detailedProduct.image_url ? (
                    <img
                      src={detailedProduct.image_url}
                      alt={detailedProduct.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <ImageIcon className="size-5" />
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-bold text-base">{detailedProduct.name}</h4>
                  <p className="text-muted-foreground font-mono text-xs">/{detailedProduct.slug}</p>
                  <p className="text-primary font-bold text-sm mt-1">
                    {detailedProduct.price.toLocaleString('vi-VN')}₫
                  </p>
                </div>
              </div>

              {/* Variant Generator nếu có schema */}
              {activeSchema && (
                <VariantGenerator
                  productId={detailedProduct.id}
                  productSlug={detailedProduct.slug}
                  schemaAttributes={activeSchema.attributes || []}
                  existingVariants={detailedProduct.variants || []}
                  onSuccess={() => handleOpenDetail(detailedProduct)}
                  isSuperAdmin={isSuperAdmin}
                />
              )}

              {/* Danh sách biến thể SKU hiện tại */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Barcode className="size-4 text-primary" />
                  <h4 className="font-bold text-sm">
                    Danh Sách SKU Biến Thể Hiện Có ({detailedProduct.variants?.length || 0})
                  </h4>
                </div>

                <div className="space-y-2">
                  {(!detailedProduct.variants || detailedProduct.variants.length === 0) ? (
                    <p className="text-muted-foreground text-xs italic">Chưa có SKU biến thể.</p>
                  ) : (
                    detailedProduct.variants.map((v: any) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between rounded-xl border bg-card p-3 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-primary">{v.sku}</span>
                            {v.name_suffix && (
                              <span className="font-medium text-foreground">{v.name_suffix}</span>
                            )}
                          </div>
                          <p className="text-muted-foreground font-mono text-[10px] mt-0.5">
                            Signature: {v.variant_signature}
                          </p>
                        </div>

                        <span className="bg-emerald-500/10 text-emerald-600 rounded px-2 py-0.5 text-[11px] font-semibold">
                          Hoạt động
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
