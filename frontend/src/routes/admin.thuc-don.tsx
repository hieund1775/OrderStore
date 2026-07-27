import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { menuCategories, optionGroups } from "@/lib/admin-data";
import { products, vnd } from "@/lib/data";

export const Route = createFileRoute("/admin/thuc-don")({
  head: () => ({
    meta: [
      { title: "Quản lý thực đơn | Admin Vườn Xanh" },
      {
        name: "description",
        content: "CRUD danh mục, sản phẩm, SEO slug, sắp xếp hiển thị và cấu hình nhóm tùy chọn.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Quản lý thực đơn | Admin Vườn Xanh" },
      {
        property: "og:description",
        content: "Thêm, sửa, ẩn/hiện món và cấu hình tùy chọn size, đường, đá, topping.",
      },
    ],
  }),
  component: MenuAdminPage,
});

function MenuAdminPage() {
  const [visible, setVisible] = useState<Record<string, boolean>>(
    Object.fromEntries(products.map((p) => [p.id, true])),
  );

  return (
    <>
      <AdminPageHeader
        title="Quản lý thực đơn"
        desc="Danh mục, sản phẩm và nhóm tùy chọn hiển thị trên website khách hàng"
        actions={<ProductForm />}
      />

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
                <img
                  src={p.image}
                  alt={p.name}
                  loading="lazy"
                  className="h-40 w-full object-cover"
                />
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-display font-bold">{p.name}</p>
                      <p className="text-muted-foreground text-xs">/{p.id}</p>
                    </div>
                    <Badge variant="secondary">{p.line}</Badge>
                  </div>
                  <p className="text-primary mt-2 font-bold">{vnd(p.price)}</p>
                  <div className="mt-3 flex items-center justify-between border-t pt-3">
                    <label className="flex items-center gap-2 text-xs">
                      <Switch
                        checked={visible[p.id]}
                        onCheckedChange={(v) => {
                          setVisible((s) => ({ ...s, [p.id]: v }));
                          toast.success(v ? `Đã mở bán ${p.name}` : `Đã tạm ngưng ${p.name}`);
                        }}
                      />
                      {visible[p.id] ? "Đang bán" : "Tạm ngưng"}
                    </label>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" aria-label="Sửa">
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Xóa">
                        <Trash2 className="text-berry size-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="categories" className="mt-5">
          <SectionCard
            title="Danh mục món"
            desc="Kéo thả để đổi thứ tự hiển thị trên menu khách hàng"
            actions={
              <Button variant="soft" size="sm">
                <Plus className="mr-1 size-4" /> Thêm danh mục
              </Button>
            }
          >
            <ul className="space-y-2">
              {menuCategories.map((c) => (
                <li key={c.id} className="flex items-center gap-3 rounded-xl border p-3">
                  <GripVertical className="text-muted-foreground size-4 cursor-grab" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{c.name}</p>
                    <p className="text-muted-foreground text-xs">{c.items} món</p>
                  </div>
                  <Switch defaultChecked={c.visible} />
                  <Button variant="ghost" size="icon" aria-label="Sửa danh mục">
                    <Pencil className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </SectionCard>
        </TabsContent>

        <TabsContent value="options" className="mt-5">
          <div className="grid gap-4 md:grid-cols-2">
            {optionGroups.map((g) => (
              <SectionCard key={g.id} title={g.name} desc={`${g.values.length} lựa chọn`}>
                <div className="flex flex-wrap gap-2">
                  {g.values.map((v) => (
                    <Badge key={v} variant="secondary" className="rounded-full px-3 py-1">
                      {v}
                    </Badge>
                  ))}
                </div>
                <Button variant="ghost" size="sm" className="mt-3">
                  <Plus className="mr-1 size-4" /> Thêm giá trị
                </Button>
              </SectionCard>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

function ProductForm() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="hero">
          <Plus className="mr-1 size-4" /> Thêm sản phẩm
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Thêm sản phẩm mới</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="p-name">Tên sản phẩm</Label>
            <Input id="p-name" placeholder="Trà Ổi Hồng Đào" className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="p-slug">SEO Slug (tự sinh)</Label>
            <Input id="p-slug" placeholder="tra-oi-hong-dao" className="mt-1.5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="p-price">Giá bán (₫)</Label>
              <Input id="p-price" type="number" placeholder="49000" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="p-cat">Danh mục</Label>
              <Input id="p-cat" placeholder="Trà Trái Cây Tươi" className="mt-1.5" />
            </div>
          </div>
          <div>
            <Label htmlFor="p-desc">Mô tả</Label>
            <Textarea
              id="p-desc"
              rows={3}
              placeholder="Mô tả hương vị, nguyên liệu…"
              className="mt-1.5"
            />
          </div>
          <div className="rounded-xl border border-dashed p-6 text-center">
            <p className="text-muted-foreground text-sm">Kéo thả ảnh hoặc bấm để tải lên gallery</p>
            <Button variant="outline" size="sm" className="mt-2">
              Chọn ảnh
            </Button>
          </div>
          <Button
            variant="hero"
            className="w-full"
            onClick={() => toast.success("Đã lưu sản phẩm (demo)")}
          >
            Lưu sản phẩm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
