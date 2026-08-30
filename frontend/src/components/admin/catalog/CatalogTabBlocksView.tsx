import { useState, useMemo } from 'react';
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
  Sparkles,
  Edit2,
  Trash2,
  EyeOff,
  Bookmark,
  Layers,
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

interface CatalogTabBlocksViewProps {
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

export function CatalogTabBlocksView({
  rootCategories,
  selectedRootId,
  onSelectRootId,
  categories,
  products,
  activeSchema,
  isSuperAdmin,
  onRefresh,
  onOpenProductEditor,
}: CatalogTabBlocksViewProps) {
  // Tab hiện tại: 'subcategories' | 'products' | 'options'
  const [activeTab, setActiveTab] = useState<'subcategories' | 'products' | 'options'>('subcategories');

  // Lọc danh sách danh mục con trực thuộc Root đang chọn
  const subcategories = useMemo(() => {
    if (selectedRootId === 'all') {
      return categories.filter((c) => c.parent_id !== null);
    }
    const rootIdNum = Number(selectedRootId);
    return categories.filter((c) => Number(c.parent_id) === rootIdNum);
  }, [categories, selectedRootId]);

  // Tab 2: Lọc sản phẩm theo danh mục con
  const [productFilterSubcat, setProductFilterSubcat] = useState<string>('all');
  const [productSearch, setProductSearch] = useState('');

  // Tab 3: Danh mục con đang chọn để cấu hình tùy chọn
  const [optionSubcatId, setOptionSubcatId] = useState<number | null>(null);

  // Modal Thêm / Sửa Danh Mục Con
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryNode | null>(null);
  const [catName, setCatName] = useState('');
  const [catLane, setCatLane] = useState<'kitchen' | 'packing' | 'inherit'>('inherit');
  const [catSaving, setCatSaving] = useState(false);

  // Tên Ngành gốc đang chọn
  const activeRootName = useMemo(() => {
    if (selectedRootId === 'all') return 'Tất cả ngành hàng';
    const root = rootCategories.find((r) => String(r.id) === String(selectedRootId));
    return root ? root.name : 'Ngành hàng';
  }, [rootCategories, selectedRootId]);

  // Tự động chọn danh mục con đầu tiên cho Tab 3 nếu chưa chọn
  const currentOptionSubcat = useMemo(() => {
    if (subcategories.length === 0) return null;
    if (optionSubcatId) {
      const found = subcategories.find((c) => Number(c.id) === optionSubcatId);
      if (found) return found;
    }
    return subcategories[0];
  }, [subcategories, optionSubcatId]);

  // Tự động sinh slug URL ngầm (ẩn khỏi mắt người dùng)
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

  // Danh sách sản phẩm cho Tab 2 (áp dụng lọc theo subcategory và tìm kiếm)
  const displayedProducts = useMemo(() => {
    let list = products;
    if (productFilterSubcat !== 'all') {
      const targetSubcatId = Number(productFilterSubcat);
      list = list.filter((p) => Number(p.category_id) === targetSubcatId);
    } else if (selectedRootId !== 'all') {
      const subcatIds = new Set(subcategories.map((c) => Number(c.id)));
      list = list.filter((p) => subcatIds.has(Number(p.category_id)));
    }

    if (productSearch.trim()) {
      const query = productSearch.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          (p.base_tea && p.base_tea.toLowerCase().includes(query))
      );
    }
    return list;
  }, [products, productFilterSubcat, selectedRootId, subcategories, productSearch]);

  const handleOpenCreateCategory = () => {
    setEditingCategory(null);
    setCatName('');
    setCatLane('inherit');
    setCatDialogOpen(true);
  };

  const handleOpenEditCategory = (cat: CategoryNode) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatLane((cat.default_fulfillment_lane as any) || 'inherit');
    setCatDialogOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) {
      toast.error('Vui lòng nhập tên danh mục con');
      return;
    }

    const parentId = selectedRootId !== 'all' ? Number(selectedRootId) : (editingCategory?.parent_id || null);
    if (!parentId && !editingCategory) {
      toast.error('Vui lòng chọn một ngành gốc trước khi tạo danh mục con');
      return;
    }

    // Tự sinh slug ngầm từ tên
    const autoSlug = editingCategory ? editingCategory.slug : generateSlugFromName(catName);

    try {
      setCatSaving(true);
      const laneValue = catLane === 'inherit' ? null : catLane;

      if (editingCategory) {
        await updateCatalogCategory(editingCategory.id, {
          name: catName.trim(),
          slug: autoSlug,
          default_fulfillment_lane: laneValue,
          is_visible: editingCategory.is_visible,
        });
        toast.success(`Đã cập nhật danh mục "${catName}"`);
      } else {
        const created = await createCatalogCategory({
          name: catName.trim(),
          slug: autoSlug,
          parent_id: parentId,
          product_type_id: null,
          sort_order: subcategories.length + 1,
          default_fulfillment_lane: laneValue,
          is_visible: true,
        });
        toast.success(`Đã tạo danh mục con "${catName}"`);
        setOptionSubcatId(Number(created.id));
      }

      setCatDialogOpen(false);
      await onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi lưu danh mục');
    } finally {
      setCatSaving(false);
    }
  };

  const handleDeleteCategory = async (cat: CategoryNode) => {
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
      {/* 3 TABS HEADER BAR */}
      <div className="flex items-center gap-2 border-b pb-2">
        <button
          onClick={() => setActiveTab('subcategories')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'subcategories'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-card text-muted-foreground hover:text-foreground border'
          }`}
        >
          <FolderTree className="size-4" />
          <span>1. Danh Mục Con ({subcategories.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('products')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'products'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-card text-muted-foreground hover:text-foreground border'
          }`}
        >
          <ShoppingBag className="size-4" />
          <span>2. Quản Lý Sản Phẩm ({displayedProducts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('options')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'options'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-card text-muted-foreground hover:text-foreground border'
          }`}
        >
          <Sliders className="size-4" />
          <span>3. Tùy Chọn Danh Mục Con</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: DANH MỤC CON (BẢNG RỘNG RÃI) */}
      {/* ========================================================= */}
      {activeTab === 'subcategories' && (
        <div className="bg-card rounded-xl border p-5 space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Danh Sách Danh Mục Con Trực Thuộc "{activeRootName}"
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Quản lý các nhóm món (Trà sữa, Nước ép, Cà phê...) cùng khu vực chế biến/đóng gói mặc định.
              </p>
            </div>

            {isSuperAdmin && (
              <Button
                size="sm"
                variant="hero"
                className="text-xs"
                onClick={handleOpenCreateCategory}
                disabled={selectedRootId === 'all'}
                title={selectedRootId === 'all' ? 'Vui lòng chọn ngành gốc trước' : 'Thêm danh mục con'}
              >
                <Plus className="size-3.5 mr-1" />
                Thêm Danh Mục Con
              </Button>
            )}
          </div>

          <div className="overflow-hidden border rounded-xl bg-background">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b text-muted-foreground font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3.5">Tên Danh Mục Con</th>
                  <th className="p-3.5">Số Lượng Món</th>
                  <th className="p-3.5">Khu Vực Xử Lý Mặc Định</th>
                  <th className="p-3.5">Trạng Thái</th>
                  <th className="p-3.5 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {subcategories.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground text-xs">
                      Chưa có danh mục con nào trong ngành “{activeRootName}”.
                    </td>
                  </tr>
                ) : (
                  subcategories.map((cat) => {
                    const count = products.filter((p) => Number(p.category_id) === Number(cat.id)).length;
                    const lane = cat.default_fulfillment_lane;

                    return (
                      <tr key={cat.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3.5 font-bold text-foreground flex items-center gap-2">
                          <span className="p-1 rounded-md bg-primary/10 text-primary">
                            <FolderTree className="size-3.5" />
                          </span>
                          <span>{cat.name}</span>
                          {!cat.is_visible && <EyeOff className="size-3 text-muted-foreground" title="Đang ẩn" />}
                        </td>
                        <td className="p-3.5 font-semibold text-foreground">{count} món</td>
                        <td className="p-3.5">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-semibold px-2 py-0.5 ${
                              lane === 'kitchen'
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
                                : lane === 'packing'
                                ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {lane === 'kitchen' ? '🍳 Quầy Bếp / Pha chế' : lane === 'packing' ? '📦 Soạn / Đóng gói' : 'Theo ngành gốc'}
                          </Badge>
                        </td>
                        <td className="p-3.5">
                          <span className={cat.is_visible ? 'text-emerald-600 font-bold' : 'text-muted-foreground'}>
                            {cat.is_visible ? 'Đang hiển thị' : 'Tạm ẩn'}
                          </span>
                        </td>
                        <td className="p-3.5 text-right space-x-2">
                          {isSuperAdmin && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs px-2 text-foreground"
                                onClick={() => handleOpenEditCategory(cat)}
                              >
                                <Edit2 className="size-3 mr-1" /> Sửa
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs px-2 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteCategory(cat)}
                              >
                                <Trash2 className="size-3 mr-1" /> Xóa
                              </Button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: QUẢN LÝ SẢN PHẨM (CÓ BỘ LỌC THEO DANH MỤC CON) */}
      {/* ========================================================= */}
      {activeTab === 'products' && (
        <div className="bg-card rounded-xl border p-5 space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <h2 className="text-sm font-bold text-foreground">Danh Sách Sản Phẩm</h2>
                <p className="text-xs text-muted-foreground">Xem và chỉnh sửa các món theo từng danh mục con</p>
              </div>

              {/* LỌC THEO DANH MỤC CON */}
              <Select value={productFilterSubcat} onValueChange={setProductFilterSubcat}>
                <SelectTrigger className="h-8 text-xs w-[220px] bg-background">
                  <SelectValue placeholder="Lọc theo danh mục con" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Tất cả danh mục con ({products.length} món)</SelectItem>
                  {subcategories.map((subcat) => {
                    const count = products.filter((p) => Number(p.category_id) === Number(subcat.id)).length;
                    return (
                      <SelectItem key={subcat.id} value={String(subcat.id)} className="text-xs">
                        {subcat.name} ({count} món)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Tìm tên món..."
                  className="h-8 pl-8 text-xs w-48 bg-background"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
              </div>

              {isSuperAdmin && (
                <Button
                  size="sm"
                  variant="hero"
                  className="h-8 text-xs px-3"
                  onClick={() => onOpenProductEditor(undefined, productFilterSubcat !== 'all' ? Number(productFilterSubcat) : (subcategories[0]?.id ? Number(subcategories[0].id) : undefined))}
                  disabled={subcategories.length === 0}
                >
                  <Plus className="size-3.5 mr-1" />
                  Thêm Món Mới
                </Button>
              )}
            </div>
          </div>

          <div className="overflow-hidden border rounded-xl bg-background">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b text-muted-foreground font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3.5">Sản Phẩm</th>
                  <th className="p-3.5">Danh Mục Con</th>
                  <th className="p-3.5">Giá Bán</th>
                  <th className="p-3.5">Khu Vực Xử Lý</th>
                  <th className="p-3.5">Trạng Thái</th>
                  <th className="p-3.5 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {displayedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground text-xs">
                      Không tìm thấy sản phẩm nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  displayedProducts.map((prod) => {
                    const subcat = categories.find((c) => Number(c.id) === Number(prod.category_id));
                    const lane = prod.fulfillment_lane || subcat?.default_fulfillment_lane || 'kitchen';

                    return (
                      <tr key={prod.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3.5 font-bold text-foreground flex items-center gap-2.5">
                          <div className="size-9 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden border">
                            {prod.image_url ? (
                              <img src={prod.image_url} alt={prod.name} className="size-full object-cover" />
                            ) : (
                              <ShoppingBag className="size-4 text-muted-foreground/50" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-foreground">{prod.name}</p>
                            {prod.base_tea && <p className="text-[10px] text-muted-foreground">Trà nền: {prod.base_tea}</p>}
                          </div>
                        </td>
                        <td className="p-3.5 font-semibold text-foreground">{subcat ? subcat.name : 'Chưa gán'}</td>
                        <td className="p-3.5 font-bold text-primary">
                          {new Intl.NumberFormat('vi-VN').format(prod.price)}đ
                        </td>
                        <td className="p-3.5">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-semibold px-2 py-0.5 ${
                              lane === 'kitchen'
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
                                : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20'
                            }`}
                          >
                            {lane === 'kitchen' ? '🍳 Bếp' : '📦 Đóng gói'}
                          </Badge>
                        </td>
                        <td className="p-3.5">
                          <span className={prod.is_available ? 'text-emerald-600 font-bold' : 'text-destructive font-bold'}>
                            {prod.is_available ? 'Đang bán' : 'Tạm ngưng'}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          {isSuperAdmin && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs px-2 bg-background hover:bg-accent"
                              onClick={() => onOpenProductEditor(prod, Number(prod.category_id))}
                            >
                              <Edit2 className="size-3 mr-1" /> Sửa
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: TÙY CHỌN DANH MỤC CON (CẤU HÌNH ĐỘC LẬP) */}
      {/* ========================================================= */}
      {activeTab === 'options' && (
        <div className="bg-card rounded-xl border p-5 space-y-5 shadow-xs">
          {/* HEADER & SELECTOR SUB-CATEGORY */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 text-primary rounded-xl">
                <Sliders className="size-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">
                  Cấu Hình Tùy Chọn Theo Danh Mục Con
                </h2>
                <p className="text-xs text-muted-foreground">
                  Tùy chọn được bật chỉ áp dụng cho đúng danh mục con này, không dính sang danh mục con khác.
                </p>
              </div>
            </div>

            {/* Subcategory selector pills */}
            <div className="flex flex-wrap items-center gap-1.5 bg-muted/60 p-1.5 rounded-xl border">
              <span className="text-xs font-bold text-muted-foreground pl-1.5 pr-1">Chọn danh mục con:</span>
              {subcategories.map((subcat) => {
                const isSelected = currentOptionSubcat?.id === subcat.id;
                return (
                  <button
                    key={subcat.id}
                    onClick={() => setOptionSubcatId(Number(subcat.id))}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {subcat.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Option content for active subcategory */}
          {!currentOptionSubcat ? (
            <div className="p-12 text-center text-muted-foreground space-y-2">
              <FolderTree className="size-10 mx-auto opacity-30" />
              <p className="text-xs">Vui lòng tạo hoặc chọn một danh mục con để cấu hình tùy chọn.</p>
            </div>
          ) : !activeSchema ? (
            <div className="p-8 text-center text-muted-foreground space-y-2">
              <AlertCircle className="size-8 mx-auto text-amber-500/60" />
              <p className="text-xs">Chưa có Schema tùy chọn nào được định nghĩa cho ngành này.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-primary/5 border border-primary/10 rounded-xl text-xs text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="size-4 text-primary shrink-0" />
                <span>
                  Đang thiết lập tùy chọn cho: <b className="text-foreground">{currentOptionSubcat.name}</b>. Khách đặt các món thuộc danh mục này sẽ nhìn thấy các tùy chọn đang bật bên dưới.
                </span>
              </div>

              <OptionScopeEditor
                categoryId={Number(currentOptionSubcat.id)}
                categoryName={currentOptionSubcat.name}
                schema={activeSchema}
              />
            </div>
          )}
        </div>
      )}

      {/* MODAL TẠO / SỬA DANH MỤC CON (ẨN HOÀN TOÀN TRƯỜNG SLUG) */}
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
                  placeholder="Ví dụ: Trà sữa, Nước ép, Cà phê, Quần jean..."
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Khu vực xử lý đơn mặc định</Label>
                <Select value={catLane} onValueChange={(v: any) => setCatLane(v)}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Chọn khu vực xử lý" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inherit" className="text-xs">Theo ngành hàng gốc</SelectItem>
                    <SelectItem value="kitchen" className="text-xs">🍳 Quầy Bếp / Pha chế (Kitchen)</SelectItem>
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
