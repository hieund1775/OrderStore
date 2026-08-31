import React, { useState } from 'react';
import {
  FolderTree,
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
  ChevronDown,
  Layers,
  CheckCircle2,
  XCircle,
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
  createCatalogCategory,
  updateCatalogCategory,
  archiveCatalogCategory,
} from '@/lib/api';
import { toast } from 'sonner';

export type CategoryNode = {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  depth: number;
  product_type_id: number | null;
  product_type_name?: string | null;
  product_type_code?: string | null;
  default_fulfillment_lane?: 'kitchen' | 'packing';
  sort_order: number;
  is_visible: boolean;
  archived_at: string | null;
  children_count?: number;
  products_count?: number;
};

interface CategoryTreeEditorProps {
  categories: CategoryNode[];
  productTypes: { id: number; name: string; code: string }[];
  onRefresh: () => void;
  isSuperAdmin: boolean;
}

export function CategoryTreeEditor({
  categories,
  productTypes,
  onRefresh,
  isSuperAdmin,
}: CategoryTreeEditorProps) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryNode | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    parent_id: '' as string | number,
    product_type_id: '' as string | number,
    sort_order: 0,
    is_visible: true,
  });
  const [submitting, setSubmitting] = useState(false);

  const toggleExpand = (id: number) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenCreate = (parentId: number | null = null) => {
    setEditingCategory(null);
    setFormData({
      name: '',
      slug: '',
      parent_id: parentId ?? '',
      product_type_id: '',
      sort_order: 0,
      is_visible: true,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (cat: CategoryNode) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      slug: cat.slug,
      parent_id: cat.parent_id ?? '',
      product_type_id: cat.product_type_id ?? '',
      sort_order: cat.sort_order,
      is_visible: cat.is_visible,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.slug.trim()) {
      toast.error('Vui lòng nhập tên và slug danh mục');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        slug: formData.slug.trim().toLowerCase(),
        parent_id: formData.parent_id ? Number(formData.parent_id) : null,
        product_type_id: formData.product_type_id ? Number(formData.product_type_id) : null,
        sort_order: Number(formData.sort_order) || 0,
        is_visible: formData.is_visible,
      };

      if (editingCategory) {
        await updateCatalogCategory(editingCategory.id, payload);
        toast.success('Đã cập nhật danh mục');
      } else {
        await createCatalogCategory(payload);
        toast.success('Đã tạo danh mục mới');
      }
      setModalOpen(false);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi lưu danh mục');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (cat: CategoryNode) => {
    if (!confirm(`Bạn có chắc muốn lưu trữ danh mục "${cat.name}"?`)) return;
    try {
      await archiveCatalogCategory(cat.id);
      toast.success('Đã lưu trữ danh mục');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi lưu trữ danh mục');
    }
  };

  // Build hierarchical category tree (up to 3 levels)
  const rootCategories = categories.filter((c) => !c.parent_id);
  const getChildren = (parentId: number) => categories.filter((c) => c.parent_id === parentId);

  const renderCategoryItem = (cat: CategoryNode) => {
    const children = getChildren(cat.id);
    const hasChildren = children.length > 0;
    const isExpanded = expanded[cat.id] ?? true;

    return (
      <div key={cat.id} className="space-y-1">
        <div
          className={`flex items-center justify-between gap-2 rounded-xl border p-3 transition-colors ${
            cat.depth === 0
              ? 'bg-card font-semibold'
              : cat.depth === 1
              ? 'bg-muted/40 ml-6 text-sm'
              : 'bg-muted/20 ml-12 text-sm'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {hasChildren ? (
              <button
                onClick={() => toggleExpand(cat.id)}
                className="hover:bg-muted rounded p-1"
                aria-label="Thu/mở danh mục con"
              >
                {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              </button>
            ) : (
              <div className="size-6 shrink-0" />
            )}

            <Layers className="text-primary size-4 shrink-0" />

            <span className="truncate">{cat.name}</span>
            <span className="text-muted-foreground text-xs font-mono">/{cat.slug}</span>

            {cat.product_type_name && (
              <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs">
                {cat.product_type_name}
              </span>
            )}

            {(cat.products_count || 0) > 0 && (
              <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs">
                {cat.products_count} SP
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isSuperAdmin && cat.depth < 2 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenCreate(cat.id)}
                title="Thêm danh mục con"
                className="h-8 px-2"
              >
                <Plus className="size-3.5 mr-1" /> Con
              </Button>
            )}

            {isSuperAdmin && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenEdit(cat)}
                  className="h-8 w-8 p-0"
                  title="Chỉnh sửa"
                >
                  <Edit2 className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleArchive(cat)}
                  className="hover:bg-destructive/10 text-destructive h-8 w-8 p-0"
                  title="Lưu trữ"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="space-y-1">
            {children.map(renderCategoryItem)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderTree className="text-primary size-5" />
          <h3 className="font-display text-lg font-bold">Cây Danh Mục Đa Cấp (Tối đa 3 cấp)</h3>
        </div>
        {isSuperAdmin && (
          <Button onClick={() => handleOpenCreate(null)} size="sm">
            <Plus className="size-4 mr-1.5" /> Thêm danh mục gốc
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {rootCategories.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Chưa có danh mục nào.</p>
        ) : (
          rootCategories.map(renderCategoryItem)
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Chỉnh sửa danh mục' : 'Thêm danh mục mới'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Tên danh mục *</Label>
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
                placeholder="VD: Áo thun nam, Trà trái cây..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Slug (Đường dẫn URL) *</Label>
              <Input
                value={formData.slug}
                onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                placeholder="VD: ao-thun-nam"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Danh mục cha</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.parent_id}
                onChange={(e) => setFormData((prev) => ({ ...prev, parent_id: e.target.value }))}
              >
                <option value="">(Không có - Danh mục gốc)</option>
                {categories
                  .filter((c) => (!editingCategory || c.id !== editingCategory.id) && c.depth < 2)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.depth === 1 ? `└─ ${c.name}` : c.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Loại sản phẩm (Product Type)</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.product_type_id}
                onChange={(e) => setFormData((prev) => ({ ...prev, product_type_id: e.target.value }))}
              >
                <option value="">(Chưa chọn loại sản phẩm)</option>
                {productTypes.map((pt) => (
                  <option key={pt.id} value={pt.id}>
                    {pt.name} ({pt.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_visible"
                checked={formData.is_visible}
                onChange={(e) => setFormData((prev) => ({ ...prev, is_visible: e.target.checked }))}
                className="rounded border-gray-300"
              />
              <Label htmlFor="is_visible">Hiển thị công khai trên website</Label>
            </div>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setModalOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Đang lưu...' : editingCategory ? 'Lưu thay đổi' : 'Tạo mới'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
