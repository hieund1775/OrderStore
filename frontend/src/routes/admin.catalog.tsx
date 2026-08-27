import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import {
  FolderTree,
  ShoppingBag,
  Boxes,
  Sliders,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  fetchCatalogCategories,
  fetchProductTypes,
  fetchCatalogProducts,
  fetchSchemaDetails,
  getUser,
} from '@/lib/api';
import { CategoryTreeEditor } from '@/components/admin/catalog/CategoryTreeEditor';
import { ProductTypeEditor } from '@/components/admin/catalog/ProductTypeEditor';
import { SchemaAttributeEditor } from '@/components/admin/catalog/SchemaAttributeEditor';
import { ProductEditor } from '@/components/admin/catalog/ProductEditor';
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
  const [categories, setCategories] = useState<any[]>([]);
  const [productTypes, setProductTypes] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductType, setSelectedProductType] = useState<any | null>(null);
  const [activeSchema, setActiveSchema] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

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
          ? types.find((t: any) => t.id === selectedProductType.id) || types[0]
          : types[0];
        setSelectedProductType(currentSelected);

        const schemaId = currentSelected.published_schema_id || (await getFirstSchemaId(currentSelected.id));
        if (schemaId) {
          const schema = await fetchSchemaDetails(schemaId);
          setActiveSchema(schema);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi nạp dữ liệu Catalog V2');
    } finally {
      setLoading(false);
    }
  };

  const getFirstSchemaId = async (productTypeId: number) => {
    return 1; // Fallback
  };

  const handleSelectProductType = async (pt: any) => {
    setSelectedProductType(pt);
    try {
      const schemaId = pt.published_schema_id || 1;
      const schema = await fetchSchemaDetails(schemaId);
      setActiveSchema(schema);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi nạp cấu hình schema');
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

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
                Quản Lý Sản Phẩm & Danh Mục (Catalog V2)
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Mở rộng bán đa ngành hàng (F&B, Đồ ăn vặt, Thời trang & Quần áo) với cây danh mục 3 cấp và biến thể SKU.
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="products" className="flex items-center gap-2">
            <ShoppingBag className="size-4" />
            <span>Sản phẩm</span>
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <FolderTree className="size-4" />
            <span>Cây danh mục</span>
          </TabsTrigger>
          <TabsTrigger value="schemas" className="flex items-center gap-2">
            <Sliders className="size-4" />
            <span>Ngành hàng & Schema</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <ProductEditor
            products={products}
            categories={categories}
            onRefresh={loadAllData}
            isSuperAdmin={isSuperAdmin}
          />
        </TabsContent>

        <TabsContent value="categories">
          <CategoryTreeEditor
            categories={categories}
            productTypes={productTypes}
            onRefresh={loadAllData}
            isSuperAdmin={isSuperAdmin}
          />
        </TabsContent>

        <TabsContent value="schemas" className="space-y-6">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
