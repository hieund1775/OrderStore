import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image, Loader2, Pencil, Plus, Trash2, Upload, X, Boxes, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { beginProductAvailabilityRequest, finishProductAvailabilityRequest } from "@/lib/product-availability";
import { AdminPageHeader, SectionCard } from "@/components/admin/AdminUI";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { vnd } from "@/lib/data";

export const Route = createFileRoute("/admin/thuc-don")({
  head: () => ({
    meta: [
      { title: "Quản lý thực đơn | Admin Trà Trái Cây Tô" },
      {
        name: "description",
        content: "CRUD danh mục, sản phẩm, SEO slug, sắp xếp hiển thị và cấu hình nhóm tùy chọn.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Quản lý thực đơn | Admin Trà Trái Cây Tô" },
      {
        property: "og:description",
        content: "Thêm, sửa, ẩn/hiện món và cấu hình tùy chọn size, đường, đá, topping.",
      },
    ],
  }),
  component: MenuAdminPage,
});

type Category = {
  id: number;
  name: string;
  slug: string;
  sort_order: number;
  is_visible: boolean;
  items: number;
};

type Product = {
  id: number;
  category_id: number;
  name: string;
  slug: string;
  base_tea: string;
  description: string | null;
  price: number;
  image_url: string | null;
  calories: number;
  is_available: boolean;
  category_name?: string;
};

type Topping = {
  id: number;
  name: string;
  price: number;
  is_available: boolean;
  sort_order?: number;
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .replace(/ð/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function MenuAdminPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [options, setOptions] = useState<{
    sizes: { id: number; label: string; name: string; price_extra: number }[];
    bases: { id: number; name: string }[];
    sugars: { id: number; label: string }[];
    ices: { id: number; label: string }[];
    toppings: { id: number; name: string; price: number; is_available: boolean }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<Category | null>(null);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [toppingDialog, setToppingDialog] = useState(false);
  const [editTopping, setEditTopping] = useState<Topping | null>(null);
  const [toppingName, setToppingName] = useState("");
  const [toppingPrice, setToppingPrice] = useState("15000");
  const [savingTopping, setSavingTopping] = useState(false);
  const [deleteTopping, setDeleteTopping] = useState<Topping | null>(null);
  const [baseDialog, setBaseDialog] = useState(false);
  const [editBase, setEditBase] = useState<{ id: number; name: string } | null>(null);
  const [baseName, setBaseName] = useState("");
  const [savingBase, setSavingBase] = useState(false);
  const [deleteBase, setDeleteBase] = useState<{ id: number; name: string } | null>(null);
  const [tab, setTab] = useState("products");
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, prods, opts] = await Promise.all([
        apiGet<Category[]>("/admin/menu/categories"),
        apiGet<Product[]>("/admin/menu/products"),
        apiGet<typeof options>("/admin/menu/options"),
      ]);
      setCategories(cats);
      setProducts(prods);
      setOptions(opts);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không tải được thực đơn");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const availabilityInFlightRef = useRef(new Set<number>());
  const [pendingAvailabilityIds, setPendingAvailabilityIds] = useState<Set<number>>(new Set());

  async function handleSetProductAvailability(p: Product, desiredState: boolean) {
    if (!beginProductAvailabilityRequest(availabilityInFlightRef.current, p.id)) return;
    setPendingAvailabilityIds(new Set(availabilityInFlightRef.current));
    try {
      const res = await apiPut<{ id: number; is_available: boolean; message: string; removed_wishlist_count?: number }>(
        `/admin/menu/products/${p.id}/availability`,
        { is_available: desiredState },
      );
      toast.success(res.message, {
        description: res.removed_wishlist_count ? `Đã dọn dẹp ${res.removed_wishlist_count} mục yêu thích của khách hàng.` : undefined,
      });
      setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_available: res.is_available } : x)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cập nhật trạng thái thất bại");
    } finally {
      finishProductAvailabilityRequest(availabilityInFlightRef.current, p.id);
      setPendingAvailabilityIds(new Set(availabilityInFlightRef.current));
    }
  }

  async function confirmDeleteProduct() {
    if (!deleteProduct) return;
    try {
      await apiDelete(`/admin/menu/products/${deleteProduct.id}`);
      toast.success(`Đã xóa món ${deleteProduct.name}`);
      setDeleteProduct(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xóa món thất bại");
    }
  }

  async function confirmDeleteCategory() {
    if (!deleteCategory) return;
    try {
      await apiDelete(`/admin/menu/categories/${deleteCategory.id}`);
      toast.success(`Đã xóa danh mục ${deleteCategory.name}`);
      setDeleteCategory(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xóa danh mục thất bại");
    }
  }

  function openTopping(t?: Topping) {
    setEditTopping(t ?? null);
    setToppingName(t?.name ?? "");
    setToppingPrice(String(t?.price ?? 15000));
    setToppingDialog(true);
  }

  async function saveTopping() {
    if (!toppingName.trim()) return toast.error("Nhập tên topping");
    setSavingTopping(true);
    try {
      const payload = { name: toppingName.trim(), price: Number(toppingPrice) || 0 };
      if (editTopping) {
        await apiPut(`/admin/menu/toppings/${editTopping.id}`, payload);
        toast.success("Đã cập nhật topping");
      } else {
        await apiPost("/admin/menu/toppings", payload);
        toast.success("Đã thêm topping");
      }
      setToppingDialog(false);
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lưu topping thất bại");
    } finally {
      setSavingTopping(false);
    }
  }

  async function toggleTopping(t: Topping) {
    try {
      await apiPut(`/admin/menu/toppings/${t.id}`, { is_available: t.is_available ? 0 : 1 });
      toast.success(t.is_available ? "Đã tắt topping" : "Đã bật topping");
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cập nhật thất bại");
    }
  }

  async function confirmDeleteTopping() {
    if (!deleteTopping) return;
    try {
      await apiDelete(`/admin/menu/toppings/${deleteTopping.id}`);
      toast.success("Đã xóa topping");
      setDeleteTopping(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xóa topping thất bại");
    }
  }

  function openBase(b?: { id: number; name: string }) {
    setEditBase(b ?? null);
    setBaseName(b?.name ?? "");
    setBaseDialog(true);
  }

  async function saveBase() {
    if (!baseName.trim()) return toast.error("Nhập tên cốt trà nền");
    setSavingBase(true);
    try {
      if (editBase) {
        await apiPut(`/admin/menu/bases/${editBase.id}`, { name: baseName.trim() });
        toast.success("Đã cập nhật cốt trà");
      } else {
        await apiPost("/admin/menu/bases", { name: baseName.trim() });
        toast.success("Đã thêm cốt trà");
      }
      setBaseDialog(false);
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lưu cốt trà thất bại");
    } finally {
      setSavingBase(false);
    }
  }

  async function confirmDeleteBase() {
    if (!deleteBase) return;
    try {
      await apiDelete(`/admin/menu/bases/${deleteBase.id}`);
      toast.success("Đã xóa cốt trà");
      setDeleteBase(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xóa cốt trà thất bại");
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Quản lý thực đơn"
        desc="Danh mục, sản phẩm và nhóm tùy chọn hiển thị trên website khách hàng"
        actions={
          <ProductForm
            categories={categories}
            bases={options?.bases ?? []}
            onSaved={() => setReloadKey((k) => k + 1)}
            product={editProduct}
            onClearEdit={() => setEditProduct(null)}
          />
        }
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Boxes className="size-5" />
          </span>
          <div>
            <p className="text-sm font-bold text-foreground">Hệ Thống Đã Nâng Cấp Catalog V2 Đa Ngành Hàng</p>
            <p className="text-xs text-muted-foreground">
              Hỗ trợ cây danh mục 3 cấp, ngành hàng F&B / Quần áo / Đồ ăn và biến thể SKU.
            </p>
          </div>
        </div>
        <Link
          to="/admin/catalog"
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-glow transition-all hover:opacity-90"
        >
          <span>Mở Catalog V2</span>
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab} defaultValue="products">
          <TabsList>
            <TabsTrigger value="products">Sản phẩm</TabsTrigger>
            <TabsTrigger value="categories">Danh mục</TabsTrigger>
            <TabsTrigger value="options">Tùy chọn</TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {products.map((p) => (
                <Card key={p.id} className="shadow-soft overflow-hidden">
                  {p.image_url && (
                    <img src={p.image_url} alt={p.name} loading="lazy" className="h-40 w-full object-cover" />
                  )}
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-display font-bold">{p.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {p.category_name || `Danh mục #${p.category_id}`}
                        </p>
                      </div>
                      <Badge variant="secondary">{p.base_tea}</Badge>
                    </div>
                    <p className="text-primary mt-2 font-bold">{vnd(p.price)}</p>
                    <div className="mt-3 flex items-center justify-between border-t pt-3">
                      <label className="flex items-center gap-2 text-xs">
                        <Switch
                          checked={p.is_available}
                          disabled={pendingAvailabilityIds.has(p.id)}
                          onCheckedChange={(checked) => handleSetProductAvailability(p, checked)}
                        />
                        {p.is_available ? "Đang bán" : "Tạm ngưng"}
                      </label>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Sửa"
                          onClick={() => setEditProduct(p)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Xóa món ${p.name}`}
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteProduct(p)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {products.length === 0 && (
                <p className="text-muted-foreground col-span-full py-10 text-center text-sm">
                  Chưa có sản phẩm nào
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="categories" className="mt-5">
            <SectionCard
              title="Danh mục món"
              desc="Danh mục tự kích hoạt khi thêm — chỉ sửa tên hoặc xóa"
              actions={
                <CategoryForm
                  onSaved={() => setReloadKey((k) => k + 1)}
                  category={editCategory}
                  onClearEdit={() => setEditCategory(null)}
                />
              }
            >
              <ul className="space-y-2">
                {categories.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 rounded-xl border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">
                        {c.name} <span className="text-muted-foreground font-normal">· {c.items} món</span>
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Sửa danh mục ${c.name}`}
                      onClick={() => setEditCategory(c)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Xóa danh mục ${c.name}`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteCategory(c)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </TabsContent>

          <TabsContent value="options" className="mt-5">
            {options && (
              <div className="grid gap-4 md:grid-cols-2">
                <SectionCard title="Size" desc={`${options.sizes.length} lựa chọn`}>
                  <div className="flex flex-wrap gap-2">
                    {options.sizes.map((s) => (
                      <Badge key={s.id} variant="secondary" className="rounded-full px-3 py-1">
                        {s.name} {s.price_extra > 0 ? `(+${vnd(s.price_extra)})` : ""}
                      </Badge>
                    ))}
                  </div>
                </SectionCard>
                <SectionCard
                  title="Cốt trà nền"
                  desc={`${options.bases.length} lựa chọn`}
                  actions={
                    <Button variant="soft" size="sm" onClick={() => openBase()}>
                      <Plus className="mr-1 size-4" /> Thêm cốt trà
                    </Button>
                  }
                >
                  <div className="space-y-2">
                    {options.bases.map((b) => (
                      <div key={b.id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                        <span className="min-w-0 flex-1 text-sm">{b.name}</span>
                        <Button variant="ghost" size="icon" aria-label={`Sửa cốt trà ${b.name}`} onClick={() => openBase(b)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Xóa cốt trà ${b.name}`}
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteBase(b)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                    {options.bases.length === 0 && (
                      <p className="text-muted-foreground py-4 text-center text-sm">Chưa có cốt trà nào</p>
                    )}
                  </div>
                </SectionCard>
                <SectionCard title="Mức đường" desc={`${options.sugars.length} lựa chọn`}>
                  <div className="flex flex-wrap gap-2">
                    {options.sugars.map((s) => (
                      <Badge key={s.id} variant="secondary" className="rounded-full px-3 py-1">
                        {s.label}
                      </Badge>
                    ))}
                  </div>
                </SectionCard>
                <SectionCard title="Mức đá" desc={`${options.ices.length} lựa chọn`}>
                  <div className="flex flex-wrap gap-2">
                    {options.ices.map((s) => (
                      <Badge key={s.id} variant="secondary" className="rounded-full px-3 py-1">
                        {s.label}
                      </Badge>
                    ))}
                  </div>
                </SectionCard>
                <SectionCard
                  title="Topping"
                  desc={`${options.toppings.length} lựa chọn`}
                  actions={
                    <Button variant="soft" size="sm" onClick={() => openTopping()}>
                      <Plus className="mr-1 size-4" /> Thêm topping
                    </Button>
                  }
                >
                  <div className="space-y-2">
                    {options.toppings.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                        <Switch checked={t.is_available} onCheckedChange={() => toggleTopping(t)} />
                        <span className="min-w-0 flex-1 text-sm">
                          {t.name} <span className="text-muted-foreground">+{vnd(t.price)}</span>
                        </span>
                        <Button variant="ghost" size="icon" aria-label={`Sửa topping ${t.name}`} onClick={() => openTopping(t)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Xóa topping ${t.name}`}
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteTopping(t)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                    {options.toppings.length === 0 && (
                      <p className="text-muted-foreground py-4 text-center text-sm">Chưa có topping nào</p>
                    )}
                  </div>
                </SectionCard>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <AlertDialog open={!!deleteProduct} onOpenChange={(o) => !o && setDeleteProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa món "{deleteProduct?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Món sẽ bị xóa vĩnh viễn khỏi thực đơn. Không thể xóa nếu đã có trong đơn hàng.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-berry text-berry-foreground hover:bg-berry/90"
              onClick={confirmDeleteProduct}
            >
              Xóa món
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteCategory} onOpenChange={(o) => !o && setDeleteCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa danh mục "{deleteCategory?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Danh mục sẽ bị xóa vĩnh viễn. Không thể xóa nếu còn món trong đó.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-berry text-berry-foreground hover:bg-berry/90"
              onClick={confirmDeleteCategory}
            >
              Xóa danh mục
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={toppingDialog} onOpenChange={setToppingDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editTopping ? `Sửa topping: ${editTopping.name}` : "Thêm topping mới"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="t-name">Tên topping</Label>
              <Input id="t-name" value={toppingName} onChange={(e) => setToppingName(e.target.value)} className="mt-1.5" placeholder="Trân châu trắng" />
            </div>
            <div>
              <Label htmlFor="t-price">Giá (₫)</Label>
              <Input id="t-price" type="number" value={toppingPrice} onChange={(e) => setToppingPrice(e.target.value)} className="mt-1.5" />
            </div>
            <Button variant="hero" className="w-full" onClick={saveTopping} disabled={savingTopping}>
              {savingTopping ? <Loader2 className="size-4 animate-spin" /> : editTopping ? "Lưu thay đổi" : "Thêm topping"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTopping} onOpenChange={(o) => !o && setDeleteTopping(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa topping "{deleteTopping?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Topping sẽ bị xóa khỏi menu. Hành động không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-berry text-berry-foreground hover:bg-berry/90"
              onClick={confirmDeleteTopping}
            >
              Xóa topping
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={baseDialog} onOpenChange={setBaseDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editBase ? `Sửa cốt trà: ${editBase.name}` : "Thêm cốt trà nền mới"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="b-name">Tên cốt trà</Label>
              <Input id="b-name" value={baseName} onChange={(e) => setBaseName(e.target.value)} className="mt-1.5" placeholder="Lục Trà Lài" />
            </div>
            <Button variant="hero" className="w-full" onClick={saveBase} disabled={savingBase}>
              {savingBase ? <Loader2 className="size-4 animate-spin" /> : editBase ? "Lưu thay đổi" : "Thêm cốt trà"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteBase} onOpenChange={(o) => !o && setDeleteBase(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa cốt trà "{deleteBase?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Cốt trà sẽ bị xóa khỏi danh sách lựa chọn. Hành động không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-berry text-berry-foreground hover:bg-berry/90"
              onClick={confirmDeleteBase}
            >
              Xóa cốt trà
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ProductForm({
  categories,
  bases,
  onSaved,
  product,
  onClearEdit,
}: {
  categories: Category[];
  bases: { id: number; name: string }[];
  onSaved: () => void;
  product: Product | null;
  onClearEdit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("49000");
  const [categoryId, setCategoryId] = useState("");
  const [baseTea, setBaseTea] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !product) return;
    setName(product.name);
    setPrice(String(product.price));
    setCategoryId(String(product.category_id));
    setBaseTea(product.base_tea);
    setDescription(product.description || "");
    setImage(product.image_url);
  }, [open, product]);

  useEffect(() => {
    if (!product) {
      setName("");
      setPrice("49000");
      setCategoryId(String(categories[0]?.id ?? ""));
      setBaseTea("");
      setDescription("");
      setImage(null);
    }
  }, [product, categories]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Vui lòng chọn file ảnh");
    if (file.size > 2 * 1024 * 1024) return toast.error("Ảnh tối đa 2MB");
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function save() {
    if (!name.trim() || !price.trim()) {
      return toast.error("Vui lòng nhập tên và giá");
    }
    const catId = Number(categoryId);
    if (!catId || Number.isNaN(catId) || catId <= 0) {
      return toast.error("Vui lòng chọn danh mục cho sản phẩm");
    }
    const slug = slugify(name.trim());
    setSaving(true);
    try {
      const payload = {
        category_id: catId,
        name: name.trim(),
        slug,
        base_tea: baseTea.trim() || "Lục Trà",
        description: description.trim() || null,
        price: Number(price),
        image_url: image,
        calories: 0,
      };
      if (product) {
        await apiPut(`/admin/menu/products/${product.id}`, payload);
        toast.success("Đã cập nhật món");
        onClearEdit();
      } else {
        await apiPost("/admin/menu/products", payload);
        toast.success("Đã thêm món mới");
      }
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open || !!product}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) onClearEdit();
      }}
    >
      <DialogTrigger asChild>
        {!product && (
          <Button variant="hero">
            <Plus className="mr-1 size-4" /> Thêm sản phẩm
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? `Sửa món: ${product.name}` : "Thêm sản phẩm mới"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Ảnh sản phẩm</Label>
            <div className="mt-1.5 flex items-start gap-3">
              <div className="bg-muted flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border">
                {image ? (
                  <img src={image} alt="Ảnh sản phẩm" className="h-full w-full object-cover" />
                ) : (
                  <Image className="text-muted-foreground size-8" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label className="cursor-pointer">
                  <span className="bg-berry text-berry-foreground hover:bg-berry/90 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium">
                    <Upload className="size-4" /> {image ? "Đổi ảnh" : "Chọn ảnh"}
                  </span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
                </label>
                <p className="text-muted-foreground text-xs">Ảnh lưu trực tiếp vào DB, tối đa 2MB</p>
                {image && (
                  <Button variant="ghost" size="sm" className="w-fit" onClick={() => setImage(null)}>
                    <X className="mr-1 size-4" /> Gỡ ảnh
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div>
            <Label htmlFor="p-name">Tên sản phẩm</Label>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="p-price">Giá bán (₫)</Label>
              <Input id="p-price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label>Danh mục</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Chọn danh mục" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="p-base">Cốt trà nền</Label>
            <Select value={baseTea} onValueChange={setBaseTea}>
              <SelectTrigger id="p-base" className="mt-1.5">
                <SelectValue placeholder="Chọn cốt trà nền" />
              </SelectTrigger>
              <SelectContent>
                {bases.map((b) => (
                  <SelectItem key={b.id} value={b.name}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="p-desc">Mô tả</Label>
            <Textarea id="p-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1.5" />
          </div>
          <Button variant="hero" className="w-full" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : product ? "Lưu thay đổi" : "Lưu sản phẩm"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CategoryForm({
  onSaved,
  category,
  onClearEdit,
}: {
  onSaved: () => void;
  category: Category | null;
  onClearEdit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!category) return;
    setName(category.name);
  }, [category]);

  useEffect(() => {
    if (!category) {
      setName("");
    }
  }, [category]);

  async function save() {
    if (!name.trim()) return toast.error("Vui lòng nhập tên danh mục");
    const slug = slugify(name.trim());
    setSaving(true);
    try {
      if (category) {
        await apiPut(`/admin/menu/categories/${category.id}`, {
          name: name.trim(),
          slug,
          sort_order: category.sort_order,
          is_visible: category.is_visible ? 1 : 0,
        });
        toast.success("Đã cập nhật danh mục");
        onClearEdit();
      } else {
        await apiPost("/admin/menu/categories", { name: name.trim(), slug, sort_order: 0, is_visible: 1 });
        toast.success("Đã tạo danh mục");
      }
      setOpen(false);
      setName("");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lưu danh mục thất bại");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open || !!category}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) onClearEdit();
      }}
    >
      <DialogTrigger asChild>
        {!category && (
          <Button variant="soft" size="sm">
            <Plus className="mr-1 size-4" /> Thêm danh mục
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{category ? `Sửa danh mục: ${category.name}` : "Thêm danh mục mới"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="c-name">Tên danh mục</Label>
            <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" placeholder="Trà Sen" />
          </div>
          <Button variant="hero" className="w-full" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : category ? "Lưu thay đổi" : "Lưu danh mục"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
