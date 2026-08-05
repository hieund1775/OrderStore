import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader, SectionCard } from "@/components/admin/AdminUI";
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
import { apiGet, apiPost, apiPut } from "@/lib/api";
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

  async function toggleProduct(p: Product) {
    try {
      const res = await apiPut<{ is_available: boolean; message: string }>(
        `/admin/menu/products/${p.id}/toggle`,
        {},
      );
      toast.success(res.message);
      setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_available: res.is_available } : x)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cập nhật thất bại");
    }
  }

  async function toggleCategory(c: Category) {
    try {
      await apiPut(`/admin/menu/categories/${c.id}`, {
        name: c.name,
        slug: c.slug,
        sort_order: c.sort_order,
        is_visible: c.is_visible ? 0 : 1,
      });
      toast.success(c.is_visible ? "Đã ẩn danh mục" : "Đã hiện danh mục");
      setCategories((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, is_visible: !x.is_visible } : x)),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cập nhật thất bại");
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
            onSaved={() => setReloadKey((k) => k + 1)}
            product={editProduct}
            onClearEdit={() => setEditProduct(null)}
          />
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : (
        <Tabs defaultValue="products">
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
                          {p.category_name || `Danh mục #${p.category_id}`} · /{p.slug}
                        </p>
                      </div>
                      <Badge variant="secondary">{p.base_tea}</Badge>
                    </div>
                    <p className="text-primary mt-2 font-bold">{vnd(p.price)}</p>
                    <div className="mt-3 flex items-center justify-between border-t pt-3">
                      <label className="flex items-center gap-2 text-xs">
                        <Switch checked={p.is_available} onCheckedChange={() => toggleProduct(p)} />
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
              desc="Bật/tắt hiển thị trên menu khách hàng"
              actions={
                <CategoryForm onSaved={() => setReloadKey((k) => k + 1)} />
              }
            >
              <ul className="space-y-2">
                {categories.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 rounded-xl border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{c.name}</p>
                      <p className="text-muted-foreground text-xs">
                        /{c.slug} · {c.items} món
                      </p>
                    </div>
                    <Switch checked={c.is_visible} onCheckedChange={() => toggleCategory(c)} />
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
                <SectionCard title="Cốt trà nền" desc={`${options.bases.length} lựa chọn`}>
                  <div className="flex flex-wrap gap-2">
                    {options.bases.map((b) => (
                      <Badge key={b.id} variant="secondary" className="rounded-full px-3 py-1">
                        {b.name}
                      </Badge>
                    ))}
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
                <SectionCard title="Topping" desc={`${options.toppings.length} lựa chọn`}>
                  <div className="flex flex-wrap gap-2">
                    {options.toppings.map((t) => (
                      <Badge
                        key={t.id}
                        variant={t.is_available ? "secondary" : "outline"}
                        className="rounded-full px-3 py-1"
                      >
                        {t.name} (+{vnd(t.price)}){!t.is_available ? " · hết" : ""}
                      </Badge>
                    ))}
                  </div>
                </SectionCard>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}

function ProductForm({
  categories,
  onSaved,
  product,
  onClearEdit,
}: {
  categories: Category[];
  onSaved: () => void;
  product: Product | null;
  onClearEdit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [price, setPrice] = useState("49000");
  const [categoryId, setCategoryId] = useState("");
  const [baseTea, setBaseTea] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !product) return;
    setName(product.name);
    setSlug(product.slug);
    setPrice(String(product.price));
    setCategoryId(String(product.category_id));
    setBaseTea(product.base_tea);
    setDescription(product.description || "");
  }, [open, product]);

  useEffect(() => {
    if (!product) {
      setName("");
      setSlug("");
      setPrice("49000");
      setCategoryId(String(categories[0]?.id ?? ""));
      setBaseTea("");
      setDescription("");
    }
  }, [product, categories]);

  async function save() {
    if (!name.trim() || !slug.trim() || !price.trim()) {
      return toast.error("Vui lòng nhập tên, slug và giá");
    }
    setSaving(true);
    try {
      const payload = {
        category_id: Number(categoryId),
        name: name.trim(),
        slug: slug.trim(),
        base_tea: baseTea.trim() || "Lục Trà",
        description: description.trim() || null,
        price: Number(price),
        image_url: null,
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
            <Label htmlFor="p-name">Tên sản phẩm</Label>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="p-slug">SEO Slug</Label>
            <Input id="p-slug" value={slug} onChange={(e) => setSlug(e.target.value)} className="mt-1.5" />
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
            <Input id="p-base" value={baseTea} onChange={(e) => setBaseTea(e.target.value)} className="mt-1.5" />
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

function CategoryForm({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim() || !slug.trim()) return toast.error("Vui lòng nhập tên và slug");
    setSaving(true);
    try {
      await apiPost("/admin/menu/categories", { name: name.trim(), slug: slug.trim(), sort_order: 0, is_visible: 1 });
      toast.success("Đã tạo danh mục");
      setOpen(false);
      setName("");
      setSlug("");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Tạo danh mục thất bại");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="soft" size="sm">
          <Plus className="mr-1 size-4" /> Thêm danh mục
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Thêm danh mục mới</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="c-name">Tên danh mục</Label>
            <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="c-slug">Slug</Label>
            <Input id="c-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="tra-trai-cay-moi" className="mt-1.5" />
          </div>
          <Button variant="hero" className="w-full" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Lưu danh mục"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
