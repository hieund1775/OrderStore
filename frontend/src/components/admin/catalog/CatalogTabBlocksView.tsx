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
  Power,
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
  updateCatalogProduct,
  archiveCatalogProduct,
} from '@/lib/api';
import { collectCategorySubtreeIds } from '@/lib/catalog-navigation';
import type { CategoryNode } from './CategoryTreeEditor';
import type { ProductV2 } from './ProductEditor';
import type { SchemaDetails } from './SchemaAttributeEditor';
import { CatalogOption3BlocksEditor } from './CatalogOption3BlocksEditor';

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

  // Danh mục gốc đang chọn
  const activeRootCategory = useMemo(() => {
    if (selectedRootId === 'all') return null;
    return rootCategories.find((r) => String(r.id) === String(selectedRootId)) || null;
  }, [rootCategories, selectedRootId]);

  // Lọc danh sách danh mục con trực thuộc Root đang chọn
  const subcategories = useMemo(() => {
    if (selectedRootId === 'all') {
      return categories.filter((c) => c.parent_id !== null);
    }
    const rootIdNum = Number(selectedRootId);
    return categories.filter((c) => Number(c.parent_id) === rootIdNum);
  }, [categories, selectedRootId]);

  // Toàn bộ category IDs thuộc subtree của root đang chọn
  const scopedCategoryIds = useMemo(() => {
    if (selectedRootId === 'all') return null;
    return collectCategorySubtreeIds(categories, Number(selectedRootId));
  }, [categories, selectedRootId]);

  // Tab 2: Lọc sản phẩm theo danh mục con
  const [productFilterSubcat, setProductFilterSubcat] = useState<string>('all');
  const [productSearch, setProductSearch] = useState('');

  // Tab 3: Danh mục đang chọn để cấu hình tùy chọn
  const [optionTargetCatId, setOptionTargetCatId] = useState<number | null>(null);

  // Modal Thêm / Sửa Danh Mục Con
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryNode | null>(null);
  const [catName, setCatName] = useState('');
  const [catLane, setCatLane] = useState<'kitchen' | 'packing' | 'inherit'>('inherit');
  const [catSaving, setCatSaving] = useState(false);

  // Tên Ngành gốc đang chọn
  const activeRootName = useMemo(() => {
    if (selectedRootId === 'all') return 'Tất cả danh mục';
    return activeRootCategory ? activeRootCategory.name : 'Danh mục';
  }, [activeRootCategory, selectedRootId]);

  // Danh mục khả dụng để cấu hình tùy chọn trong Tab 3 (Ngành gốc dùng chung + Danh mục con cục bộ)
  const optionEligibleCategories = useMemo(() => {
    const list: (CategoryNode & { scopeLabel?: string; isRootScope?: boolean })[] = [];
    if (activeRootCategory) {
      list.push({
        ...activeRootCategory,
        isRootScope: true,
        scopeLabel: `👑 ${activeRootCategory.name} (Ngành Gốc — Dùng chung/Kế thừa)`,
      });
      for (const sub of subcategories) {
        list.push({
          ...sub,
          isRootScope: false,
          scopeLabel: `📁 ${sub.name} (Danh mục con)`,
        });
      }
    } else {
      for (const root of rootCategories) {
        list.push({
          ...root,
          isRootScope: true,
          scopeLabel: `👑 ${root.name} (Ngành Gốc — Dùng chung/Kế thừa)`,
        });
        const children = categories.filter((c) => Number(c.parent_id) === Number(root.id));
        for (const child of children) {
          list.push({
            ...child,
            isRootScope: false,
            scopeLabel: `  ↳ 📁 ${child.name} (Danh mục con)`,
          });
        }
      }
    }
    return list;
  }, [activeRootCategory, subcategories, rootCategories, categories]);

  // Danh mục đang được cấu hình tùy chọn ở Tab 3
  const currentOptionCategory = useMemo(() => {
    if (optionEligibleCategories.length === 0) return null;
    if (optionTargetCatId) {
      const found = optionEligibleCategories.find((c) => Number(c.id) === optionTargetCatId);
      if (found) return found;
    }
    return optionEligibleCategories[0];
  }, [optionEligibleCategories, optionTargetCatId]);

  // Danh sách sản phẩm của danh mục đang chọn ở Tab 3
  const currentCategoryProducts = useMemo(() => {
    if (!currentOptionCategory) return [];
    return products.filter((p) => Number(p.category_id) === Number(currentOptionCategory.id));
  }, [products, currentOptionCategory]);

  // Tự động sinh slug URL ngầm
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

  // Danh sách sản phẩm cho Tab 2
  const displayedProducts = useMemo(() => {
    let list = products;
    if (productFilterSubcat !== 'all') {
      const targetSubcatId = Number(productFilterSubcat);
      list = list.filter((p) => Number(p.category_id) === targetSubcatId);
    } else if (scopedCategoryIds) {
      list = list.filter((p) => scopedCategoryIds.has(Number(p.category_id)));
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
  }, [products, productFilterSubcat, scopedCategoryIds, productSearch]);

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

  // Toggle trạng thái Tạm ngưng / Hoạt động của Danh Mục Con kèm cập nhật toàn bộ sản phẩm bên trong
  const handleToggleCategoryVisibility = async (cat: CategoryNode) => {
    const nextVisible = !cat.is_visible;
    try {
      await updateCatalogCategory(cat.id, {
        name: cat.name,
        slug: cat.slug,
        is_visible: nextVisible,
        default_fulfillment_lane: cat.default_fulfillment_lane,
      });

      // Cập nhật liên kết: Nếu danh mục con tạm ngưng -> tạm ngưng toàn bộ sản phẩm bên trong
      // Nếu danh mục con bật lại -> mở lại toàn bộ sản phẩm bên trong
      const relatedProds = products.filter((p) => Number(p.category_id) === Number(cat.id));
      for (const prod of relatedProds) {
        await updateCatalogProduct(prod.id, {
          name: prod.name,
          slug: prod.slug,
          category_id: prod.category_id,
          price: prod.price,
          is_available: nextVisible,
          status: nextVisible ? 'active' : 'inactive',
        });
      }

      toast.success(`Đã ${nextVisible ? 'mở bán' : 'tạm ngưng'} danh mục "${cat.name}" và toàn bộ sản phẩm bên trong`);
      await onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi cập nhật trạng thái danh mục');
    }
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
        setOptionTargetCatId(Number(created.id));
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

  // Toggle trạng thái Tạm ngưng / Bán của Sản phẩm (Nếu mở sản phẩm thì tự động bật danh mục cha)
  const handleToggleProductAvailability = async (prod: ProductV2) => {
    try {
      const nextAvailable = !prod.is_available;
      const nextStatus = nextAvailable ? 'active' : 'inactive';
      await updateCatalogProduct(prod.id, {
        name: prod.name,
        slug: prod.slug,
        category_id: prod.category_id,
        price: prod.price,
        is_available: nextAvailable,
        status: nextStatus,
      });

      // Nếu mở sản phẩm mà danh mục con đang tạm ngưng -> mở lại danh mục con luôn
      if (nextAvailable) {
        const parentCat = categories.find((c) => Number(c.id) === Number(prod.category_id));
        if (parentCat && !parentCat.is_visible) {
          await updateCatalogCategory(parentCat.id, {
            name: parentCat.name,
            slug: parentCat.slug,
            is_visible: true,
            default_fulfillment_lane: parentCat.default_fulfillment_lane,
          });
        }
      }

      toast.success(`Đã ${nextAvailable ? 'mở bán' : 'tạm ngưng'} món "${prod.name}"`);
      await onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi cập nhật trạng thái món');
    }
  };

  // Xóa sản phẩm
  const handleDeleteProduct = async (prod: ProductV2) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa món "${prod.name}" khỏi danh mục?`)) return;
    try {
      await archiveCatalogProduct(prod.id);
      toast.success(`Đã xóa món "${prod.name}"`);
      await onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi xóa sản phẩm');
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
      {/* TAB 1: DANH MỤC CON */}
      {/* ========================================================= */}
      {activeTab === 'subcategories' && (
        <div className="bg-card rounded-xl border p-5 space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-foreground">
              Danh Mục Con ({activeRootName})
            </h2>

            {isSuperAdmin && (
              <Button
                size="sm"
                variant="hero"
                className="text-xs"
                onClick={handleOpenCreateCategory}
                disabled={selectedRootId === 'all'}
                title={selectedRootId === 'all' ? 'Vui lòng chọn danh mục gốc trước' : 'Thêm danh mục con'}
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
                  <th className="p-3.5">Khu Vực Xử Lý</th>
                  <th className="p-3.5">Trạng Thái</th>
                  <th className="p-3.5 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {subcategories.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground text-xs space-y-2">
                      <p>Chưa có danh mục con nào trong "{activeRootName}".</p>
                      {activeRootCategory && (
                        <p className="text-[11px] text-primary font-semibold">
                          (Danh mục “{activeRootCategory.name}” hiện đang chứa trực tiếp {displayedProducts.length} sản phẩm ở Tab 2).
                        </p>
                      )}
                    </td>
                  </tr>
                ) : (
                  subcategories.map((cat) => {
                    const count = products.filter((p) => Number(p.category_id) === Number(cat.id)).length;
                    const lane = cat.default_fulfillment_lane;

                    return (
                      <tr key={cat.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3.5 font-bold text-foreground flex items-center gap-2">
                          <span>{cat.name}</span>
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
                            {lane === 'kitchen' ? '🍳 Quầy Bếp / Pha chế' : lane === 'packing' ? '📦 Soạn / Đóng gói' : 'Theo danh mục gốc'}
                          </Badge>
                        </td>
                        <td className="p-3.5">
                          <span className={cat.is_visible ? 'text-emerald-600 font-bold' : 'text-destructive font-bold'}>
                            {cat.is_visible ? '🟢 Đang hoạt động' : '🔴 Tạm ngưng'}
                          </span>
                        </td>
                        <td className="p-3.5 text-right space-x-1.5">
                          {isSuperAdmin && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className={`h-7 text-xs px-2 ${cat.is_visible ? 'text-amber-600 hover:text-amber-700' : 'text-emerald-600 hover:text-emerald-700'}`}
                                onClick={() => handleToggleCategoryVisibility(cat)}
                                title={cat.is_visible ? 'Tạm ngưng danh mục con và tất cả món bên trong' : 'Mở bán lại danh mục con và tất cả món bên trong'}
                              >
                                <Power className="size-3 mr-1" />
                                {cat.is_visible ? 'Tạm ngưng' : 'Mở bán'}
                              </Button>
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
      {/* TAB 2: QUẢN LÝ SẢN PHẨM */}
      {/* ========================================================= */}
      {activeTab === 'products' && (
        <div className="bg-card rounded-xl border p-5 space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <h2 className="text-sm font-bold text-foreground">Danh Sách Sản Phẩm</h2>
              </div>

              {/* LỌC THEO DANH MỤC CON */}
              {subcategories.length > 0 && (
                <Select value={productFilterSubcat} onValueChange={setProductFilterSubcat}>
                  <SelectTrigger className="h-8 text-xs w-[220px] bg-background">
                    <SelectValue placeholder="Lọc theo danh mục con" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">Tất cả danh mục con ({displayedProducts.length} món)</SelectItem>
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
              )}
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
                  onClick={() => onOpenProductEditor(
                    undefined,
                    productFilterSubcat !== 'all'
                      ? Number(productFilterSubcat)
                      : subcategories[0]?.id
                      ? Number(subcategories[0].id)
                      : activeRootCategory?.id
                      ? Number(activeRootCategory.id)
                      : undefined
                  )}
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
                  <th className="p-3.5">Danh Mục</th>
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
                    const cat = categories.find((c) => Number(c.id) === Number(prod.category_id));
                    const lane = prod.fulfillment_lane || cat?.default_fulfillment_lane || 'kitchen';

                    return (
                      <tr key={prod.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3.5 font-bold text-foreground flex items-center gap-2.5">
                          <div className="size-10 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden border">
                            {prod.image_url ? (
                              <img src={prod.image_url} alt={prod.name} className="size-full object-cover" />
                            ) : (
                              <ShoppingBag className="size-5 text-muted-foreground/50" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-foreground">{prod.name}</p>
                            {prod.base_tea && <p className="text-[10px] text-muted-foreground">Trà nền: {prod.base_tea}</p>}
                          </div>
                        </td>
                        <td className="p-3.5 font-semibold text-foreground">{cat ? cat.name : 'Chưa gán'}</td>
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
                            {prod.is_available ? '🟢 Đang bán' : '🔴 Tạm ngưng'}
                          </span>
                        </td>
                        <td className="p-3.5 text-right space-x-1.5">
                          {isSuperAdmin && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className={`h-7 text-xs px-2 ${prod.is_available ? 'text-amber-600 hover:text-amber-700' : 'text-emerald-600 hover:text-emerald-700'}`}
                                onClick={() => handleToggleProductAvailability(prod)}
                                title={prod.is_available ? 'Tạm ngưng bán món này' : 'Mở bán món này'}
                              >
                                <Power className="size-3 mr-1" />
                                {prod.is_available ? 'Tạm ngưng' : 'Mở bán'}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs px-2 bg-background hover:bg-accent"
                                onClick={() => onOpenProductEditor(prod, Number(prod.category_id))}
                              >
                                <Edit2 className="size-3 mr-1" /> Sửa
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs px-2 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteProduct(prod)}
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
      {/* TAB 3: TÙY CHỌN DANH MỤC CON (3 BLOCKS CHUẨN ĐẠI CA) */}
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
                  Cấu Hình Tùy Chọn Theo Danh Mục
                </h2>
                <p className="text-xs text-muted-foreground">
                  Thiết lập 3 Block: Tùy chọn không tiền &bull; Tùy chọn có tiền &bull; Cấu hình riêng cho sản phẩm.
                </p>
              </div>
            </div>

            {/* Category selector pills */}
            <div className="flex flex-wrap items-center gap-1.5 bg-muted/60 p-1.5 rounded-xl border">
              <span className="text-xs font-bold text-muted-foreground pl-1.5 pr-1">Phạm vi áp dụng:</span>
              {optionEligibleCategories.map((cat) => {
                const isSelected = currentOptionCategory?.id === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setOptionTargetCatId(Number(cat.id))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                      isSelected
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : cat.isRootScope
                        ? 'bg-amber-500/10 text-amber-900 dark:text-amber-300 hover:bg-amber-500/20 border border-amber-500/30'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {cat.scopeLabel || cat.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3 BLOCKS OPTION EDITOR */}
          {!currentOptionCategory ? (
            <div className="p-12 text-center text-muted-foreground space-y-2">
              <p className="text-xs">Vui lòng tạo hoặc chọn một danh mục để cấu hình tùy chọn.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-primary/5 border border-primary/10 rounded-xl text-xs text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="size-4 text-primary shrink-0" />
                <span>
                  Đang thiết lập tùy chọn cho: <b className="text-foreground">{currentOptionCategory.name}</b>.
                </span>
              </div>

              <CatalogOption3BlocksEditor
                categoryId={Number(currentOptionCategory.id)}
                categoryName={currentOptionCategory.name}
                schema={activeSchema}
                categoryProducts={currentCategoryProducts}
                onRefresh={onRefresh}
              />
            </div>
          )}
        </div>
      )}

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
                Danh mục trực thuộc: <b className="text-foreground">{activeRootName}</b>
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
                    <SelectItem value="inherit" className="text-xs">Theo danh mục gốc</SelectItem>
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
