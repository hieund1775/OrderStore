import { useState, useMemo, useEffect } from 'react';
import {
  FolderTree,
  ShoppingBag,
  Sliders,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  ChefHat,
  Package,
  Layers,
  Sparkles,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  createCatalogCategory,
  updateCatalogCategory,
  archiveCatalogCategory,
} from '@/lib/api';
import type { CategoryNode } from './CategoryTreeEditor';
import type { ProductV2 } from './ProductEditor';
import type { SchemaDetails } from './SchemaAttributeEditor';
import { OptionScopeEditor } from './OptionScopeEditor';

interface Catalog3BlockViewProps {
  rootCategories: CategoryNode[];
  selectedRootId: string;
  onSelectRootId: (rootId: string) => void;
  categories: CategoryNode[];
  products: ProductV2[];
  activeSchema: SchemaDetails | null;
  isSuperAdmin: boolean;
  onRefresh: () => Promise<void>;
  onOpenProductEditor: (product?: ProductV2, defaultCategoryId?: number) => void;
}

export function Catalog3BlockView({
  rootCategories,
  selectedRootId,
  onSelectRootId,
  categories,
  products,
  activeSchema,
  isSuperAdmin,
  onRefresh,
  onOpenProductEditor,
}: Catalog3BlockViewProps) {
  // Lấy danh sách danh mục con trực thuộc Root đang chọn
  const subcategories = useMemo(() => {
    if (selectedRootId === 'all') {
      // Khi chọn Tất cả, hiển thị tất cả danh mục có parent_id != null (depth >= 1)
      return categories.filter((c) => c.parent_id !== null);
    }
    const rootIdNum = Number(selectedRootId);
    return categories.filter((c) => Number(c.parent_id) === rootIdNum);
  }, [categories, selectedRootId]);

  // Danh mục con đang được chọn để xem sản phẩm và tùy chọn
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState('');

  // Modal tạo/sửa danh mục con
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryNode | null>(null);
  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [catLane, setCatLane] = useState<'kitchen' | 'packing' | 'inherit'>('inherit');
  const [catSaving, setCatSaving] = useState(false);

  // Tự động chọn danh mục con đầu tiên khi chuyển Ngành gốc hoặc nạp dữ liệu
  useEffect(() => {
    if (subcategories.length > 0) {
      const exists = subcategories.some((c) => Number(c.id) === selectedSubcategoryId);
      if (!exists) {
        setSelectedSubcategoryId(Number(subcategories[0].id));
      }
    } else {
      setSelectedSubcategoryId(null);
    }
  }, [subcategories, selectedSubcategoryId]);

  // Thông tin danh mục con đang chọn
  const activeSubcategory = useMemo(() => {
    if (!selectedSubcategoryId) return null;
    return categories.find((c) => Number(c.id) === selectedSubcategoryId) || null;
  }, [categories, selectedSubcategoryId]);

  // Danh sách sản phẩm thuộc danh mục con đang chọn
  const subcategoryProducts = useMemo(() => {
    if (!selectedSubcategoryId) return [];
    return products.filter((p) => Number(p.category_id) === selectedSubcategoryId);
  }, [products, selectedSubcategoryId]);

  // Lọc sản phẩm theo ô tìm kiếm
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return subcategoryProducts;
    const query = productSearch.toLowerCase().trim();
    return subcategoryProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.slug.toLowerCase().includes(query) ||
        (p.base_tea && p.base_tea.toLowerCase().includes(query))
    );
  }, [subcategoryProducts, productSearch]);

  // Tên Ngành gốc đang chọn
  const activeRootName = useMemo(() => {
    if (selectedRootId === 'all') return 'Tất cả ngành hàng';
    const root = rootCategories.find((r) => String(r.id) === String(selectedRootId));
    return root ? root.name : 'Ngành hàng';
  }, [rootCategories, selectedRootId]);

  const generateSlugFromName = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
  };

  const handleOpenCreateCategory = () => {
    setEditingCategory(null);
    setCatName('');
    setCatSlug('');
    setCatLane('inherit');
    setCatDialogOpen(true);
  };

  const handleOpenEditCategory = (cat: CategoryNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatSlug(cat.slug);
    setCatLane((cat.default_fulfillment_lane as any) || 'inherit');
    setCatDialogOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim() || !catSlug.trim()) {
      toast.error('Vui lòng nhập tên và mã slug');
      return;
    }

    const parentId = selectedRootId !== 'all' ? Number(selectedRootId) : (editingCategory?.parent_id || null);
    if (!parentId && !editingCategory) {
      toast.error('Vui lòng chọn một ngành gốc trước khi tạo danh mục con');
      return;
    }

    try {
      setCatSaving(true);
      const laneValue = catLane === 'inherit' ? null : catLane;

      if (editingCategory) {
        await updateCatalogCategory(editingCategory.id, {
          name: catName.trim(),
          slug: catSlug.trim().toLowerCase(),
          default_fulfillment_lane: laneValue,
          is_visible: editingCategory.is_visible,
        });
        toast.success(`Đã cập nhật danh mục "${catName}"`);
      } else {
        const created = await createCatalogCategory({
          name: catName.trim(),
          slug: catSlug.trim().toLowerCase(),
          parent_id: parentId,
          product_type_id: null,
          sort_order: subcategories.length + 1,
          default_fulfillment_lane: laneValue,
          is_visible: true,
        });
        toast.success(`Đã tạo danh mục con "${catName}"`);
        setSelectedSubcategoryId(Number(created.id));
      }

      setCatDialogOpen(false);
      await onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi lưu danh mục');
    } finally {
      setCatSaving(false);
    }
  };

  const handleDeleteCategory = async (cat: CategoryNode, e: React.MouseEvent) => {
    e.stopPropagation();
    const hasProducts = products.some((p) => Number(p.category_id) === Number(cat.id));
    if (hasProducts) {
      toast.error(`Danh mục "${cat.name}" đang có sản phẩm. Vui lòng chuyển hoặc xóa sản phẩm trước.`);
      return;
    }

    if (!confirm(`Bạn có chắc chắn muốn xóa danh mục con "${cat.name}"?`)) return;

    try {
      await archiveCatalogCategory(cat.id);
      toast.success(`Đã xóa danh mục "${cat.name}"`);
      await onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi xóa danh mục');
    }
  };

  return (
    <div className="space-y-4">
      {/* 3-BLOCK GRID LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* ========================================================= */}
        {/* BLOCK 1: DANH MỤC CON (3 COLS) */}
        {/* ========================================================= */}
        <section className="lg:col-span-3 bg-card rounded-xl border shadow-xs flex flex-col min-h-[580px] max-h-[750px] overflow-hidden">
          {/* Header Block 1 */}
          <div className="p-3.5 border-b bg-muted/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="bg-primary/10 text-primary rounded-lg p-1.5">
                <FolderTree className="size-4" />
              </span>
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">1. Danh Mục Con</h2>
                <p className="text-[11px] text-muted-foreground">{subcategories.length} danh mục</p>
              </div>
            </div>

            {isSuperAdmin && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs px-2.5 bg-background shadow-xs hover:bg-accent"
                onClick={handleOpenCreateCategory}
                disabled={selectedRootId === 'all'}
                title={selectedRootId === 'all' ? 'Vui lòng chọn ngành gốc để thêm danh mục con' : 'Thêm danh mục con'}
              >
                <Plus className="size-3.5 mr-1 text-primary" />
                Thêm
              </Button>
            )}
          </div>

          {/* Banner hướng dẫn nhanh */}
          <div className="p-2.5 bg-primary/5 border-b border-primary/10 text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary shrink-0" />
            <span>Chọn danh mục con để xem sản phẩm và tùy chọn riêng.</span>
          </div>

          {/* Subcategory List */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
            {subcategories.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground space-y-3">
                <FolderTree className="size-8 mx-auto opacity-30" />
                <p className="text-xs">Chưa có danh mục con nào trong ngành “{activeRootName}”.</p>
                {isSuperAdmin && selectedRootId !== 'all' && (
                  <Button size="sm" variant="outline" className="text-xs" onClick={handleOpenCreateCategory}>
                    <Plus className="size-3.5 mr-1" /> Tạo danh mục đầu tiên
                  </Button>
                )}
              </div>
            ) : (
              subcategories.map((cat) => {
                const isSelected = selectedSubcategoryId === Number(cat.id);
                const count = products.filter((p) => Number(p.category_id) === Number(cat.id)).length;
                const lane = cat.default_fulfillment_lane;

                return (
                  <div
                    key={cat.id}
                    onClick={() => setSelectedSubcategoryId(Number(cat.id))}
                    className={`group p-3 rounded-lg border text-left cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-primary/10 border-primary shadow-xs font-semibold'
                        : 'bg-card border-border hover:border-muted-foreground/40 hover:bg-muted/30'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold truncate text-foreground">{cat.name}</span>
                        {!cat.is_visible && (
                          <span title="Đang ẩn"><EyeOff className="size-3 text-muted-foreground" /></span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                        <span>{count} sản phẩm</span>
                        {lane && (
                          <span className="flex items-center gap-0.5 text-foreground/80 font-medium">
                            {lane === 'kitchen' ? <ChefHat className="size-3 text-amber-600" /> : <Package className="size-3 text-blue-600" />}
                            {lane === 'kitchen' ? 'Bếp' : 'Đóng gói'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isSuperAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
                          onClick={(e) => handleOpenEditCategory(cat, e)}
                          title="Chỉnh sửa danh mục"
                        >
                          <Edit2 className="size-3 text-muted-foreground" />
                        </Button>
                      )}
                      <div className={`size-2 rounded-full ${isSelected ? 'bg-primary' : 'bg-transparent'}`} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ========================================================= */}
        {/* BLOCK 2: QUẢN LÝ SẢN PHẨM THEO DANH MỤC CON (5 COLS) */}
        {/* ========================================================= */}
        <section className="lg:col-span-5 bg-card rounded-xl border shadow-xs flex flex-col min-h-[580px] max-h-[750px] overflow-hidden">
          {/* Header Block 2 */}
          <div className="p-3.5 border-b bg-muted/40 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <div className="flex items-center gap-2">
                <span className="bg-primary/10 text-primary rounded-lg p-1.5">
                  <ShoppingBag className="size-4" />
                </span>
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground truncate">
                  2. Sản Phẩm: {activeSubcategory ? activeSubcategory.name : 'Chưa chọn'}
                </h2>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                {activeSubcategory ? `${activeRootName} > ${activeSubcategory.name}` : 'Chọn danh mục con ở Block 1'}
              </p>
            </div>

            {isSuperAdmin && activeSubcategory && (
              <Button
                size="sm"
                variant="hero"
                className="h-7 text-xs px-3 shadow-xs shrink-0"
                onClick={() => onOpenProductEditor(undefined, Number(activeSubcategory.id))}
              >
                <Plus className="size-3.5 mr-1" />
                Thêm món
              </Button>
            )}
          </div>

          {/* Search bar */}
          <div className="p-2.5 border-b bg-muted/20">
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Tìm món trong danh mục này..."
                className="h-8 pl-8 text-xs bg-background"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Product list */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {!activeSubcategory ? (
              <div className="p-12 text-center text-muted-foreground space-y-2">
                <FolderTree className="size-10 mx-auto opacity-30" />
                <p className="text-xs font-medium">Vui lòng chọn một danh mục con ở Block 1 để xem sản phẩm.</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground space-y-3">
                <ShoppingBag className="size-10 mx-auto opacity-30" />
                <p className="text-xs">Chưa có sản phẩm nào trong danh mục “{activeSubcategory.name}”.</p>
                {isSuperAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => onOpenProductEditor(undefined, Number(activeSubcategory.id))}
                  >
                    <Plus className="size-3.5 mr-1" /> Thêm món đầu tiên
                  </Button>
                )}
              </div>
            ) : (
              filteredProducts.map((prod) => {
                const lane = prod.fulfillment_lane || activeSubcategory.default_fulfillment_lane || 'kitchen';

                return (
                  <div
                    key={prod.id}
                    className="p-3 rounded-lg border bg-card hover:border-primary/40 hover:shadow-xs transition-all flex items-start justify-between gap-3"
                  >
                    {/* Thumbnail placeholder */}
                    <div className="size-12 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden border">
                      {prod.image_url ? (
                        <img src={prod.image_url} alt={prod.name} className="size-full object-cover" />
                      ) : (
                        <ShoppingBag className="size-5 text-muted-foreground/50" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-xs font-bold text-foreground truncate">{prod.name}</h3>
                        {!prod.is_available && (
                          <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">Tạm ngưng</Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-bold text-primary">
                          {new Intl.NumberFormat('vi-VN').format(prod.price)}đ
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1.5 py-0 h-4 font-semibold ${
                            lane === 'kitchen'
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
                              : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20'
                          }`}
                        >
                          {lane === 'kitchen' ? '🍳 Bếp' : '📦 Đóng gói'}
                        </Badge>
                      </div>

                      {prod.base_tea && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">Trà nền: {prod.base_tea}</p>
                      )}
                    </div>

                    {isSuperAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2 shrink-0 bg-background hover:bg-accent"
                        onClick={() => onOpenProductEditor(prod, Number(activeSubcategory.id))}
                      >
                        <Edit2 className="size-3 mr-1" /> Sửa
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ========================================================= */}
        {/* BLOCK 3: TÙY CHỌN DANH MỤC CON (4 COLS) */}
        {/* ========================================================= */}
        <section className="lg:col-span-4 bg-card rounded-xl border shadow-xs flex flex-col min-h-[580px] max-h-[750px] overflow-hidden">
          {/* Header Block 3 */}
          <div className="p-3.5 border-b bg-muted/40 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="bg-primary/10 text-primary rounded-lg p-1.5">
                <Sliders className="size-4" />
              </span>
              <div className="min-w-0">
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground truncate">
                  3. Tùy Chọn: {activeSubcategory ? activeSubcategory.name : 'Chưa chọn'}
                </h2>
                <p className="text-[11px] text-muted-foreground truncate">
                  Cấu hình áp dụng riêng cho danh mục này
                </p>
              </div>
            </div>

            <Badge variant="secondary" className="text-[10px] font-bold uppercase shrink-0">
              Độc lập
            </Badge>
          </div>

          {/* Banner giải thích quy tắc cô lập */}
          <div className="p-2.5 bg-emerald-500/10 border-b border-emerald-500/20 text-[11px] text-emerald-900 dark:text-emerald-200 flex items-start gap-1.5">
            <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Tùy chọn được bật ở đây <b>chỉ áp dụng cho các món trong danh mục này</b>, không dính sang danh mục con khác.
            </span>
          </div>

          {/* Option Scope Editor Panel */}
          <div className="flex-1 overflow-y-auto p-3">
            {!activeSubcategory ? (
              <div className="p-12 text-center text-muted-foreground space-y-2">
                <Sliders className="size-10 mx-auto opacity-30" />
                <p className="text-xs font-medium">Vui lòng chọn danh mục con ở Block 1 để cấu hình tùy chọn.</p>
              </div>
            ) : !activeSchema ? (
              <div className="p-6 text-center text-muted-foreground space-y-2">
                <AlertCircle className="size-8 mx-auto text-amber-500/60" />
                <p className="text-xs">Chưa có Schema tùy chọn nào được định nghĩa cho ngành này.</p>
              </div>
            ) : (
              <OptionScopeEditor
                categoryId={Number(activeSubcategory.id)}
                categoryName={activeSubcategory.name}
                schema={activeSchema}
              />
            )}
          </div>
        </section>

      </div>

      {/* MODAL TẠO / SỬA DANH MỤC CON */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSaveCategory}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <FolderTree className="size-5 text-primary" />
                <span>{editingCategory ? 'Chỉnh Sửa Danh Mục Con' : 'Thêm Danh Mục Con Mới'}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="p-2.5 rounded-lg bg-muted text-xs text-muted-foreground">
                Ngành hàng trực thuộc: <b className="text-foreground">{activeRootName}</b>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subcat-name" className="text-xs font-semibold">
                  Tên danh mục con <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="subcat-name"
                  placeholder="Ví dụ: Trà sữa, Nước ép, Cà phê..."
                  value={catName}
                  onChange={(e) => {
                    setCatName(e.target.value);
                    if (!editingCategory && (!catSlug || catSlug === generateSlugFromName(catName))) {
                      setCatSlug(generateSlugFromName(e.target.value));
                    }
                  }}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subcat-slug" className="text-xs font-semibold">
                  Mã Slug (URL) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="subcat-slug"
                  placeholder="tra-sua, nuoc-ep..."
                  value={catSlug}
                  onChange={(e) => setCatSlug(e.target.value.toLowerCase())}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Khu vực xử lý đơn mặc định (Fulfillment)</Label>
                <Select value={catLane} onValueChange={(v: any) => setCatLane(v)}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Chọn khu vực xử lý" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inherit" className="text-xs">Kế thừa từ Ngành gốc (Mặc định)</SelectItem>
                    <SelectItem value="kitchen" className="text-xs">🍳 Quầy Pha chế / Bếp (Kitchen)</SelectItem>
                    <SelectItem value="packing" className="text-xs">📦 Soạn hàng / Đóng gói (Packing)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  Các món trong danh mục này sẽ tự động chuyển về khu vực tương ứng khi khách đặt đơn.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCatDialogOpen(false)} disabled={catSaving}>
                Hủy
              </Button>
              <Button type="submit" variant="hero" disabled={catSaving}>
                {catSaving ? 'Đang lưu...' : editingCategory ? 'Cập nhật' : 'Tạo danh mục'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
