import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useMemo } from 'react';
import {
  FolderTree,
  ShoppingBag,
  Boxes,
  Sliders,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  fetchCatalogCategories,
  fetchProductTypes,
  fetchCatalogProducts,
  fetchSchemaDetails,
  createCatalogCategory,
  getUser,
} from '@/lib/api';
import { CategoryTreeEditor } from '@/components/admin/catalog/CategoryTreeEditor';
import { ProductTypeEditor, type ProductType } from '@/components/admin/catalog/ProductTypeEditor';
import { SchemaAttributeEditor } from '@/components/admin/catalog/SchemaAttributeEditor';
import { ProductEditor, type ProductV2 } from '@/components/admin/catalog/ProductEditor';
import type { CategoryNode } from '@/components/admin/catalog/CategoryTreeEditor';
import { CatalogRootSelector } from '@/components/admin/catalog/CatalogRootSelector';
import {
  buildCategoryBreadcrumb,
  collectCategorySubtreeIds,
  getLeafCategories,
  getRootCategories,
} from '@/lib/catalog-navigation';
import { toast } from 'sonner';

export const Route = createFileRoute('/admin/catalog')({
  component: AdminCatalogPage,
  head: () => ({
    meta: [
      { title: 'Quản lý Sản phẩm & Danh mục Đa Ngành | Trà Trái Cây Tô Admin' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
});

function AdminCatalogPage() {
  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'schemas'>('products');
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [products, setProducts] = useState<ProductV2[]>([]);
  const [selectedProductType, setSelectedProductType] = useState<ProductType | null>(null);
  const [activeSchema, setActiveSchema] = useState<any | null>(null);
  const [selectedRootId, setSelectedRootId] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Modal tạo danh mục gốc (depth = 0)
  const [createRootOpen, setCreateRootOpen] = useState(false);
  const [newRootName, setNewRootName] = useState('');
  const [newRootSlug, setNewRootSlug] = useState('');
  const [creatingRoot, setCreatingRoot] = useState(false);

  const currentUser = getUser();
  const isSuperAdmin = currentUser?.role === 'super';

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [cats, types, prods] = await Promise.all([
        fetchCatalogCategories({ includeArchived: false }),
        fetchProductTypes(),
        fetchCatalogProducts(),
      ]);
      setCategories(cats);
      setProductTypes(types);
      setProducts(prods);

      if (types.length > 0) {
        const currentSelected = selectedProductType
          ? types.find((type) => type.id === selectedProductType.id) || types[0]
          : types[0];
        setSelectedProductType(currentSelected);

        const schemaId = currentSelected.draft_schema_id || currentSelected.published_schema_id;
        if (schemaId) {
          const schema = await fetchSchemaDetails(schemaId);
          setActiveSchema(schema);
        } else setActiveSchema(null);
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi nạp dữ liệu Catalog V2');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProductType = async (pt: ProductType) => {
    setSelectedProductType(pt);
    try {
      const schemaId = pt.draft_schema_id || pt.published_schema_id;
      if (!schemaId) {
        setActiveSchema(null);
        return;
      }
      setActiveSchema(await fetchSchemaDetails(schemaId));
    } catch (err: any) {
      toast.error(err.message || 'Lỗi nạp cấu hình schema');
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Danh mục gốc (depth = 0)
  const rootCategories = useMemo(() => {
    return getRootCategories(categories);
  }, [categories]);

  // Tập hợp các category ID thuộc subtree của root đang chọn
  const scopedCategoryIds = useMemo(() => {
    if (selectedRootId === 'all') return null;

    return collectCategorySubtreeIds(categories, Number(selectedRootId));
  }, [selectedRootId, categories]);

  // Danh mục hiển thị theo scope
  const filteredCategories = useMemo(() => {
    if (!scopedCategoryIds) return categories;
    return categories.filter((c) => scopedCategoryIds.has(Number(c.id)));
  }, [scopedCategoryIds, categories]);

  // Sản phẩm hiển thị theo scope
  const filteredProducts = useMemo(() => {
    if (!scopedCategoryIds) return products;
    return products.filter((p) => scopedCategoryIds.has(Number(p.category_id)));
  }, [scopedCategoryIds, products]);

  const productCategoryOptions = useMemo(() => {
    return getLeafCategories(filteredCategories).map((category) => ({
      ...category,
      breadcrumb: buildCategoryBreadcrumb(categories, category.id),
    }));
  }, [categories, filteredCategories]);

  const handleCreateRootCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRootName.trim() || !newRootSlug.trim()) {
      toast.error('Vui lòng nhập tên và slug danh mục gốc');
      return;
    }

    try {
      setCreatingRoot(true);
      await createCatalogCategory({
        name: newRootName.trim(),
        slug: newRootSlug.trim().toLowerCase(),
        parent_id: null,
        product_type_id: null,
        sort_order: rootCategories.length + 1,
        is_visible: true,
      });
      toast.success(`Đã tạo danh mục gốc "${newRootName}"`);
      setCreateRootOpen(false);
      setNewRootName('');
      setNewRootSlug('');
      await loadAllData();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi tạo danh mục gốc');
    } finally {
      setCreatingRoot(false);
    }
  };

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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-primary/10 text-primary rounded-lg p-2">
              <Boxes className="size-5" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight">
                Quản Lý Sản Phẩm & Cây Danh Mục
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Quản lý các ngành hàng (Thực đơn, Quần áo, Quà lưu niệm...) với cây phân cấp danh mục trực quan.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadAllData} disabled={loading}>
            <RefreshCw className={`size-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>
        </div>
      </div>

      <CatalogRootSelector
        roots={rootCategories}
        totalCategories={categories.length}
        value={selectedRootId}
        onValueChange={setSelectedRootId}
        canCreateRoot={isSuperAdmin}
        onCreateRoot={() => setCreateRootOpen(true)}
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <TabsList className={`grid w-full ${isSuperAdmin ? 'grid-cols-3 max-w-lg' : 'grid-cols-2 max-w-md'}`}>
          <TabsTrigger value="products" className="flex items-center gap-2 text-xs sm:text-sm">
            <ShoppingBag className="size-4" />
            <span>Sản phẩm ({filteredProducts.length})</span>
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2 text-xs sm:text-sm">
            <FolderTree className="size-4" />
            <span>Cây danh mục ({filteredCategories.length})</span>
          </TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="schemas" className="flex items-center gap-2 text-xs sm:text-sm">
              <Sliders className="size-4" />
              <span>Cấu hình nâng cao</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="products">
          <ProductEditor
            products={filteredProducts}
            categories={productCategoryOptions}
            onRefresh={loadAllData}
            isSuperAdmin={isSuperAdmin}
          />
        </TabsContent>

        <TabsContent value="categories">
          <CategoryTreeEditor
            categories={filteredCategories}
            productTypes={productTypes}
            onRefresh={loadAllData}
            isSuperAdmin={isSuperAdmin}
          />
        </TabsContent>

        {isSuperAdmin && <TabsContent value="schemas" className="space-y-6">
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 rounded-lg p-3 text-xs">
            💡 <b>Cấu hình kỹ thuật nâng cao:</b> Định nghĩa các loại sản phẩm (Product Types) cùng Schema biến thể SKU và Modifiers (Đường, Đá, Topping, Size, Màu sắc...). Danh mục lá sẽ được liên kết với Schema tương ứng.
          </div>

          <ProductTypeEditor
            productTypes={productTypes}
            selectedTypeId={selectedProductType?.id || null}
            onSelectType={handleSelectProductType}
            onRefresh={loadAllData}
            isSuperAdmin={isSuperAdmin}
          />

          {activeSchema && (
            <SchemaAttributeEditor
              schema={activeSchema}
              onRefresh={loadAllData}
              isSuperAdmin={isSuperAdmin}
            />
          )}
        </TabsContent>}
      </Tabs>

      {/* Modal Tạo Danh Mục Gốc */}
      <Dialog open={createRootOpen} onOpenChange={setCreateRootOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateRootCategory}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Plus className="size-5 text-primary" />
                <span>Tạo Danh Mục Cấp Gốc Mới</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="root-name" className="text-xs font-semibold">
                  Tên danh mục gốc <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="root-name"
                  placeholder="Ví dụ: Thực đơn, Quần áo & Thời trang..."
                  value={newRootName}
                  onChange={(e) => {
                    setNewRootName(e.target.value);
                    if (!newRootSlug || newRootSlug === generateSlugFromName(newRootName)) {
                      setNewRootSlug(generateSlugFromName(e.target.value));
                    }
                  }}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="root-slug" className="text-xs font-semibold">
                  Slug (Định danh URL) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="root-slug"
                  placeholder="thuc-don, quan-ao..."
                  value={newRootSlug}
                  onChange={(e) => setNewRootSlug(e.target.value.toLowerCase())}
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
                {creatingRoot ? 'Đang tạo...' : 'Tạo danh mục gốc'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
export default AdminCatalogPage;
