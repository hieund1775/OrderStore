import { createFileRoute, useLocation, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  FolderTree,
  ShoppingBag,
  Boxes,
  Sliders,
  Plus,
  Image as ImageIcon,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import {
  fetchCatalogCategories,
  fetchProductTypes,
  fetchCatalogProducts,
  fetchSchemaDetails,
  createCatalogCategory,
  createCatalogIndustry,
  updateCatalogCategory,
  archiveCatalogCategory,
  createCatalogProduct,
  updateCatalogProduct,
  getUser,
} from '@/lib/api';
import type { CategoryNode, ProductType, ProductV2 } from '@/types/catalog-v2';
import { CatalogRootSelector } from '@/components/admin/catalog/CatalogRootSelector';
import { CatalogTabBlocksView } from '@/components/admin/catalog/CatalogTabBlocksView';
import {
  buildCategoryBreadcrumb,
  collectCategorySubtreeIds,
  getLeafCategories,
  getRootCategories,
} from '@/lib/catalog-navigation';
import { toast } from 'sonner';

export const Route = createFileRoute('/admin/catalog')({
  validateSearch: (search: Record<string, unknown>) => ({
    rootId: typeof search.rootId === 'string' ? search.rootId : undefined,
  }),
  component: AdminCatalogPage,
  head: () => ({
    meta: [
      { title: 'Quản lý Sản phẩm & Danh mục Đa Ngành | Trà Trái Cây Tô Admin' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
});

export function AdminCatalogPage({ lane }: { lane?: 'kitchen' | 'packing' }) {
  const location = useLocation();
  const navigate = useNavigate();
  const routeLane = location?.pathname?.includes('/packing') ? 'packing' : 'kitchen';
  const activeLane = lane || routeLane;
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [products, setProducts] = useState<ProductV2[]>([]);
  const [selectedProductType, setSelectedProductType] = useState<ProductType | null>(null);
  const [activeSchema, setActiveSchema] = useState<any | null>(null);
  const [selectedRootId, setSelectedRootId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('rootId') || '';
    }
    return '';
  });
  const [loading, setLoading] = useState(true);

  const updateUrlRootId = useCallback((id: string) => {
    navigate({
      search: (prev: any) => ({
        ...prev,
        rootId: id || undefined,
      }),
      replace: true,
    });
  }, [navigate]);

  const handleSelectRootId = useCallback((id: string) => {
    setSelectedRootId(id);
    updateUrlRootId(id);
  }, [updateUrlRootId]);

  // Modal tạo / sửa danh mục gốc
  const [createRootOpen, setCreateRootOpen] = useState(false);
  const [editingRootCategory, setEditingRootCategory] = useState<CategoryNode | null>(null);
  const [newRootName, setNewRootName] = useState('');
  const [creatingRoot, setCreatingRoot] = useState(false);
  const [rootError, setRootError] = useState<string | null>(null);

  // Modal Tạo / Sửa Sản Phẩm Nhanh (Ảnh ở trên, bỏ mô tả, step=1000)
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductV2 | null>(null);
  const [productFormData, setProductFormData] = useState({
    name: '',
    category_id: '' as string | number,
    price: 35000,
    image_url: '',
    fulfillment_lane: 'kitchen' as 'kitchen' | 'packing',
    stock_mode: 'made_to_order' as 'tracked' | 'made_to_order',
  });
  const [productSaving, setProductSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentUser = getUser();
  const isSuperAdmin = currentUser?.role === 'super';

  // Hàm tự động sinh slug URL chuẩn không dấu ngầm ở background
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

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [cats, types, prods] = await Promise.all([
        fetchCatalogCategories({ includeArchived: false, lane: activeLane }),
        fetchProductTypes(),
        fetchCatalogProducts({ lane: activeLane }),
      ]);
      setCategories(Array.isArray(cats) ? cats : []);
      const laneProductTypes = (Array.isArray(types) ? types : []).filter((type) => type.default_fulfillment_lane === activeLane);
      setProductTypes(laneProductTypes);
      setProducts(Array.isArray(prods) ? prods : []);

      if (laneProductTypes.length > 0) {
        const currentSelected = selectedProductType
          ? laneProductTypes.find((type) => type.id === selectedProductType.id) || laneProductTypes[0]
          : laneProductTypes[0];
        setSelectedProductType(currentSelected);

        const schemaId = currentSelected.draft_schema_id || currentSelected.published_schema_id;
        if (schemaId) {
          const schema = await fetchSchemaDetails(schemaId);
          setActiveSchema(schema);
        } else setActiveSchema(null);
      } else {
        setSelectedProductType(null);
        setActiveSchema(null);
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi nạp dữ liệu Catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [activeLane]);

  // Danh mục gốc (depth = 0)
  const rootCategories = useMemo(() => {
    const safeCategories = Array.isArray(categories) ? categories : [];
    return getRootCategories(safeCategories).filter((category) => {
      const lane = category.default_fulfillment_lane || category.product_type_default_fulfillment_lane || 'kitchen';
      return lane === activeLane;
    });
  }, [categories, activeLane]);

  // Tự động chọn Ngành gốc đầu tiên nếu chưa chọn hoặc id không còn tồn tại
  useEffect(() => {
    if (rootCategories.length > 0) {
      const urlParamId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('rootId') : null;
      const targetCandidate = selectedRootId || urlParamId || '';
      const candidateExists = targetCandidate ? rootCategories.some((root) => String(root.id) === targetCandidate) : false;

      if (candidateExists && targetCandidate) {
        if (selectedRootId !== targetCandidate) {
          setSelectedRootId(targetCandidate);
        }
        if (urlParamId !== targetCandidate) {
          updateUrlRootId(targetCandidate);
        }
      } else {
        const fallbackId = String(rootCategories[0].id);
        setSelectedRootId(fallbackId);
        updateUrlRootId(fallbackId);
      }
    } else {
      setSelectedRootId('');
    }
  }, [rootCategories, selectedRootId, updateUrlRootId]);

  // Danh mục thuộc khu vực activeLane (loại trừ tuyệt đối danh mục của lane khác)
  const laneCategories = useMemo(() => {
    const rootIdSet = new Set(rootCategories.map((r) => Number(r.id)));
    return categories.filter((c) => {
      if (c.parent_id == null) {
        return rootIdSet.has(Number(c.id));
      }
      const directLane = c.default_fulfillment_lane || c.product_type_default_fulfillment_lane;
      if (directLane) return directLane === activeLane;
      return rootIdSet.has(Number(c.parent_id));
    });
  }, [categories, rootCategories, activeLane]);

  // Tập hợp các category ID thuộc subtree của root đang chọn
  const scopedCategoryIds = useMemo(() => {
    const effectiveRootId = selectedRootId || (rootCategories[0] ? String(rootCategories[0].id) : null);
    if (!effectiveRootId) return null;
    return collectCategorySubtreeIds(laneCategories, Number(effectiveRootId));
  }, [selectedRootId, laneCategories, rootCategories]);

  // Danh mục hiển thị theo scope
  const filteredCategories = useMemo(() => {
    if (!scopedCategoryIds) return laneCategories;
    return laneCategories.filter((c) => scopedCategoryIds.has(Number(c.id)));
  }, [scopedCategoryIds, laneCategories]);

  // Sản phẩm hiển thị theo scope
  const filteredProducts = useMemo(() => {
    const allowedCategoryIds = new Set(filteredCategories.map((c) => Number(c.id)));
    return products.filter((p) => {
      if (!allowedCategoryIds.has(Number(p.category_id))) {
        return false;
      }
      const cat = categories.find((c) => Number(c.id) === Number(p.category_id));
      const effectiveLane = p.fulfillment_lane || cat?.default_fulfillment_lane || cat?.product_type_default_fulfillment_lane || 'kitchen';
      return effectiveLane === activeLane;
    });
  }, [filteredCategories, products, categories, activeLane]);

  // Danh sách danh mục con khả dụng để gán sản phẩm
  const productCategoryOptions = useMemo(() => {
    const rootIdSet = new Set(rootCategories.map((r) => Number(r.id)));
    const list = getLeafCategories(filteredCategories).filter((category) => {
      if (category.parent_id === null) return false;
      const directLane = category.default_fulfillment_lane || category.product_type_default_fulfillment_lane;
      return directLane ? directLane === activeLane : rootIdSet.has(Number(category.parent_id));
    });
    if (list.length > 0) {
      return list.map((category) => ({
        ...category,
        breadcrumb: buildCategoryBreadcrumb(categories, category.id),
      }));
    }
    return filteredCategories
      .filter((c) => c.parent_id !== null)
      .map((category) => ({
        ...category,
        breadcrumb: category.name,
      }));
  }, [categories, filteredCategories, activeLane, rootCategories]);

  // Tạo / Sửa ngành gốc
  const handleOpenCreateRoot = () => {
    setEditingRootCategory(null);
    setNewRootName('');
    setRootError(null);
    setCreateRootOpen(true);
  };

  const handleOpenEditRoot = (root: any) => {
    setEditingRootCategory(root);
    setNewRootName(root.name);
    setRootError(null);
    setCreateRootOpen(true);
  };

  const handleDeleteRootCategory = async (root: any) => {
    const hasSubcats = categories.some((c) => Number(c.parent_id) === Number(root.id));
    const hasDirectProds = products.some((p) => Number(p.category_id) === Number(root.id));

    if (hasSubcats || hasDirectProds) {
      toast.error(`Ngành "${root.name}" đang chứa danh mục con hoặc sản phẩm. Vui lòng chuyển hoặc xóa danh mục con trước.`);
      return;
    }

    if (!confirm(`Bạn có chắc chắn muốn xóa ngành hàng gốc "${root.name}"?`)) return;

    try {
      await archiveCatalogCategory(root.id);
      toast.success(`Đã xóa ngành hàng "${root.name}"`);
      handleSelectRootId('');
      await loadAllData();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi xóa ngành hàng');
    }
  };

  const handleSaveRootCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRootName.trim()) {
      toast.error('Vui lòng nhập tên ngành hàng gốc');
      return;
    }

    const autoSlug = generateSlugFromName(newRootName);

    try {
      setRootError(null);
      setCreatingRoot(true);
      if (editingRootCategory) {
        await updateCatalogCategory(editingRootCategory.id, {
          name: newRootName.trim(),
          slug: autoSlug,
          is_visible: editingRootCategory.is_visible,
        });
        toast.success(`Đã cập nhật ngành hàng "${newRootName}"`);
      } else {
        const created = await createCatalogIndustry({
          name: newRootName.trim(),
          code: autoSlug.replace(/-/g, '_'),
          default_stock_mode: 'made_to_order',
          default_fulfillment_lane: activeLane,
        });
        toast.success(`Đã tạo ngành hàng "${newRootName}"`);
        if (created?.rootCategory?.id) handleSelectRootId(String(created.rootCategory.id));
      }
      setCreateRootOpen(false);
      setNewRootName('');
      await loadAllData();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.data?.error || err.message || 'Lỗi lưu ngành hàng gốc';
      setRootError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setCreatingRoot(false);
    }
  };

  // Mở modal tạo / sửa sản phẩm
  const handleOpenProductModal = (product?: ProductV2, defaultCategoryId?: number) => {
    if (product) {
      const cat = categories.find((c) => Number(c.id) === Number(product.category_id));
      const effectiveLane = product.fulfillment_lane || (cat?.default_fulfillment_lane as any) || (cat?.product_type_default_fulfillment_lane as any) || activeLane;
      setEditingProduct(product);
      setProductFormData({
        name: product.name,
        category_id: product.category_id,
        price: product.price,
        image_url: product.image_url || '',
        fulfillment_lane: effectiveLane,
        stock_mode: product.stock_mode || 'made_to_order',
      });
    } else {
      const defaultCat = defaultCategoryId
        ? categories.find((c) => Number(c.id) === Number(defaultCategoryId))
        : productCategoryOptions[0];
      const defaultCatLane = (defaultCat?.default_fulfillment_lane || defaultCat?.product_type_default_fulfillment_lane || activeLane) as 'kitchen' | 'packing';
      setEditingProduct(null);
      setProductFormData({
        name: '',
        category_id: defaultCat?.id ?? '',
        price: 35000,
        image_url: '',
        fulfillment_lane: defaultCatLane,
        stock_mode: 'made_to_order',
      });
    }
    setProductModalOpen(true);
  };

  // Xử lý upload ảnh từ thiết bị
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Dung lượng ảnh tối đa 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setProductFormData((prev) => ({ ...prev, image_url: dataUrl }));
      toast.success('Đã tải ảnh lên thành công');
    };
    reader.onerror = () => {
      toast.error('Lỗi đọc file ảnh');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productFormData.name.trim()) {
      toast.error('Vui lòng nhập tên sản phẩm');
      return;
    }
    if (!productFormData.category_id) {
      toast.error('Vui lòng chọn danh mục con cho sản phẩm');
      return;
    }
    if (productFormData.price == null || productFormData.price < 0) {
      toast.error('Vui lòng nhập giá bán hợp lệ');
      return;
    }

    const autoSlug = generateSlugFromName(productFormData.name);

    try {
      setProductSaving(true);
      if (editingProduct) {
        await updateCatalogProduct(editingProduct.id, {
          ...productFormData,
          slug: autoSlug,
          category_id: Number(productFormData.category_id),
          price: Number(productFormData.price),
        });
        toast.success(`Đã cập nhật món "${productFormData.name}"`);
      } else {
        await createCatalogProduct({
          ...productFormData,
          slug: autoSlug,
          category_id: Number(productFormData.category_id),
          price: Number(productFormData.price),
        });
        toast.success(`Đã thêm món "${productFormData.name}"`);
      }
      setProductModalOpen(false);
      await loadAllData();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi lưu sản phẩm');
    } finally {
      setProductSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-primary/10 text-primary rounded-lg p-2">
              <Boxes className="size-5" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight">
                Quản Lý Sản Phẩm & Danh Mục
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Quản lý các danh mục theo 3 Khối Tab: Danh mục con &bull; Sản phẩm &bull; Tùy chọn độc lập.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* TOPBAR: ROOT CATEGORY SELECTOR */}
      <CatalogRootSelector
        roots={rootCategories}
        totalCategories={laneCategories.length}
        value={selectedRootId}
        onValueChange={handleSelectRootId}
        canCreateRoot={isSuperAdmin}
        onCreateRoot={handleOpenCreateRoot}
        onEditRoot={handleOpenEditRoot}
        onDeleteRoot={handleDeleteRootCategory}
        activeLane={activeLane}
      />

      {/* 3-TAB VIEW: SUB-CATEGORIES, PRODUCTS, OPTIONS */}
      <CatalogTabBlocksView
        rootCategories={rootCategories}
        selectedRootId={selectedRootId}
        onSelectRootId={handleSelectRootId}
        categories={filteredCategories}
        products={filteredProducts}
        productTypes={productTypes}
        activeSchema={activeSchema}
        activeLane={activeLane}
        isSuperAdmin={isSuperAdmin}
        onRefresh={loadAllData}
        onOpenProductEditor={handleOpenProductModal}
      />

      {/* MODAL TẠO / SỬA DANH MỤC GỐC */}
      <Dialog open={createRootOpen} onOpenChange={setCreateRootOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSaveRootCategory}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Plus className="size-5 text-primary" />
                <span>{editingRootCategory ? 'Đổi Tên Ngành Hàng Gốc' : `Tạo Ngành Hàng Gốc ${activeLane === 'packing' ? 'Đóng gói' : 'Bếp'}`}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {rootError && (
                <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/15 p-3 text-xs font-semibold text-destructive">
                  {rootError}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="root-name" className="text-xs font-semibold">
                  Tên ngành hàng gốc <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="root-name"
                  placeholder="Ví dụ: Nước uống, Quần áo & Thời trang, Quà lưu niệm..."
                  value={newRootName}
                  onChange={(e) => {
                    setNewRootName(e.target.value);
                    if (rootError) setRootError(null);
                  }}
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateRootOpen(false)}
                disabled={creatingRoot}
              >
                Hủy
              </Button>
              <Button type="submit" variant="hero" disabled={creatingRoot}>
                {creatingRoot ? 'Đang lưu...' : editingRootCategory ? 'Cập nhật' : 'Tạo ngành hàng'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL TẠO / SỬA SẢN PHẨM (ẢNH Ở TRÊN, STEP=1000, BỎ MÔ TẢ) */}
      <Dialog open={productModalOpen} onOpenChange={setProductModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSaveProduct}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <ShoppingBag className="size-5 text-primary" />
                <span>{editingProduct ? 'Chỉnh Sửa Món' : 'Thêm Món Mới'}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-3 max-h-[70vh] overflow-y-auto pr-1">
              {/* KHUNG TẢI ẢNH / LINK ẢNH NẰM TRÊN CÙNG */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold flex items-center justify-between">
                  <span>Ảnh sản phẩm</span>
                  {productFormData.image_url && (
                    <button
                      type="button"
                      onClick={() => setProductFormData((prev) => ({ ...prev, image_url: '' }))}
                      className="text-[11px] text-destructive hover:underline flex items-center gap-1"
                    >
                      <X className="size-3" /> Xóa ảnh
                    </button>
                  )}
                </Label>

                <div className="flex items-center gap-3">
                  <div className="size-20 rounded-xl border-2 border-dashed bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {productFormData.image_url ? (
                      <img src={productFormData.image_url} alt="Xem trước" className="size-full object-cover" />
                    ) : (
                      <ImageIcon className="size-8 text-muted-foreground/40" />
                    )}
                  </div>

                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs h-8 bg-background"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="size-3.5 mr-1.5" />
                        Tải ảnh từ máy
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageFileChange}
                      />
                    </div>

                    <Input
                      id="prod-image-url"
                      placeholder="Hoặc dán đường dẫn link ảnh (URL)..."
                      className="text-xs h-8"
                      value={productFormData.image_url}
                      onChange={(e) => setProductFormData((prev) => ({ ...prev, image_url: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* TÊN SẢN PHẨM */}
              <div className="space-y-2">
                <Label htmlFor="prod-name" className="text-xs font-semibold">
                  Tên sản phẩm <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="prod-name"
                  placeholder="Ví dụ: Trà sữa Khoai môn, Nước ép cam, Áo thun..."
                  value={productFormData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setProductFormData((prev) => ({ ...prev, name }));
                  }}
                  required
                />
              </div>

              {/* DANH MỤC CON & GIÁ BÁN (STEP=1000, BẮT BUỘC) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">
                    Danh mục con trực thuộc <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={String(productFormData.category_id)}
                    onValueChange={(val) => {
                      const selectedCat = categories.find((c) => Number(c.id) === Number(val));
                      const lane = (selectedCat?.default_fulfillment_lane || selectedCat?.product_type_default_fulfillment_lane || activeLane) as 'kitchen' | 'packing';
                      setProductFormData((prev) => ({ ...prev, category_id: val, fulfillment_lane: lane }));
                    }}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Chọn danh mục con" />
                    </SelectTrigger>
                    <SelectContent>
                      {productCategoryOptions.map((cat) => (
                        <SelectItem key={cat.id} value={String(cat.id)} className="text-xs">
                          {cat.breadcrumb || cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prod-price" className="text-xs font-semibold">
                    Giá bán (VNĐ) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="prod-price"
                    type="number"
                    min={0}
                    step={1000}
                    value={productFormData.price}
                    onChange={(e) => setProductFormData((prev) => ({ ...prev, price: Number(e.target.value) }))}
                    required
                  />
                </div>
              </div>

            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setProductModalOpen(false)} disabled={productSaving}>
                Hủy
              </Button>
              <Button type="submit" variant="hero" disabled={productSaving}>
                {productSaving ? 'Đang lưu...' : editingProduct ? 'Cập nhật' : 'Thêm sản phẩm'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminCatalogPage;
